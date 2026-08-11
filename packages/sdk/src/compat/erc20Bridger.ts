/**
 * Compat layer: Erc20Bridger + AdminErc20Bridger
 *
 * Backwards-compatible class-based facades that delegate to the
 * old SDK lib implementations. We re-export the original classes
 * so that the compat layer exposes the same API surface.
 */
import { Signer } from '@ethersproject/abstract-signer'
import {
  Provider,
  BlockTag,
  TransactionRequest,
} from '@ethersproject/abstract-provider'
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { BigNumber, BigNumberish, ethers, BytesLike, constants } from 'ethers'

import {
  ArbitrumNetwork,
  TokenBridge,
  assertArbitrumNetworkHasTokenBridge,
  getArbitrumNetwork,
  isArbitrumNetworkNativeTokenEther,
} from '../lib/dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../lib/dataEntities/signerOrProvider'
import {
  ArbSdkError,
  MissingProviderArbSdkError,
} from '../lib/dataEntities/errors'
import {
  ParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
} from '../lib/dataEntities/transactionRequest'

import { L1GatewayRouter__factory } from '../lib/abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../lib/abi/factories/L2GatewayRouter__factory'
import { L2ArbitrumGateway__factory } from '../lib/abi/factories/L2ArbitrumGateway__factory'
import { ERC20__factory } from '../lib/abi/factories/ERC20__factory'
import { L2GatewayToken__factory } from '../lib/abi/factories/L2GatewayToken__factory'
import type { ERC20 } from '../lib/abi/ERC20'
import type { L2GatewayToken } from '../lib/abi/L2GatewayToken'
import type { WithdrawalInitiatedEvent } from '../lib/abi/L2ArbitrumGateway'
import type { GasOverrides } from '../lib/message/ParentToChildMessageGasEstimator'
import {
  ParentContractCallTransaction,
  ParentContractTransaction,
  ParentTransactionReceipt,
} from '../lib/message/ParentTransaction'
import {
  ChildContractTransaction,
  ChildTransactionReceipt,
} from '../lib/message/ChildTransaction'
import { EventFetcher, FetchedEvent } from '../lib/utils/eventFetcher'
import { OmitTyped, RequiredPick } from '../lib/utils/types'
import { EventArgs } from '../lib/dataEntities/event'
import { DISABLED_GATEWAY } from '../lib/dataEntities/constants'
import { isArbitrumChain } from '../lib/utils/lib'

export interface TokenApproveParams {
  erc20ParentAddress: string
  amount?: BigNumber
  overrides?: PayableOverrides
}

export interface Erc20DepositParams {
  parentSigner: Signer
  amount: BigNumber
  childProvider: Provider
  erc20ParentAddress: string
  destinationAddress?: string
  maxSubmissionCost?: BigNumber
  excessFeeRefundAddress?: string
  callValueRefundAddress?: string
  retryableGasOverrides?: GasOverrides
  overrides?: Overrides
}

export interface Erc20WithdrawParams {
  amount: BigNumber
  destinationAddress: string
  from: string
  erc20ParentAddress: string
  overrides?: PayableOverrides
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

type DepositRequest = OmitTyped<
  Erc20DepositParams,
  'overrides' | 'parentSigner'
> & {
  parentProvider: Provider
  from: string
}

export class Erc20Bridger {
  public static MAX_APPROVAL: BigNumber = BigNumber.from(
    ethers.constants.MaxUint256
  )
  public static MIN_CUSTOM_DEPOSIT_GAS_LIMIT = BigNumber.from(275000)

  public readonly childNetwork: ArbitrumNetwork & {
    tokenBridge: TokenBridge
  }

  public readonly nativeToken?: string

  public constructor(childNetwork: ArbitrumNetwork) {
    assertArbitrumNetworkHasTokenBridge(childNetwork)
    this.childNetwork = childNetwork as ArbitrumNetwork & {
      tokenBridge: TokenBridge
    }
    this.nativeToken = childNetwork.nativeToken
  }

  public static async fromProvider(
    childProvider: Provider
  ): Promise<Erc20Bridger> {
    return new Erc20Bridger(await getArbitrumNetwork(childProvider))
  }

  protected get nativeTokenIsEth(): boolean {
    return isArbitrumNetworkNativeTokenEther(this.childNetwork)
  }

  protected async checkParentNetwork(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(
      sop,
      this.childNetwork.parentChainId
    )
  }

  protected async checkChildNetwork(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(
      sop,
      this.childNetwork.chainId
    )
  }

