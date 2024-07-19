/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { Signer } from '@ethersproject/abstract-signer'
import {
  Provider,
  BlockTag,
  TransactionRequest,
} from '@ethersproject/abstract-provider'
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { MaxUint256 } from '@ethersproject/constants'
import { ErrorCode, Logger } from '@ethersproject/logger'
import { BigNumber, BigNumberish, ethers, BytesLike, constants } from 'ethers'

import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../abi/factories/L2GatewayRouter__factory'
import { L1WethGateway__factory } from '../abi/factories/L1WethGateway__factory'
import { L2ArbitrumGateway__factory } from '../abi/factories/L2ArbitrumGateway__factory'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { ERC20 } from '../abi/ERC20'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { ICustomToken__factory } from '../abi/factories/ICustomToken__factory'
import { IArbToken__factory } from '../abi/factories/IArbToken__factory'

import { WithdrawalInitiatedEvent } from '../abi/L2ArbitrumGateway'
import { GatewaySetEvent } from '../abi/L1GatewayRouter'
import {
  GasOverrides,
  ParentToChildMessageGasEstimator,
} from '../message/ParentToChildMessageGasEstimator'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import {
  ArbitrumNetwork,
  TokenBridge,
  assertArbitrumNetworkHasTokenBridge,
  getArbitrumNetwork,
} from '../dataEntities/networks'
import { ArbSdkError, MissingProviderArbSdkError } from '../dataEntities/errors'
import { DISABLED_GATEWAY } from '../dataEntities/constants'
import { EventFetcher } from '../utils/eventFetcher'
import { EthDepositParams, EthWithdrawParams } from './ethBridger'
import { AssetBridger } from './assetBridger'
import {
  ParentContractCallTransaction,
  ParentContractTransaction,
  ParentTransactionReceipt,
} from '../message/ParentTransaction'
import {
  ChildContractTransaction,
  ChildTransactionReceipt,
} from '../message/ChildTransaction'
import {
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
  ChildToParentTransactionRequest,
  ParentToChildTransactionRequest,
} from '../dataEntities/transactionRequest'
import { defaultAbiCoder } from 'ethers/lib/utils'
import { OmitTyped, RequiredPick } from '../utils/types'
import { RetryableDataTools } from '../dataEntities/retryableData'
import { EventArgs } from '../dataEntities/event'
import { ParentToChildMessageGasParams } from '../message/ParentToChildMessageCreator'
import { isArbitrumChain } from '../utils/lib'
import { L2ERC20Gateway__factory } from '../abi/factories/L2ERC20Gateway__factory'
import { getErc20ParentAddressFromParentToChildTxRequest } from '../utils/calldata'

export interface TokenApproveParams {
  /**
   * Parent network address of the ERC20 token contract
   */
  erc20ParentAddress: string
  /**
   * Amount to approve. Defaults to max int.
   */
  amount?: BigNumber
  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export interface Erc20DepositParams extends EthDepositParams {
  /**
   * A child provider
   */
  childProvider: Provider
  /**
   * Parent network address of the token ERC20 contract
   */
  erc20ParentAddress: string
  /**
   * Child network address of the entity receiving the funds. Defaults to the l1FromAddress
   */
  destinationAddress?: string
  /**
   * The maximum cost to be paid for submitting the transaction
   */
  maxSubmissionCost?: BigNumber
  /**
   * The address to return the any gas that was not spent on fees
   */
  excessFeeRefundAddress?: string
  /**
   * The address to refund the call value to in the event the retryable is cancelled, or expires
   */
  callValueRefundAddress?: string
  /**
   * Overrides for the retryable ticket parameters
   */
  retryableGasOverrides?: GasOverrides
  /**
   * Transaction overrides
   */
  overrides?: Overrides
}

export interface Erc20WithdrawParams extends EthWithdrawParams {
  /**
   * Parent network address of the token ERC20 contract
   */
  erc20ParentAddress: string
}

export type ParentToChildTxReqAndSignerProvider =
  ParentToChildTransactionRequest & {
    parentSigner: Signer
    childProvider: Provider
    overrides?: Overrides
  }

export type ChildToParentTxReqAndSigner = ChildToParentTransactionRequest & {
  childSigner: Signer
  overrides?: Overrides
}

type SignerTokenApproveParams = TokenApproveParams & { parentSigner: Signer }
type ProviderTokenApproveParams = TokenApproveParams & {
  parentProvider: Provider
}
export type ApproveParamsOrTxRequest =
  | SignerTokenApproveParams
  | {
      txRequest: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>
      parentSigner: Signer
      overrides?: Overrides
    }

/**
 * The deposit request takes the same args as the actual deposit. Except we don't require a signer object
 * only a provider
 */
type DepositRequest = OmitTyped<
  Erc20DepositParams,
  'overrides' | 'parentSigner'
> & {
  parentProvider: Provider
  /**
   * Address that is depositing the assets
   */
  from: string
}

type DefaultedDepositRequest = RequiredPick<
  DepositRequest,
  'callValueRefundAddress' | 'excessFeeRefundAddress' | 'destinationAddress'
>

/**
 * Bridger for moving ERC20 tokens back and forth between parent-to-child
 */
export class Erc20Bridger extends AssetBridger<
  Erc20DepositParams | ParentToChildTxReqAndSignerProvider,
  OmitTyped<Erc20WithdrawParams, 'from'> | ChildToParentTransactionRequest
> {
  public static MAX_APPROVAL: BigNumber = MaxUint256
  public static MIN_CUSTOM_DEPOSIT_GAS_LIMIT = BigNumber.from(275000)

  public readonly childNetwork: ArbitrumNetwork & {
    tokenBridge: TokenBridge
  }

  /**
   * Bridger for moving ERC20 tokens back and forth between parent-to-child
   */
  public constructor(childNetwork: ArbitrumNetwork) {
    super(childNetwork)
    assertArbitrumNetworkHasTokenBridge(childNetwork)
    this.childNetwork = childNetwork
  }

  /**
   * Instantiates a new Erc20Bridger from a child provider
   * @param childProvider
   * @returns
   */
  public static async fromProvider(childProvider: Provider) {
    return new Erc20Bridger(await getArbitrumNetwork(childProvider))
  }

  /**
   * Get the address of the parent gateway for this token
   * @param erc20ParentAddress
   * @param parentProvider
   * @returns
   */
  public async getParentGatewayAddress(
    erc20ParentAddress: string,
    parentProvider: Provider
  ): Promise<string> {
    await this.checkParentNetwork(parentProvider)

    return await L1GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.parentGatewayRouter,
      parentProvider
    ).getGateway(erc20ParentAddress)
  }

