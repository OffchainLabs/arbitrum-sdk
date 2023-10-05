import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import {
  GasOverrides,
  L1ToL2MessageGasEstimator as ParentToChildMessageGasEstimator,
} from './L1ToL2MessageGasEstimator'
import { L1ContractTransaction, L1TransactionReceipt } from './L1Transaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { getChainNetwork } from '../dataEntities/networks'
import { PayableOverrides } from '@ethersproject/contracts'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getBaseFee } from '../utils/lib'
import {
  isL1ToL2TransactionRequest as isParentToChildTransactionRequest,
  L1ToL2TransactionRequest as ParentToChildTransactionRequest,
} from '../dataEntities/transactionRequest'
import { RetryableData } from '../dataEntities/retryableData'
import { OmitTyped, PartialPick } from '../utils/types'

type ParentToChildGasKeys =
  | 'maxSubmissionCost'
  | 'maxFeePerGas'
  | 'gasLimit'
  | 'deposit'
export type ParentToChildMessageGasParams = Pick<
  RetryableData,
  ParentToChildGasKeys
>
export type ParentToChildMessageNoGasParams = OmitTyped<
  RetryableData,
  ParentToChildGasKeys
>
export type ParentToChildMessageParams = PartialPick<
  ParentToChildMessageNoGasParams,
  'excessFeeRefundAddress' | 'callValueRefundAddress'
>

/**
 * Creates retryable tickets by directly calling the Inbox contract on L1
 */
export class ParentToChildMessageCreator {
  constructor(public readonly l1Signer: Signer) {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
  }

  /**
   * Gets a current estimate for the supplied params
   * @param params
   * @param l1Provider
   * @param l2Provider
   * @param retryableGasOverrides
   * @returns
   */
  protected static async getTicketEstimate(
    params: ParentToChildMessageNoGasParams,
    l1Provider: Provider,
    l2Provider: Provider,
    retryableGasOverrides?: GasOverrides
  ): Promise<Pick<RetryableData, ParentToChildGasKeys>> {
    const baseFee = await getBaseFee(l1Provider)

    const gasEstimator = new ParentToChildMessageGasEstimator(l2Provider)
    return await gasEstimator.estimateAll(
      params,
      baseFee,
      l1Provider,
      retryableGasOverrides
    )
  }

  /**
   * Generate a transaction request for creating a retryable ticket
   * @param params
   * @param l1Provider
   * @param l2Provider
   * @param options
   * @returns
   */
  public static async getTicketCreationRequest(
    params: ParentToChildMessageParams,
    l1Provider: Provider,
    l2Provider: Provider,
    options?: GasOverrides
  ): Promise<ParentToChildTransactionRequest> {
    const excessFeeRefundAddress = params.excessFeeRefundAddress || params.from
    const callValueRefundAddress = params.callValueRefundAddress || params.from

    const parsedParams: ParentToChildMessageNoGasParams = {
      ...params,
      excessFeeRefundAddress,
      callValueRefundAddress,
    }

    const estimates = await ParentToChildMessageCreator.getTicketEstimate(
      parsedParams,
      l1Provider,
      l2Provider,
      options
    )

    const l2Network = await getChainNetwork(l2Provider)
    const inboxInterface = Inbox__factory.createInterface()
    const functionData = inboxInterface.encodeFunctionData(
      'createRetryableTicket',
      [
        params.to,
        params.l2CallValue,
        estimates.maxSubmissionCost,
        excessFeeRefundAddress,
        callValueRefundAddress,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        params.data,
      ]
    )

    return {
      txRequest: {
        to: l2Network.ethBridge.inbox,
        data: functionData,
        value: estimates.deposit,
        from: params.from,
      },
      retryableData: {
        data: params.data,
        from: params.from,
        to: params.to,
        excessFeeRefundAddress: excessFeeRefundAddress,
        callValueRefundAddress: callValueRefundAddress,
        l2CallValue: params.l2CallValue,
        maxSubmissionCost: estimates.maxSubmissionCost,
        maxFeePerGas: estimates.maxFeePerGas,
        gasLimit: estimates.gasLimit,
        deposit: estimates.deposit,
      },
      isValid: async () => {
        const reEstimates = await ParentToChildMessageCreator.getTicketEstimate(
          parsedParams,
          l1Provider,
          l2Provider,
          options
        )
        return ParentToChildMessageGasEstimator.isValid(estimates, reEstimates)
      },
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on L1
   */
  public async createRetryableTicket(
    params:
      | (ParentToChildMessageParams & { overrides?: PayableOverrides })
      | (ParentToChildTransactionRequest & { overrides?: PayableOverrides }),
    l2Provider: Provider,
    options?: GasOverrides
  ): Promise<L1ContractTransaction> {
    const l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)
    const createRequest = isParentToChildTransactionRequest(params)
      ? params
      : await ParentToChildMessageCreator.getTicketCreationRequest(
          params,
          l1Provider,
          l2Provider,
          options
        )

    const tx = await this.l1Signer.sendTransaction({
      ...createRequest.txRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchWait(tx)
  }
}
