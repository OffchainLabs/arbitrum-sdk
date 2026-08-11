/**
 * Compat layer: EthBridger class
 *
 * Backwards-compatible class-based facade that delegates to
 * the new functional API from @arbitrum/core.
 */
import { Signer } from '@ethersproject/abstract-signer'
import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { BigNumber, constants, ContractTransaction } from 'ethers'

import {
  getDepositRequest as coreGetDepositRequest,
  getWithdrawalRequest as coreGetWithdrawalRequest,
  getApproveGasTokenRequest as coreGetApproveGasTokenRequest,
} from '@arbitrum/core'

import {
  ArbitrumNetwork,
  isArbitrumNetworkNativeTokenEther,
  getArbitrumNetwork,
} from '../lib/dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../lib/dataEntities/signerOrProvider'
import {
  ParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
} from '../lib/dataEntities/transactionRequest'
import { MissingProviderArbSdkError } from '../lib/dataEntities/errors'
import { ParentTransactionReceipt } from '../lib/message/ParentTransaction'
import { ChildTransactionReceipt } from '../lib/message/ChildTransaction'
import { OmitTyped } from '../lib/utils/types'

import type {
  ParentEthDepositTransaction,
  ParentContractCallTransaction,
} from '../lib/message/ParentTransaction'
import type { ChildContractTransaction } from '../lib/message/ChildTransaction'

export type ApproveGasTokenParams = {
  amount?: BigNumber
  overrides?: PayableOverrides
}

export type ApproveGasTokenTxRequest = {
  txRequest: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>
  overrides?: Overrides
}

export type ApproveGasTokenParamsOrTxRequest =
  | ApproveGasTokenParams
  | ApproveGasTokenTxRequest

type WithParentSigner<T extends ApproveGasTokenParamsOrTxRequest> = T & {
  parentSigner: Signer
}

export interface EthWithdrawParams {
  amount: BigNumber
  destinationAddress: string
  from: string
  overrides?: PayableOverrides
}

export type EthDepositParams = {
  parentSigner: Signer
  amount: BigNumber
  overrides?: PayableOverrides
}

export type EthDepositToParams = EthDepositParams & {
  childProvider: Provider
  destinationAddress: string
  retryableGasOverrides?: any
}

export type ParentToChildTxReqAndSigner = ParentToChildTransactionRequest & {
  parentSigner: Signer
  overrides?: Overrides
}

export type ChildToParentTxReqAndSigner = ChildToParentTransactionRequest & {
  childSigner: Signer
  overrides?: Overrides
}

type EthDepositRequestParams = OmitTyped<
  EthDepositParams,
  'overrides' | 'parentSigner'
> & { from: string }

export class EthBridger {
  public readonly childNetwork: ArbitrumNetwork
  public readonly nativeToken?: string

  constructor(childNetwork: ArbitrumNetwork) {
    this.childNetwork = childNetwork
    this.nativeToken = childNetwork.nativeToken
  }

  public static async fromProvider(
    childProvider: Provider
  ): Promise<EthBridger> {
    return new EthBridger(await getArbitrumNetwork(childProvider))
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

  private isApproveGasTokenParams(
    params: ApproveGasTokenParamsOrTxRequest
  ): params is WithParentSigner<ApproveGasTokenParams> {
    return typeof (params as ApproveGasTokenTxRequest).txRequest === 'undefined'
  }

  /**
   * Creates a transaction request for approving the custom gas token
   * to be spent by the inbox on the parent network.
   */
  public getApproveGasTokenRequest(
    params?: ApproveGasTokenParams
  ): Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const coreResult = coreGetApproveGasTokenRequest({
      network: this.childNetwork,
      amount: params?.amount ? params.amount.toBigInt() : undefined,
      from: '0x0000000000000000000000000000000000000000',
    })

    return {
      to: coreResult.to,
      data: coreResult.data,
      value: BigNumber.from(coreResult.value),
    }
  }

  /**
   * Approves the custom gas token to be spent by the inbox on the parent network.
   */
  public async approveGasToken(
    params: WithParentSigner<ApproveGasTokenParamsOrTxRequest>
  ): Promise<ContractTransaction> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const approveGasTokenRequest = this.isApproveGasTokenParams(params)
      ? this.getApproveGasTokenRequest(params)
      : params.txRequest

