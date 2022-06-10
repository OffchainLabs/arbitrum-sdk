import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import {
  GasOverrides,
  L1ToL2MessageGasEstimator,
} from './L1ToL2MessageGasEstimator'
import { L1TransactionReceipt } from './L1Transaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { getL2Network } from '../dataEntities/networks'
import { PayableOverrides } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getBaseFee } from '../utils/lib'
import {
  isL1ToL2TransactionRequest,
  L1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'

interface L1ToL2MessageParams {
  l2Provider: Provider
  /**
   * The address to be called on L2
   */
  l2CallTo: string
  /**
   * The data to call the L2 address with
   */
  l2CallData: string
  /**
   * The value to call the L2 address with
   */
  l2CallValue: BigNumber
  /**
   * Retryable ticket options
   */
  options?: {
    /**
     * The address to return the any gas that was not spent on fees
     */
    excessFeeRefundAddress?: string
    /**
     * The address to refund the call value to in the event the transaction fails
     */
    callValueRefundAddress?: string
    /**
     * Options for estimating L1ToL2 gas parameters
     */
    gasEstimationOptions?: GasOverrides
  }
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
    const excessFeeRefundAddress =
      params.options?.excessFeeRefundAddress || sender
    const callValueRefundAddress =
      params.options?.callValueRefundAddress || sender
    const l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)

    const gasEstimator = new L1ToL2MessageGasEstimator(params.l2Provider)
    const baseFee = await getBaseFee(l1Provider)
    const estimates = await gasEstimator.estimateAll(
      sender,
      params.l2CallTo,
      params.l2CallData,
      params.l2CallValue,
      baseFee,
      excessFeeRefundAddress,
      callValueRefundAddress,
      l1Provider,
      params.options?.gasEstimationOptions
    )

    const l2Network = await getL2Network(params.l2Provider)
    const inboxInterface = Inbox__factory.createInterface()
    const functionData = inboxInterface.encodeFunctionData(
      'createRetryableTicket',
      [
        params.l2CallTo,
        params.l2CallValue,
        estimates.maxSubmissionFee,
        excessFeeRefundAddress,
        callValueRefundAddress,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        params.l2CallData,
      ]
    )

    return {
      l2GasLimit: estimates.gasLimit,
      l2MaxFeePerGas: estimates.maxFeePerGas,
      l2SubmissionFee: estimates.maxSubmissionFee,
      l2GasCostsMaxTotal: estimates.totalL2GasCosts,
      txRequestCore: {
        to: l2Network.ethBridge.inbox,
        data: functionData,
        value: estimates.totalL2GasCosts.add(params.l2CallValue),
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
  ): Promise<L1TransactionReceipt> {
    const createRequest = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getTicketCreationRequest(params)

    const tx = await this.l1Signer.sendTransaction({
      ...createRequest,
      ...params.overrides,
    })

    const receipt = await tx.wait()

    return new L1TransactionReceipt(receipt)
  }
}
