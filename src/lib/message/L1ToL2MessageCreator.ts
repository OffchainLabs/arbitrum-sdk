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
import { getBaseFee } from '../utils/lib'
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

type L1ToL2MessageParams = PartialPick<
  OmitTyped<
    RetryableData,
    'deposit' | 'from' | 'maxSubmissionCost' | 'maxFeePerGas'
  >,
  'excessFeeRefundAddress' | 'callValueRefundAddress'
> & {
  l2Provider: Provider
  /**
   * Options for estimating L1ToL2 gas parameters
   */
  retryableGasOverrides?: GasOverrides
}

/**
 * Creates retryable tickets by directly calling the Inbox contract on L1
 */
export class L1ToL2MessageCreator {
  constructor(public readonly l1Signer: Signer) {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
  }

  /**
   * Generate a transaction request for creating a retryable ticket
   * @param l2Provider
   * @param l2CallTo
   * @param l2CallData
   * @param l2CallValue
   * @param options
   * @returns
   */
  public async getTicketCreationRequest(
    params: L1ToL2MessageParams
  ): Promise<L1ToL2TransactionRequest> {
    const sender = await this.l1Signer.getAddress()
    const excessFeeRefundAddress = params.excessFeeRefundAddress || sender
    const callValueRefundAddress = params.callValueRefundAddress || sender
    const l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)

    const gasEstimator = new L1ToL2MessageGasEstimator(params.l2Provider)
    const baseFee = await getBaseFee(l1Provider)
    const estimates = await gasEstimator.estimateAll(
      sender,
      params.to,
      params.data,
      params.l2CallValue,
      baseFee,
      excessFeeRefundAddress,
      callValueRefundAddress,
      l1Provider,
      params.retryableGasOverrides
    )

    const l2Network = await getL2Network(params.l2Provider)
    const inboxInterface = Inbox__factory.createInterface()
    const functionData = inboxInterface.encodeFunctionData(
      'createRetryableTicket',
      [
        params.to,
        params.l2CallValue,
        estimates.maxSubmissionFee,
        excessFeeRefundAddress,
        callValueRefundAddress,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        params.data,
      ]
    )

    return {
      l2GasLimit: estimates.gasLimit,
      l2MaxFeePerGas: estimates.maxFeePerGas,
      l2SubmissionFee: estimates.maxSubmissionFee,
      l2GasCostsMaxTotal: estimates.totalL2GasCosts,
      core: {
        to: l2Network.ethBridge.inbox,
        data: functionData,
        value: estimates.totalL2GasCosts.add(params.l2CallValue),
      },
      isValid: async () => {
        const reEstimated = await this.getTicketCreationRequest({
          ...params,
          retryableGasOverrides: undefined,
        })
        return (
          estimates.maxFeePerGas.gte(reEstimated.l2MaxFeePerGas) &&
          estimates.maxSubmissionFee.gte(reEstimated.l2SubmissionFee)
        )
      },
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on L1
   */
  public async createRetryableTicket(
    params:
      | (L1ToL2MessageParams & { overrides?: PayableOverrides })
      | (L1ToL2TransactionRequest & { overrides?: PayableOverrides })
  ): Promise<L1ContractTransaction> {
    const createRequest = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getTicketCreationRequest(params)

    const tx = await this.l1Signer.sendTransaction({
      ...createRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchWait(tx)
  }
}