    return params.parentSigner.sendTransaction({
      ...approveGasTokenRequest,
      ...params.overrides,
    })
  }

  /**
   * Gets tx request for depositing ETH or custom gas token.
   */
  public async getDepositRequest(
    params: EthDepositRequestParams
  ): Promise<OmitTyped<ParentToChildTransactionRequest, 'retryableData'>> {
    const coreResult = coreGetDepositRequest({
      network: this.childNetwork,
      amount: params.amount.toBigInt(),
      from: params.from,
    })

    return {
      txRequest: {
        to: coreResult.to,
        data: coreResult.data,
        value: BigNumber.from(coreResult.value),
        from: coreResult.from || params.from,
      },
      isValid: async () => true,
    }
  }

  /**
   * Deposit ETH from parent onto child network.
   */
  public async deposit(
    params: EthDepositParams | ParentToChildTxReqAndSigner
  ): Promise<ParentEthDepositTransaction> {
    await this.checkParentNetwork(params.parentSigner)

    const ethDeposit = isParentToChildTransactionRequest(params)
      ? params
      : await this.getDepositRequest({
          ...params,
          from: await params.parentSigner.getAddress(),
        })

    const tx = await params.parentSigner.sendTransaction({
      ...ethDeposit.txRequest,
      ...params.overrides,
    })

    return ParentTransactionReceipt.monkeyPatchEthDepositWait(tx)
  }

  /**
   * Get a transaction request for an ETH deposit to a different child
   * network address using Retryables.
   */
  public async getDepositToRequest(
    params: OmitTyped<EthDepositToParams, 'overrides' | 'parentSigner'> & {
      parentProvider: Provider
      from: string
    }
  ): Promise<ParentToChildTransactionRequest> {
    // Delegate to the old ParentToChildMessageCreator for retryable ticket creation
    const { ParentToChildMessageCreator } = await import(
      '../lib/message/ParentToChildMessageCreator'
    )

    const requestParams = {
      ...params,
      to: params.destinationAddress,
      l2CallValue: params.amount,
      callValueRefundAddress: params.destinationAddress,
      data: '0x',
    }

    return ParentToChildMessageCreator.getTicketCreationRequest(
      requestParams,
      params.parentProvider,
      params.childProvider,
      params.retryableGasOverrides
    )
  }

  /**
   * Deposit ETH from parent network onto a different child network address.
   */
  public async depositTo(
    params:
      | EthDepositToParams
      | (ParentToChildTxReqAndSigner & { childProvider: Provider })
  ): Promise<ParentContractCallTransaction> {
    await this.checkParentNetwork(params.parentSigner)
    await this.checkChildNetwork(params.childProvider)

    const { ParentToChildMessageCreator } = await import(
      '../lib/message/ParentToChildMessageCreator'
    )

    const retryableTicketRequest = isParentToChildTransactionRequest(params)
      ? params
      : await this.getDepositToRequest({
          ...params,
          from: await params.parentSigner.getAddress(),
          parentProvider: params.parentSigner.provider!,
        })

    const parentToChildMessageCreator = new ParentToChildMessageCreator(
      params.parentSigner
    )

    const tx = await parentToChildMessageCreator.createRetryableTicket(
      retryableTicketRequest,
      params.childProvider
    )

    return ParentTransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  /**
   * Get a transaction request for an ETH withdrawal.
   */
  public async getWithdrawalRequest(
    params: EthWithdrawParams
  ): Promise<ChildToParentTransactionRequest> {
    const coreResult = coreGetWithdrawalRequest({
      network: this.childNetwork,
      amount: params.amount.toBigInt(),
      destinationAddress: params.destinationAddress,
      from: params.from,
    })

    return {
      txRequest: {
        to: coreResult.to,
        data: coreResult.data,
        value: BigNumber.from(coreResult.value),
        from: coreResult.from || params.from,
      },
      estimateParentGasLimit: async (_parentProvider: Provider) => {
        return BigNumber.from(130000)
      },
    }
  }

  /**
   * Withdraw ETH from child network onto parent network.
   */
  public async withdraw(
    params:
      | (EthWithdrawParams & { childSigner: Signer })
      | ChildToParentTxReqAndSigner
  ): Promise<ChildContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.childSigner)) {
      throw new MissingProviderArbSdkError('childSigner')
    }
    await this.checkChildNetwork(params.childSigner)

    const request = isChildToParentTransactionRequest<
      EthWithdrawParams & { childSigner: Signer }
    >(params)
      ? params
      : await this.getWithdrawalRequest(params)

    const tx = await params.childSigner.sendTransaction({
      ...request.txRequest,
      ...params.overrides,
    })
    return ChildTransactionReceipt.monkeyPatchWait(tx)
  }
}