  protected isApproveParams(
    params: ApproveParamsOrTxRequest
  ): params is SignerTokenApproveParams {
    return (params as SignerTokenApproveParams).erc20ParentAddress != undefined
  }

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

  public async getApproveTokenRequest(
    params: ProviderTokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
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
            null,
            fromAddress || null,
            toAddress || null
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

  public getChildTokenContract(
    childProvider: Provider,
    childTokenAddr: string
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(childTokenAddr, childProvider)
  }

  public getParentTokenContract(
    parentProvider: Provider,
    parentTokenAddr: string
  ): ERC20 {
    return ERC20__factory.connect(parentTokenAddr, parentProvider)
  }

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

  public async getParentErc20Address(
    erc20ChildChainAddress: string,
    childProvider: Provider
  ): Promise<string> {
    await this.checkChildNetwork(childProvider)

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

  public async getWithdrawalRequest(
    params: Erc20WithdrawParams
  ): Promise<ChildToParentTransactionRequest> {
    const to = params.destinationAddress

    const routerInterface = L2GatewayRouter__factory.createInterface()
    const functionData = (
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
      estimateParentGasLimit: async (parentProvider: Provider) => {
        if (await isArbitrumChain(parentProvider)) {
          return BigNumber.from(8_000_000)
        }
        return BigNumber.from(160000)
      },
    }
  }

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
   * Execute a token deposit from parent to child network.
   * This delegates to the original implementation via dynamic import
   * since the full deposit flow requires gas estimation against live providers.
   */
  public async deposit(
    params: Erc20DepositParams | ParentToChildTxReqAndSignerProvider
  ): Promise<ParentContractCallTransaction> {
    await this.checkParentNetwork(params.parentSigner)

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
   * Get the deposit request. This requires live provider calls for gas estimation.
   */
  public async getDepositRequest(
    params: DepositRequest
  ): Promise<ParentToChildTransactionRequest> {
    // Delegate to the original lib implementation which has the full gas estimation logic
    const { Erc20Bridger: OriginalBridger } = await import(
      '../lib/assetBridger/erc20Bridger'
    )
    const original = new OriginalBridger(this.childNetwork)
    return original.getDepositRequest(params)
  }

  public async getApproveGasTokenRequest(
    params: ProviderTokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }
    const txRequest = await this.getApproveTokenRequest(params)
    return { ...txRequest, to: this.nativeToken! }
  }

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
}

interface TokenAndGateway {
  tokenAddr: string
  gatewayAddr: string
}

export class AdminErc20Bridger extends Erc20Bridger {
  /**
   * Register a custom token on the Arbitrum bridge.
   * Delegates to the original AdminErc20Bridger implementation.
   */
  public async registerCustomToken(
    parentTokenAddress: string,
    childTokenAddress: string,
    parentSigner: Signer,
    childProvider: Provider
  ): Promise<ParentContractTransaction> {
    const { AdminErc20Bridger: OriginalAdmin } = await import(
      '../lib/assetBridger/erc20Bridger'
    )
    const original = new OriginalAdmin(this.childNetwork)
    return original.registerCustomToken(
      parentTokenAddress,
      childTokenAddress,
      parentSigner,
      childProvider
    )
  }

  /**
   * Set gateways for token addresses.
   * Delegates to the original AdminErc20Bridger implementation.
   */
  public async setGateways(
    parentSigner: Signer,
    childProvider: Provider,
    tokenGateways: TokenAndGateway[],
    options?: GasOverrides
  ): Promise<ParentContractCallTransaction> {
    const { AdminErc20Bridger: OriginalAdmin } = await import(
      '../lib/assetBridger/erc20Bridger'
    )
    const original = new OriginalAdmin(this.childNetwork)
    return original.setGateways(
      parentSigner,
      childProvider,
      tokenGateways,
      options
    )
  }

  public async getParentGatewaySetEvents(
    parentProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag }
  ): Promise<any[]> {
    const { AdminErc20Bridger: OriginalAdmin } = await import(
      '../lib/assetBridger/erc20Bridger'
    )
    const original = new OriginalAdmin(this.childNetwork)
    return original.getParentGatewaySetEvents(parentProvider, filter)
  }

  public async getChildGatewaySetEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    customNetworkChildGatewayRouter?: string
  ): Promise<any[]> {
    const { AdminErc20Bridger: OriginalAdmin } = await import(
      '../lib/assetBridger/erc20Bridger'
    )
    const original = new OriginalAdmin(this.childNetwork)
    return original.getChildGatewaySetEvents(
      childProvider,
      filter,
      customNetworkChildGatewayRouter
    )
  }
}