  /**
   * Get the address of the child gateway for this token
   * @param erc20ParentAddress
   * @param childProvider
   * @returns
   */
  public async getChildGatewayAddress(
    erc20ParentAddress: string,
    childProvider: Provider
  ): Promise<string> {
    await this.checkChildNetwork(childProvider)

    return await L2GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.childGatewayRouter,
      childProvider
    ).getGateway(erc20ParentAddress)
  }

  /**
   * Creates a transaction request for approving the custom gas token to be spent by the relevant gateway on the parent network
   * @param params
   */
  public async getApproveGasTokenRequest(
    params: ProviderTokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const txRequest = await this.getApproveTokenRequest(params)
    // just reuse the approve token request but direct it towards the native token contract
    return { ...txRequest, to: this.nativeToken! }
  }

  /**
   * Approves the custom gas token to be spent by the relevant gateway on the parent network
   * @param params
   */
  public async approveGasToken(
    params: ApproveParamsOrTxRequest
  ): Promise<ethers.ContractTransaction> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    await this.checkParentNetwork(params.parentSigner)

    const approveGasTokenRequest = this.isApproveParams(params)
      ? await this.getApproveGasTokenRequest({
          ...params,
          parentProvider: SignerProviderUtils.getProviderOrThrow(
            params.parentSigner
          ),
        })
      : params.txRequest

    return params.parentSigner.sendTransaction({
      ...approveGasTokenRequest,
      ...params.overrides,
    })
  }

  /**
   * Get a tx request to approve tokens for deposit to the bridge.
   * The tokens will be approved for the relevant gateway.
   * @param params
   * @returns
   */
  public async getApproveTokenRequest(
    params: ProviderTokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    // you approve tokens to the gateway that the router will use
    const gatewayAddress = await this.getParentGatewayAddress(
      params.erc20ParentAddress,
      SignerProviderUtils.getProviderOrThrow(params.parentProvider)
    )

    const iErc20Interface = ERC20__factory.createInterface()
    const data = iErc20Interface.encodeFunctionData('approve', [
      gatewayAddress,
      params.amount || Erc20Bridger.MAX_APPROVAL,
    ])

    return {
      to: params.erc20ParentAddress,
      data,
      value: BigNumber.from(0),
    }
  }

  protected isApproveParams(
    params: ApproveParamsOrTxRequest
  ): params is SignerTokenApproveParams {
    return (params as SignerTokenApproveParams).erc20ParentAddress != undefined
  }

  /**
   * Approve tokens for deposit to the bridge. The tokens will be approved for the relevant gateway.
   * @param params
   * @returns
   */
  public async approveToken(
    params: ApproveParamsOrTxRequest
  ): Promise<ethers.ContractTransaction> {
    await this.checkParentNetwork(params.parentSigner)

    const approveRequest = this.isApproveParams(params)
      ? await this.getApproveTokenRequest({
          ...params,
          parentProvider: SignerProviderUtils.getProviderOrThrow(
            params.parentSigner
          ),
        })
      : params.txRequest
    return await params.parentSigner.sendTransaction({
      ...approveRequest,
      ...params.overrides,
    })
  }

  /**
   * Get the child network events created by a withdrawal
   * @param childProvider
   * @param gatewayAddress
   * @param parentTokenAddress
   * @param fromAddress
   * @param filter
   * @returns
   */
  public async getWithdrawalEvents(
    childProvider: Provider,
    gatewayAddress: string,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    parentTokenAddress?: string,
    fromAddress?: string,
    toAddress?: string
  ): Promise<(EventArgs<WithdrawalInitiatedEvent> & { txHash: string })[]> {
    await this.checkChildNetwork(childProvider)

    const eventFetcher = new EventFetcher(childProvider)
    const events = (
      await eventFetcher.getEvents(
        L2ArbitrumGateway__factory,
        contract =>
          contract.filters.WithdrawalInitiated(
            null, // parentToken
            fromAddress || null, // _from
            toAddress || null // _to
          ),
        { ...filter, address: gatewayAddress }
      )
    ).map(a => ({ txHash: a.transactionHash, ...a.event }))

    return parentTokenAddress
      ? events.filter(
          log =>
            log.l1Token.toLocaleLowerCase() ===
            parentTokenAddress.toLocaleLowerCase()
        )
      : events
  }

  /**
   * Does the provided address look like a weth gateway
   * @param potentialWethGatewayAddress
   * @param parentProvider
   * @returns
   */
  private async looksLikeWethGateway(
    potentialWethGatewayAddress: string,
    parentProvider: Provider
  ) {
    try {
      const potentialWethGateway = L1WethGateway__factory.connect(
        potentialWethGatewayAddress,
        parentProvider
      )
      await potentialWethGateway.callStatic.l1Weth()
      return true
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as { code: ErrorCode }).code ===
          Logger.errors.CALL_EXCEPTION
      ) {
        return false
      } else {
        throw err
      }
    }
  }

  /**
   * Is this a known or unknown WETH gateway
   * @param gatewayAddress
   * @param parentProvider
   * @returns
   */
  private async isWethGateway(
    gatewayAddress: string,
    parentProvider: Provider
  ): Promise<boolean> {
    const wethAddress = this.childNetwork.tokenBridge.parentWethGateway
    if (this.childNetwork.isCustom) {
      // For custom network, we do an ad-hoc check to see if it's a WETH gateway
      if (await this.looksLikeWethGateway(gatewayAddress, parentProvider)) {
        return true
      }
      // ...otherwise we directly check it against the config file
    } else if (wethAddress === gatewayAddress) {
      return true
    }
    return false
  }

  /**
   * Get the child network token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesn't
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param childProvider
   * @param childTokenAddr
   * @returns
   */
  public getChildTokenContract(
    childProvider: Provider,
    childTokenAddr: string
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(childTokenAddr, childProvider)
  }

  /**
   * Get the parent token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesnt
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param parentProvider
   * @param parentTokenAddr
   * @returns
   */
  public getParentTokenContract(
    parentProvider: Provider,
    parentTokenAddr: string
  ): ERC20 {
    return ERC20__factory.connect(parentTokenAddr, parentProvider)
  }

  /**
   * Get the corresponding child network token address for the provided parent network token
   * @param erc20ParentAddress
   * @param parentProvider
   * @returns
   */
  public async getChildErc20Address(
    erc20ParentAddress: string,
    parentProvider: Provider
  ): Promise<string> {
    await this.checkParentNetwork(parentProvider)

    const parentGatewayRouter = L1GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.parentGatewayRouter,
      parentProvider
    )

    return await parentGatewayRouter.functions
      .calculateL2TokenAddress(erc20ParentAddress)
      .then(([res]) => res)
  }

  /**
   * Get the corresponding parent network address for the provided child network token
   * Validates the returned address against the child network router to ensure it is correctly mapped to the provided erc20ChildChainAddress
   * @param erc20ChildChainAddress
   * @param childProvider
   * @returns
   */
  public async getParentErc20Address(
    erc20ChildChainAddress: string,
    childProvider: Provider
  ): Promise<string> {
    await this.checkChildNetwork(childProvider)

    // child network WETH contract doesn't have the parentAddress method on it
    if (
      erc20ChildChainAddress.toLowerCase() ===
      this.childNetwork.tokenBridge.childWeth.toLowerCase()
    ) {
      return this.childNetwork.tokenBridge.parentWeth
    }

    const arbERC20 = L2GatewayToken__factory.connect(
      erc20ChildChainAddress,
      childProvider
    )
    const parentAddress = await arbERC20.functions
      .l1Address()
      .then(([res]) => res)

    // check that this l1 address is indeed registered to this child token
    const childGatewayRouter = L2GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.childGatewayRouter,
      childProvider
    )

    const childAddress = await childGatewayRouter.calculateL2TokenAddress(
      parentAddress
    )
    if (childAddress.toLowerCase() !== erc20ChildChainAddress.toLowerCase()) {
      throw new ArbSdkError(
        `Unexpected parent address. Parent address from token is not registered to the provided child address. ${parentAddress} ${childAddress} ${erc20ChildChainAddress}`
      )
    }

    return parentAddress
  }

  /**
   * Whether the token has been disabled on the router
   * @param parentTokenAddress
   * @param parentProvider
   * @returns
   */
  public async isDepositDisabled(
    parentTokenAddress: string,
    parentProvider: Provider
  ): Promise<boolean> {
    await this.checkParentNetwork(parentProvider)

    const parentGatewayRouter = L1GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.parentGatewayRouter,
      parentProvider
    )

    return (
      (await parentGatewayRouter.l1TokenToGateway(parentTokenAddress)) ===
      DISABLED_GATEWAY
    )
  }

  private applyDefaults<T extends DepositRequest>(
    params: T
  ): DefaultedDepositRequest {
    return {
      ...params,
      excessFeeRefundAddress: params.excessFeeRefundAddress || params.from,
      callValueRefundAddress: params.callValueRefundAddress || params.from,
      destinationAddress: params.destinationAddress || params.from,
    }
  }

  /**
   * Get the call value for the deposit transaction request
   * @param depositParams
   * @returns
   */
  private getDepositRequestCallValue(
    depositParams: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
  ) {
    // the call value should be zero when paying with a custom gas token,
    // as the fee amount is packed inside the last parameter (`data`) of the call to `outboundTransfer`, see `getDepositRequestOutboundTransferInnerData`
    if (!this.nativeTokenIsEth) {
      return constants.Zero
    }

    // we dont include the child call value for token deposits because
    // they either have 0 call value, or their call value is withdrawn from
    // a contract by the gateway (weth). So in both of these cases the child call value
    // is not actually deposited in the value field
    return depositParams.gasLimit
      .mul(depositParams.maxFeePerGas)
      .add(depositParams.maxSubmissionCost)
  }

  /**
   * Get the `data` param for call to `outboundTransfer`
   * @param depositParams
   * @returns
   */
  private getDepositRequestOutboundTransferInnerData(
    depositParams: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
  ) {
    if (!this.nativeTokenIsEth) {
      return defaultAbiCoder.encode(
        ['uint256', 'bytes', 'uint256'],
        [
          // maxSubmissionCost
          depositParams.maxSubmissionCost, // will be zero
          // callHookData
          '0x',
          // nativeTokenTotalFee
          depositParams.gasLimit
            .mul(depositParams.maxFeePerGas)
            .add(depositParams.maxSubmissionCost), // will be zero
        ]
      )
    }

    return defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        // maxSubmissionCost
        depositParams.maxSubmissionCost,
        // callHookData
        '0x',
      ]
    )
  }

  /**
   * Get the arguments for calling the deposit function
   * @param params
   * @returns
   */
  public async getDepositRequest(
    params: DepositRequest
  ): Promise<ParentToChildTransactionRequest> {
    await this.checkParentNetwork(params.parentProvider)
    await this.checkChildNetwork(params.childProvider)
    const defaultedParams = this.applyDefaults(params)
    const {
      amount,
      destinationAddress,
      erc20ParentAddress,
      parentProvider,
      childProvider,
      retryableGasOverrides,
    } = defaultedParams

    const parentGatewayAddress = await this.getParentGatewayAddress(
      erc20ParentAddress,
      parentProvider
    )
    let tokenGasOverrides: GasOverrides | undefined = retryableGasOverrides
    // we also add a hardcoded minimum gas limit for custom gateway deposits
    if (
      parentGatewayAddress === this.childNetwork.tokenBridge.parentCustomGateway
    ) {
      if (!tokenGasOverrides) tokenGasOverrides = {}
      if (!tokenGasOverrides.gasLimit) tokenGasOverrides.gasLimit = {}
      if (!tokenGasOverrides.gasLimit.min) {
        tokenGasOverrides.gasLimit.min =
          Erc20Bridger.MIN_CUSTOM_DEPOSIT_GAS_LIMIT
      }
    }

    const depositFunc = (
      depositParams: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
    ) => {
      depositParams.maxSubmissionCost =
        params.maxSubmissionCost || depositParams.maxSubmissionCost

      const iGatewayRouter = L1GatewayRouter__factory.createInterface()
      const innerData =
        this.getDepositRequestOutboundTransferInnerData(depositParams)

      const functionData =
        defaultedParams.excessFeeRefundAddress !== defaultedParams.from
          ? iGatewayRouter.encodeFunctionData('outboundTransferCustomRefund', [
              erc20ParentAddress,
              defaultedParams.excessFeeRefundAddress,
              destinationAddress,
              amount,
              depositParams.gasLimit,
              depositParams.maxFeePerGas,
              innerData,
            ])
          : iGatewayRouter.encodeFunctionData('outboundTransfer', [
              erc20ParentAddress,
              destinationAddress,
              amount,
              depositParams.gasLimit,
              depositParams.maxFeePerGas,
              innerData,
            ])

      return {
        data: functionData,
        to: this.childNetwork.tokenBridge.parentGatewayRouter,
        from: defaultedParams.from,
        value: this.getDepositRequestCallValue(depositParams),
      }
    }

    const gasEstimator = new ParentToChildMessageGasEstimator(childProvider)
    const estimates = await gasEstimator.populateFunctionParams(
      depositFunc,
      parentProvider,
      tokenGasOverrides
    )

    return {
      txRequest: {
        to: this.childNetwork.tokenBridge.parentGatewayRouter,
        data: estimates.data,
        value: estimates.value,
        from: params.from,
      },
      retryableData: {
        ...estimates.retryable,
        ...estimates.estimates,
      },
      isValid: async () => {
        const reEstimates = await gasEstimator.populateFunctionParams(
          depositFunc,
          parentProvider,
          tokenGasOverrides
        )
        return ParentToChildMessageGasEstimator.isValid(
          estimates.estimates,
          reEstimates.estimates
        )
      },
    }
  }

  /**
   * Execute a token deposit from parent to child network
   * @param params
   * @returns
   */
  public async deposit(
    params: Erc20DepositParams | ParentToChildTxReqAndSignerProvider
  ): Promise<ParentContractCallTransaction> {
    await this.checkParentNetwork(params.parentSigner)

    // Although the types prevent should alert callers that value is not
    // a valid override, it is possible that they pass it in anyway as it's a common override
    // We do a safety check here
    if ((params.overrides as PayableOverrides | undefined)?.value) {
      throw new ArbSdkError(
        'Parent call value should be set through `l1CallValue` param'
      )
    }

    const parentProvider = SignerProviderUtils.getProviderOrThrow(
      params.parentSigner
    )

    const erc20ParentAddress = isParentToChildTransactionRequest(params)
      ? getErc20ParentAddressFromParentToChildTxRequest(params)
      : params.erc20ParentAddress

    const isRegistered = await this.isRegistered({
      erc20ParentAddress,
      parentProvider,
      childProvider: params.childProvider,
    })

    if (!isRegistered) {
      const parentChainId = (await parentProvider.getNetwork()).chainId

      throw new Error(
        `Token ${erc20ParentAddress} on chain ${parentChainId} is not registered on the gateways`
      )
    }

    const tokenDeposit = isParentToChildTransactionRequest(params)
      ? params
      : await this.getDepositRequest({
          ...params,
          parentProvider,
          from: await params.parentSigner.getAddress(),
        })

    const tx = await params.parentSigner.sendTransaction({
      ...tokenDeposit.txRequest,
      ...params.overrides,
    })

    return ParentTransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  /**
   * Get the arguments for calling the token withdrawal function
   * @param params
   * @returns
   */
  public async getWithdrawalRequest(
    params: Erc20WithdrawParams
  ): Promise<ChildToParentTransactionRequest> {
    const to = params.destinationAddress

    const routerInterface = L2GatewayRouter__factory.createInterface()
    const functionData =
      // we need to do this since typechain doesnt seem to correctly create
      // encodeFunctionData for functions with overrides
      (
        routerInterface as unknown as {
          encodeFunctionData(
            functionFragment: 'outboundTransfer(address,address,uint256,bytes)',
            values: [string, string, BigNumberish, BytesLike]
          ): string
        }
      ).encodeFunctionData('outboundTransfer(address,address,uint256,bytes)', [
        params.erc20ParentAddress,
        to,
        params.amount,
        '0x',
      ])

    return {
      txRequest: {
        data: functionData,
        to: this.childNetwork.tokenBridge.childGatewayRouter,
        value: BigNumber.from(0),
        from: params.from,
      },
      // todo: do proper estimation
      estimateParentGasLimit: async (parentProvider: Provider) => {
        if (await isArbitrumChain(parentProvider)) {
          // values for L3 are dependent on the L1 base fee, so hardcoding can never be accurate
          // however, this is only an estimate used for display, so should be good enough
          //
          // measured with token withdrawals from Rari then added some padding
          return BigNumber.from(8_000_000)
        }

        const parentGatewayAddress = await this.getParentGatewayAddress(
          params.erc20ParentAddress,
          parentProvider
        )

        // The WETH gateway is the only deposit that requires callvalue in the Child user-tx (i.e., the recently un-wrapped ETH)
        // Here we check if this is a WETH deposit, and include the callvalue for the gas estimate query if so
        const isWeth = await this.isWethGateway(
          parentGatewayAddress,
          parentProvider
        )

        // measured 157421 - add some padding
        return isWeth ? BigNumber.from(190000) : BigNumber.from(160000)
      },
    }
  }

  /**
   * Withdraw tokens from child to parent network
   * @param params
   * @returns
   */
  public async withdraw(
    params:
      | (OmitTyped<Erc20WithdrawParams, 'from'> & { childSigner: Signer })
      | ChildToParentTxReqAndSigner
  ): Promise<ChildContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.childSigner)) {
      throw new MissingProviderArbSdkError('childSigner')
    }
    await this.checkChildNetwork(params.childSigner)

    const withdrawalRequest = isChildToParentTransactionRequest<
      OmitTyped<Erc20WithdrawParams, 'from'> & { childSigner: Signer }
    >(params)
      ? params
      : await this.getWithdrawalRequest({
          ...params,
          from: await params.childSigner.getAddress(),
        })

    const tx = await params.childSigner.sendTransaction({
      ...withdrawalRequest.txRequest,
      ...params.overrides,
    })
    return ChildTransactionReceipt.monkeyPatchWait(tx)
  }

  /**
   * Checks if the token has been properly registered on both gateways. Mostly useful for tokens that use a custom gateway.
   *
   * @param {Object} params
   * @param {string} params.erc20ParentAddress
   * @param {Provider} params.parentProvider
   * @param {Provider} params.childProvider
   * @returns
   */
  public async isRegistered({
    erc20ParentAddress,
    parentProvider,
    childProvider,
  }: {
    erc20ParentAddress: string
    parentProvider: Provider
    childProvider: Provider
  }) {
    const parentStandardGatewayAddressFromChainConfig =
      this.childNetwork.tokenBridge.parentErc20Gateway

    const parentGatewayAddressFromParentGatewayRouter =
      await this.getParentGatewayAddress(erc20ParentAddress, parentProvider)

    // token uses standard gateway; no need to check further
    if (
      parentStandardGatewayAddressFromChainConfig.toLowerCase() ===
      parentGatewayAddressFromParentGatewayRouter.toLowerCase()
    ) {
      return true
    }

    const childTokenAddressFromParentGatewayRouter =
      await this.getChildErc20Address(erc20ParentAddress, parentProvider)

    const childGatewayAddressFromChildRouter =
      await this.getChildGatewayAddress(erc20ParentAddress, childProvider)

    const childTokenAddressFromChildGateway =
      await L2ERC20Gateway__factory.connect(
        childGatewayAddressFromChildRouter,
        childProvider
      ).calculateL2TokenAddress(erc20ParentAddress)

    return (
      childTokenAddressFromParentGatewayRouter.toLowerCase() ===
      childTokenAddressFromChildGateway.toLowerCase()
    )
  }
}

