import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import {
  GasOverrides,
  L1ToL2MessageGasEstimator,
} from './L1ToL2MessageGasEstimator'
import { L1ContractTransaction, L1TransactionReceipt } from './L1Transaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { getL2Network } from '../dataEntities/networks'
import { PayableOverrides } from '@ethersproject/contracts'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getBaseFee, parseDepositParams } from '../utils/lib'
import {
  isL1ToL2TransactionRequest,
  L1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'
import { RetryableData } from '../dataEntities/retryableData'

/**
 * Omit doesnt enforce that the seconds generic is a keyof the first
 * OmitTyped guard against the underlying type prop names
 * being refactored, and not being updated in the usage of OmitTyped
 */
type OmitTyped<T, K extends keyof T> = Omit<T, K>

/**
 * Make the specified properties optional
 */
type PartialPick<T, K extends keyof T> = OmitTyped<T, K> & Partial<T>

type L1ToL2GasKeys = 'maxSubmissionCost' | 'maxFeePerGas' | 'gasLimit'
export type L1ToL2MessageGasParams = Pick<RetryableData, L1ToL2GasKeys>
export type L1ToL2MessageNoGasParams = OmitTyped<
  RetryableData,
  L1ToL2GasKeys | 'deposit'
>
export type L1ToL2MessageParams = PartialPick<
  L1ToL2MessageNoGasParams,
  'excessFeeRefundAddress' | 'callValueRefundAddress'
>

/**
 * Creates retryable tickets by directly calling the Inbox contract on L1
 */
export class L1ToL2MessageCreator {
  constructor(public readonly l1Signer: Signer) {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
  }

  protected static async getTicketEstimate(
    params: L1ToL2MessageNoGasParams,
    l1Provider: Provider,
    l2Provider: Provider,
    retryableGasOverrides?: GasOverrides
  ): Promise<Pick<RetryableData, L1ToL2GasKeys>> {
    const baseFee = await getBaseFee(l1Provider)

    const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider)
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
    params: L1ToL2MessageParams,
    l1Provider: Provider,
    l2Provider: Provider,
    options?: GasOverrides
  ): Promise<L1ToL2TransactionRequest> {
    const excessFeeRefundAddress = params.excessFeeRefundAddress || params.from
    const callValueRefundAddress = params.callValueRefundAddress || params.from

    const parsedParams: L1ToL2MessageNoGasParams = {
      ...params,
      excessFeeRefundAddress,
      callValueRefundAddress,
    }

    const estimates = await L1ToL2MessageCreator.getTicketEstimate(
      parsedParams,
      l1Provider,
      l2Provider,
      options
    )

    const l2Network = await getL2Network(l2Provider)
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
      core: {
        to: l2Network.ethBridge.inbox,
        data: functionData,
        value: L1ToL2MessageGasEstimator.getExpectedRetryableL2Deposit({
          ...estimates,
          l2CallValue: params.l2CallValue,
        }),
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
        gasLimit: estimates.gasLimit
    },
      isValid: () =>
        L1ToL2MessageGasEstimator.isValid(estimates, () =>
          L1ToL2MessageCreator.getTicketEstimate(
            parsedParams,
            l1Provider,
            l2Provider,
            options
          )
        ),
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on L1
   */
  public async createRetryableTicket(
    params:
      | (L1ToL2MessageParams & { overrides?: PayableOverrides })
      | (L1ToL2TransactionRequest & { overrides?: PayableOverrides }),
    l2Provider: Provider,
    options?: GasOverrides
  ): Promise<L1ContractTransaction> {
    const l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)
    const createRequest = isL1ToL2TransactionRequest(params)
      ? params
      : await L1ToL2MessageCreator.getTicketCreationRequest(
          params,
          l1Provider,
          l2Provider,
          options
        )

    const tx = await this.l1Signer.sendTransaction({
      ...createRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchWait(tx)
  }
}
