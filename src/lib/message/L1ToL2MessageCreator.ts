import { constants } from 'ethers'
import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import {
  GasOverrides,
  L1ToL2MessageGasEstimator,
} from './L1ToL2MessageGasEstimator'
import { L1ContractTransaction, L1TransactionReceipt } from './L1Transaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { ERC20Inbox__factory } from '../abi/factories/ERC20Inbox__factory'
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
import { OmitTyped, PartialPick } from '../utils/types'

type L1ToL2GasKeys =
  | 'maxSubmissionCost'
  | 'maxFeePerGas'
  | 'gasLimit'
  | 'deposit'
export type L1ToL2MessageGasParams = Pick<RetryableData, L1ToL2GasKeys>
export type L1ToL2MessageNoGasParams = OmitTyped<RetryableData, L1ToL2GasKeys>
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

  /**
   * Gets a current estimate for the supplied params
   * @param params
   * @param l1Provider
   * @param l2Provider
   * @param retryableGasOverrides
   * @returns
   */
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
   * Prepare calldata for a call to create a retryable ticket
   * @param params
   * @param estimates
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param nativeTokenIsEth
   * @returns
   */
  protected static getTicketCreationRequestCallData(
    params: L1ToL2MessageParams,
    estimates: Pick<RetryableData, L1ToL2GasKeys>,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    nativeTokenIsEth: boolean
  ) {
    if (!nativeTokenIsEth) {
      return ERC20Inbox__factory.createInterface().encodeFunctionData(
        'createRetryableTicket',
        [
          params.to,
          params.l2CallValue,
          estimates.maxSubmissionCost,
          excessFeeRefundAddress,
          callValueRefundAddress,
          estimates.gasLimit,
          estimates.maxFeePerGas,
          estimates.deposit, // tokenTotalFeeAmount
          params.data,
        ]
      )
    }

    return Inbox__factory.createInterface().encodeFunctionData(
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
    const nativeTokenIsEth = typeof l2Network.nativeToken === 'undefined'

    const data = L1ToL2MessageCreator.getTicketCreationRequestCallData(
      params,
      estimates,
      excessFeeRefundAddress,
      callValueRefundAddress,
      nativeTokenIsEth
    )

    return {
      txRequest: {
        to: l2Network.ethBridge.inbox,
        data,
        value: nativeTokenIsEth ? estimates.deposit : constants.Zero,
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
        const reEstimates = await L1ToL2MessageCreator.getTicketEstimate(
          parsedParams,
          l1Provider,
          l2Provider,
          options
        )
        return L1ToL2MessageGasEstimator.isValid(estimates, reEstimates)
      },
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
      ...createRequest.txRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchWait(tx)
  }
}