/**
 * A token and gateway pair
 */
interface TokenAndGateway {
  tokenAddr: string
  gatewayAddr: string
}

/**
 * Admin functionality for the token bridge
 */
export class AdminErc20Bridger extends Erc20Bridger {
  private percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
    return num.add(num.mul(increase).div(100))
  }

  public getApproveGasTokenForCustomTokenRegistrationRequest(
    params: ProviderTokenApproveParams
  ): Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const iErc20Interface = ERC20__factory.createInterface()
    const data = iErc20Interface.encodeFunctionData('approve', [
      params.erc20ParentAddress,
      params.amount || Erc20Bridger.MAX_APPROVAL,
    ])

    return {
      data,
      value: BigNumber.from(0),
      to: this.nativeToken!,
    }
  }

  public async approveGasTokenForCustomTokenRegistration(
    params: ApproveParamsOrTxRequest
  ): Promise<ethers.ContractTransaction> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    await this.checkParentNetwork(params.parentSigner)

    const approveGasTokenRequest = this.isApproveParams(params)
      ? this.getApproveGasTokenForCustomTokenRegistrationRequest({
          ...params,
          parentProvider: SignerProviderUtils.getProviderOrThrow(
            params.parentSigner
          ),
        })
      : params.txRequest

    return params.parentSigner.sendTransaction({
      ...approveGasTokenRequest,
      ...params.overrides,
    })
  }

  /**
   * Register a custom token on the Arbitrum bridge
   * See https://developer.offchainlabs.com/docs/bridging_assets#the-arbitrum-generic-custom-gateway for more details
   * @param parentTokenAddress Address of the already deployed parent token. Must inherit from https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/tokenbridge/ethereum/icustomtoken.
   * @param childTokenAddress Address of the already deployed child token. Must inherit from https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/tokenbridge/arbitrum/iarbtoken.
   * @param parentSigner The signer with the rights to call `registerTokenOnL2` on the parent token
   * @param childProvider Arbitrum rpc provider
   * @returns
   */
  public async registerCustomToken(
    parentTokenAddress: string,
    childTokenAddress: string,
    parentSigner: Signer,
    childProvider: Provider
  ): Promise<ParentContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(parentSigner)) {
      throw new MissingProviderArbSdkError('parentSigner')
    }
    await this.checkParentNetwork(parentSigner)
    await this.checkChildNetwork(childProvider)

    const parentProvider = parentSigner.provider!
    const parentSenderAddress = await parentSigner.getAddress()

    const parentToken = ICustomToken__factory.connect(
      parentTokenAddress,
      parentSigner
    )
    const childToken = IArbToken__factory.connect(
      childTokenAddress,
      childProvider
    )

    // sanity checks
    await parentToken.deployed()
    await childToken.deployed()

    if (!this.nativeTokenIsEth) {
      const nativeTokenContract = ERC20__factory.connect(
        this.nativeToken!,
        parentProvider
      )
      const allowance = await nativeTokenContract.allowance(
        parentSenderAddress,
        parentToken.address
      )

      const maxFeePerGasOnChild = (await childProvider.getFeeData())
        .maxFeePerGas
      const maxFeePerGasOnChildWithBuffer = this.percentIncrease(
        maxFeePerGasOnChild!,
        BigNumber.from(500)
      )
      // hardcode gas limit to 60k
      const estimatedGasFee = BigNumber.from(60_000).mul(
        maxFeePerGasOnChildWithBuffer
      )

      if (allowance.lt(estimatedGasFee)) {
        throw new Error(
          `Insufficient allowance. Please increase spending for: owner - ${parentSenderAddress}, spender - ${parentToken.address}.`
        )
      }
    }

    const parentAddressFromChild = await childToken.l1Address()
    if (parentAddressFromChild !== parentTokenAddress) {
      throw new ArbSdkError(
        `child token does not have parent address set. Set address: ${parentAddressFromChild}, expected address: ${parentTokenAddress}.`
      )
    }

    type GasParams = {
      maxSubmissionCost: BigNumber
      gasLimit: BigNumber
    }
    const from = await parentSigner.getAddress()
    const encodeFuncData = (
      setTokenGas: GasParams,
      setGatewayGas: GasParams,
      maxFeePerGas: BigNumber
    ) => {
      // if we set maxFeePerGas to be the error triggering param then it will
      // always trigger for the setToken call and never make it ti setGateways
      // so we here we just use the gas limit to trigger retryable data
      const doubleFeePerGas = maxFeePerGas.eq(
        RetryableDataTools.ErrorTriggeringParams.maxFeePerGas
      )
        ? RetryableDataTools.ErrorTriggeringParams.maxFeePerGas.mul(2)
        : maxFeePerGas
      const setTokenDeposit = setTokenGas.gasLimit
        .mul(doubleFeePerGas)
        .add(setTokenGas.maxSubmissionCost)
      const setGatewayDeposit = setGatewayGas.gasLimit
        .mul(doubleFeePerGas)
        .add(setGatewayGas.maxSubmissionCost)

      const data = parentToken.interface.encodeFunctionData(
        'registerTokenOnL2',
        [
          childTokenAddress,
          setTokenGas.maxSubmissionCost,
          setGatewayGas.maxSubmissionCost,
          setTokenGas.gasLimit,
          setGatewayGas.gasLimit,
          doubleFeePerGas,
          setTokenDeposit,
          setGatewayDeposit,
          parentSenderAddress,
        ]
      )

      return {
        data,
        value: setTokenDeposit.add(setGatewayDeposit),
        to: parentToken.address,
        from,
      }
    }

    const gEstimator = new ParentToChildMessageGasEstimator(childProvider)
    const setTokenEstimates2 = await gEstimator.populateFunctionParams(
      (params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>) =>
        encodeFuncData(
          {
            gasLimit: params.gasLimit,
            maxSubmissionCost: params.maxSubmissionCost,
          },
          {
            gasLimit: RetryableDataTools.ErrorTriggeringParams.gasLimit,
            maxSubmissionCost: BigNumber.from(1),
          },
          params.maxFeePerGas
        ),
      parentProvider
    )

    const setGatewayEstimates2 = await gEstimator.populateFunctionParams(
      (params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>) =>
        encodeFuncData(
          {
            gasLimit: setTokenEstimates2.estimates.gasLimit,
            maxSubmissionCost: setTokenEstimates2.estimates.maxSubmissionCost,
          },
          {
            gasLimit: params.gasLimit,
            maxSubmissionCost: params.maxSubmissionCost,
          },
          params.maxFeePerGas
        ),
      parentProvider
    )

    const registerTx = await parentSigner.sendTransaction({
      to: parentToken.address,
      data: setGatewayEstimates2.data,
      value: setGatewayEstimates2.value,
    })

    return ParentTransactionReceipt.monkeyPatchWait(registerTx)
  }

  /**
   * Get all the gateway set events on the Parent gateway router
   * @param parentProvider The provider for the parent network
   * @param filter An object containing fromBlock and toBlock to filter events
   * @returns An array of GatewaySetEvent event arguments
   */
  public async getParentGatewaySetEvents(
    parentProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag }
  ): Promise<EventArgs<GatewaySetEvent>[]> {
    await this.checkParentNetwork(parentProvider)

    const parentGatewayRouterAddress =
      this.childNetwork.tokenBridge.parentGatewayRouter
    const eventFetcher = new EventFetcher(parentProvider)
    return (
      await eventFetcher.getEvents(
        L1GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        { ...filter, address: parentGatewayRouterAddress }
      )
    ).map(a => a.event)
  }

  /**
   * Get all the gateway set events on the child gateway router
   * @param childProvider The provider for the child network
   * @param filter An object containing fromBlock and toBlock to filter events
   * @param customNetworkChildGatewayRouter Optional address of the custom network child gateway router
   * @returns An array of GatewaySetEvent event arguments
   * @throws {ArbSdkError} If the network is custom and customNetworkChildGatewayRouter is not provided
   */
  public async getChildGatewaySetEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    customNetworkChildGatewayRouter?: string
  ): Promise<EventArgs<GatewaySetEvent>[]> {
    if (this.childNetwork.isCustom && !customNetworkChildGatewayRouter) {
      throw new ArbSdkError(
        'Must supply customNetworkChildGatewayRouter for custom network '
      )
    }
    await this.checkChildNetwork(childProvider)

    const childGatewayRouterAddress =
      customNetworkChildGatewayRouter ||
      this.childNetwork.tokenBridge.childGatewayRouter

    const eventFetcher = new EventFetcher(childProvider)
    return (
      await eventFetcher.getEvents(
        L2GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        { ...filter, address: childGatewayRouterAddress }
      )
    ).map(a => a.event)
  }

  /**
   * Register the provided token addresses against the provided gateways
   * @param parentSigner
   * @param childProvider
   * @param tokenGateways
   * @returns
   */
  public async setGateways(
    parentSigner: Signer,
    childProvider: Provider,
    tokenGateways: TokenAndGateway[],
    options?: GasOverrides
  ): Promise<ParentContractCallTransaction> {
    if (!SignerProviderUtils.signerHasProvider(parentSigner)) {
      throw new MissingProviderArbSdkError('parentSigner')
    }
    await this.checkParentNetwork(parentSigner)
    await this.checkChildNetwork(childProvider)

    const from = await parentSigner.getAddress()

    const parentGatewayRouter = L1GatewayRouter__factory.connect(
      this.childNetwork.tokenBridge.parentGatewayRouter,
      parentSigner
    )

    const setGatewaysFunc = (
      params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
    ) => {
      return {
        data: parentGatewayRouter.interface.encodeFunctionData('setGateways', [
          tokenGateways.map(tG => tG.tokenAddr),
          tokenGateways.map(tG => tG.gatewayAddr),
          params.gasLimit,
          params.maxFeePerGas,
          params.maxSubmissionCost,
        ]),
        from,
        value: params.gasLimit
          .mul(params.maxFeePerGas)
          .add(params.maxSubmissionCost),
        to: parentGatewayRouter.address,
      }
    }
    const gEstimator = new ParentToChildMessageGasEstimator(childProvider)
    const estimates = await gEstimator.populateFunctionParams(
      setGatewaysFunc,
      parentSigner.provider,
      options
    )

    const res = await parentSigner.sendTransaction({
      to: estimates.to,
      data: estimates.data,
      value: estimates.estimates.deposit,
    })

    return ParentTransactionReceipt.monkeyPatchContractCallWait(res)
  }
}
