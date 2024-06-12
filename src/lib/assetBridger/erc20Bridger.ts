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
import { ArbitrumNetwork, getArbitrumNetwork } from '../dataEntities/networks'
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

export interface TokenApproveParams {
  /**
   * Parent chain address of the ERC20 token contract
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
   * Parent chain address of the token ERC20 contract
   */
  erc20ParentAddress: string
  /**
   * Child chain address of the entity receiving the funds. Defaults to the l1FromAddress
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
   * Parent chain address of the token ERC20 contract
   */
  erc20ParentAddress: string
}

export type ParentToChildTxReqAndSignerProvider =
  ParentToChildTransactionRequest & {
    parentSigner: Signer
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

  /**
   * Bridger for moving ERC20 tokens back and forth between parent-to-child
   */
  public constructor(childChain: ArbitrumNetwork) {
    super(childChain)
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
   * Get the address of the l1 gateway for this token
   * @param erc20ParentAddress
   * @param parentProvider
   * @returns
   */
  public async getL1GatewayAddress(
    erc20ParentAddress: string,
    parentProvider: Provider
  ): Promise<string> {
    await this.checkParentChain(parentProvider)

    return await L1GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l1GatewayRouter,
      parentProvider
    ).getGateway(erc20ParentAddress)
  }

  /**
   * Get the address of the l2 gateway for this token
   * @param erc20ParentAddress
   * @param childProvider
   * @returns
   */
  public async getL2GatewayAddress(
    erc20ParentAddress: string,
    childProvider: Provider
  ): Promise<string> {
    await this.checkChildChain(childProvider)

    return await L2GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l2GatewayRouter,
      childProvider
    ).getGateway(erc20ParentAddress)
  }

  /**
   * Creates a transaction request for approving the custom gas token to be spent by the relevant gateway on the parent chain
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
   * Approves the custom gas token to be spent by the relevant gateway on the parent chain
   * @param params
   */
  public async approveGasToken(
    params: ApproveParamsOrTxRequest
  ): Promise<ethers.ContractTransaction> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    await this.checkParentChain(params.parentSigner)

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
    const gatewayAddress = await this.getL1GatewayAddress(
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
    await this.checkParentChain(params.parentSigner)

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
   * Get the child chain events created by a withdrawal
   * @param childProvider
   * @param gatewayAddress
   * @param parentTokenAddress
   * @param fromAddress
   * @param filter
   * @returns
   */
  public async getL2WithdrawalEvents(
    childProvider: Provider,
    gatewayAddress: string,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    parentTokenAddress?: string,
    fromAddress?: string,
    toAddress?: string
  ): Promise<(EventArgs<WithdrawalInitiatedEvent> & { txHash: string })[]> {
    await this.checkChildChain(childProvider)

    const eventFetcher = new EventFetcher(childProvider)
    const events = (
      await eventFetcher.getEvents(
        L2ArbitrumGateway__factory,
        contract =>
          contract.filters.WithdrawalInitiated(
            null, // l1Token
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
    const wethAddress = this.childChain.tokenBridge.l1WethGateway
    if (this.childChain.isCustom) {
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
   * Get the child chain token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesnt
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param childProvider
   * @param l2TokenAddr
   * @returns
   */
  public getChildTokenContract(
    childProvider: Provider,
    l2TokenAddr: string
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(l2TokenAddr, childProvider)
  }

  /**
   * Get the L1 token contract at the provided address
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
   * Get the corresponding child chain token address for the provided parent chain token
   * @param erc20ParentAddress
   * @param parentProvider
   * @returns
   */
  public async getChildERC20Address(
    erc20ParentAddress: string,
    parentProvider: Provider
  ): Promise<string> {
    await this.checkParentChain(parentProvider)

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l1GatewayRouter,
      parentProvider
    )

    return await l1GatewayRouter.functions
      .calculateL2TokenAddress(erc20ParentAddress)
      .then(([res]) => res)
  }

  /**
   * Get the corresponding parent chain address for the provided child chain token
   * Validates the returned address against the child chain router to ensure it is correctly mapped to the provided erc20ChildChainAddress
   * @param erc20ChildChainAddress
   * @param childProvider
   * @returns
   */
  public async getParentERC20Address(
    erc20ChildChainAddress: string,
    childProvider: Provider
  ): Promise<string> {
    await this.checkChildChain(childProvider)

    // child chain WETH contract doesn't have the l1Address method on it
    if (
      erc20ChildChainAddress.toLowerCase() ===
      this.childChain.tokenBridge.l2Weth.toLowerCase()
    ) {
      return this.childChain.tokenBridge.l1Weth
    }

    const arbERC20 = L2GatewayToken__factory.connect(
      erc20ChildChainAddress,
      childProvider
    )
    const l1Address = await arbERC20.functions.l1Address().then(([res]) => res)

    // check that this l1 address is indeed registered to this child token
    const l2GatewayRouter = L2GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l2GatewayRouter,
      childProvider
    )

    const l2Address = await l2GatewayRouter.calculateL2TokenAddress(l1Address)
    if (l2Address.toLowerCase() !== erc20ChildChainAddress.toLowerCase()) {
      throw new ArbSdkError(
        `Unexpected l1 address. L1 address from token is not registered to the provided l2 address. ${l1Address} ${l2Address} ${erc20ChildChainAddress}`
      )
    }

    return l1Address
  }

  /**
   * Whether the token has been disabled on the router
   * @param parentTokenAddress
   * @param parentProvider
   * @returns
   */
  public async parentTokenIsDisabled(
    parentTokenAddress: string,
    parentProvider: Provider
  ): Promise<boolean> {
    await this.checkParentChain(parentProvider)

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l1GatewayRouter,
      parentProvider
    )

    return (
      (await l1GatewayRouter.l1TokenToGateway(parentTokenAddress)) ===
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

    // we dont include the l2 call value for token deposits because
    // they either have 0 call value, or their call value is withdrawn from
    // a contract by the gateway (weth). So in both of these cases the l2 call value
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
    await this.checkParentChain(params.parentProvider)
    await this.checkChildChain(params.childProvider)
    const defaultedParams = this.applyDefaults(params)
    const {
      amount,
      destinationAddress,
      erc20ParentAddress,
      parentProvider,
      childProvider,
      retryableGasOverrides,
    } = defaultedParams

    const l1GatewayAddress = await this.getL1GatewayAddress(
      erc20ParentAddress,
      parentProvider
    )
    let tokenGasOverrides: GasOverrides | undefined = retryableGasOverrides
    // we also add a hardcoded minimum gas limit for custom gateway deposits
    if (l1GatewayAddress === this.childChain.tokenBridge.l1CustomGateway) {
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
        to: this.childChain.tokenBridge.l1GatewayRouter,
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
        to: this.childChain.tokenBridge.l1GatewayRouter,
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
   * Execute a token deposit from parent to child chain
   * @param params
   * @returns
   */
  public async deposit(
    params: Erc20DepositParams | ParentToChildTxReqAndSignerProvider
  ): Promise<ParentContractCallTransaction> {
    await this.checkParentChain(params.parentSigner)

    // Although the types prevent should alert callers that value is not
    // a valid override, it is possible that they pass it in anyway as it's a common override
    // We do a safety check here
    if ((params.overrides as PayableOverrides | undefined)?.value) {
      throw new ArbSdkError(
        'L1 call value should be set through l1CallValue param'
      )
    }

    const parentProvider = SignerProviderUtils.getProviderOrThrow(
      params.parentSigner
    )

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
        to: this.childChain.tokenBridge.l2GatewayRouter,
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

        const l1GatewayAddress = await this.getL1GatewayAddress(
          params.erc20ParentAddress,
          parentProvider
        )

        // The WETH gateway is the only deposit that requires callvalue in the L2 user-tx (i.e., the recently un-wrapped ETH)
        // Here we check if this is a WETH deposit, and include the callvalue for the gas estimate query if so
        const isWeth = await this.isWethGateway(
          l1GatewayAddress,
          parentProvider
        )

        // measured 157421 - add some padding
        return isWeth ? BigNumber.from(190000) : BigNumber.from(160000)
      },
    }
  }

  /**
   * Withdraw tokens from child to parent chain
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
    await this.checkChildChain(params.childSigner)

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

    await this.checkParentChain(params.parentSigner)

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
   * @param parentSigner The signer with the rights to call registerTokenOnL2 on the parent token
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
    await this.checkParentChain(parentSigner)
    await this.checkChildChain(childProvider)

    const parentProvider = parentSigner.provider!
    const l1SenderAddress = await parentSigner.getAddress()

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
        l1SenderAddress,
        parentToken.address
      )

      const maxFeePerGasOnL2 = (await childProvider.getFeeData()).maxFeePerGas
      const maxFeePerGasOnL2WithBuffer = this.percentIncrease(
        maxFeePerGasOnL2!,
        BigNumber.from(500)
      )
      // hardcode gas limit to 60k
      const estimatedGasFee = BigNumber.from(60_000).mul(
        maxFeePerGasOnL2WithBuffer
      )

      if (allowance.lt(estimatedGasFee)) {
        throw new Error(
          `Insufficient allowance. Please increase spending for: owner - ${l1SenderAddress}, spender - ${parentToken.address}.`
        )
      }
    }

    const l1AddressFromL2 = await childToken.l1Address()
    if (l1AddressFromL2 !== parentTokenAddress) {
      throw new ArbSdkError(
        `L2 token does not have l1 address set. Set address: ${l1AddressFromL2}, expected address: ${parentTokenAddress}.`
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
          l1SenderAddress,
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
   * Get all the gateway set events on the L1 gateway router
   * @param parentProvider
   * @param customNetworkL1GatewayRouter
   * @returns
   */
  public async getL1GatewaySetEvents(
    parentProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag }
  ): Promise<EventArgs<GatewaySetEvent>[]> {
    await this.checkParentChain(parentProvider)

    const l1GatewayRouterAddress = this.childChain.tokenBridge.l1GatewayRouter
    const eventFetcher = new EventFetcher(parentProvider)
    return (
      await eventFetcher.getEvents(
        L1GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        { ...filter, address: l1GatewayRouterAddress }
      )
    ).map(a => a.event)
  }

  /**
   * Get all the gateway set events on the L2 gateway router
   * @param parentProvider
   * @param customNetworkL1GatewayRouter
   * @returns
   */
  public async getL2GatewaySetEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    customNetworkL2GatewayRouter?: string
  ): Promise<EventArgs<GatewaySetEvent>[]> {
    if (this.childChain.isCustom && !customNetworkL2GatewayRouter) {
      throw new ArbSdkError(
        'Must supply customNetworkL2GatewayRouter for custom network '
      )
    }
    await this.checkChildChain(childProvider)

    const l2GatewayRouterAddress =
      customNetworkL2GatewayRouter ||
      this.childChain.tokenBridge.l2GatewayRouter

    const eventFetcher = new EventFetcher(childProvider)
    return (
      await eventFetcher.getEvents(
        L1GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        { ...filter, address: l2GatewayRouterAddress }
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
    await this.checkParentChain(parentSigner)
    await this.checkChildChain(childProvider)

    const from = await parentSigner.getAddress()

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.childChain.tokenBridge.l1GatewayRouter,
      parentSigner
    )

    const setGatewaysFunc = (
      params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
    ) => {
      return {
        data: l1GatewayRouter.interface.encodeFunctionData('setGateways', [
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
        to: l1GatewayRouter.address,
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
