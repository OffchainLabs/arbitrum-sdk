import { constants } from 'ethers'
import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import {
  GasOverrides,
  ParentToChildMessageGasEstimator,
} from './ParentToChildMessageGasEstimator'
import {
  ParentContractTransaction,
  ParentTransactionReceipt,
} from './ParentTransaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { getChildChain } from '../dataEntities/networks'
import { ERC20Inbox__factory } from '../abi/factories/ERC20Inbox__factory'
import { PayableOverrides } from '@ethersproject/contracts'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getBaseFee } from '../utils/lib'
import {
  isParentToChildTransactionRequest,
  ParentToChildTransactionRequest,
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
 * Creates retryable tickets by directly calling the Inbox contract on Parent chain
 */
export class ParentToChildMessageCreator {
  constructor(public readonly parentSigner: Signer) {
    if (!SignerProviderUtils.signerHasProvider(parentSigner)) {
      throw new MissingProviderArbSdkError('parentSigner')
    }
  }

  /**
   * Gets a current estimate for the supplied params
   * @param params
   * @param parentProvider
   * @param childProvider
   * @param retryableGasOverrides
   * @returns
   */
  protected static async getTicketEstimate(
    params: ParentToChildMessageNoGasParams,
    parentProvider: Provider,
    childProvider: Provider,
    retryableGasOverrides?: GasOverrides
  ): Promise<Pick<RetryableData, ParentToChildGasKeys>> {
    const baseFee = await getBaseFee(parentProvider)

    const gasEstimator = new ParentToChildMessageGasEstimator(childProvider)
    return await gasEstimator.estimateAll(
      params,
      baseFee,
      parentProvider,
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
    params: ParentToChildMessageParams,
    estimates: Pick<RetryableData, ParentToChildGasKeys>,
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
   * @param parentProvider
   * @param childProvider
   * @param options
   * @returns
   */
  public static async getTicketCreationRequest(
    params: ParentToChildMessageParams,
    parentProvider: Provider,
    childProvider: Provider,
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
      parentProvider,
      childProvider,
      options
    )

    const childChain = await getChildChain(childProvider)
    const nativeTokenIsEth = typeof childChain.nativeToken === 'undefined'

    const data = ParentToChildMessageCreator.getTicketCreationRequestCallData(
      params,
      estimates,
      excessFeeRefundAddress,
      callValueRefundAddress,
      nativeTokenIsEth
    )

    return {
      txRequest: {
        to: childChain.ethBridge.inbox,
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
        const reEstimates = await ParentToChildMessageCreator.getTicketEstimate(
          parsedParams,
          parentProvider,
          childProvider,
          options
        )
        return ParentToChildMessageGasEstimator.isValid(estimates, reEstimates)
      },
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on Parent chain
   */
  public async createRetryableTicket(
    params:
      | (ParentToChildMessageParams & { overrides?: PayableOverrides })
      | (ParentToChildTransactionRequest & {
          overrides?: PayableOverrides
        }),
    childProvider: Provider,
    options?: GasOverrides
  ): Promise<ParentContractTransaction> {
    const parentProvider = SignerProviderUtils.getProviderOrThrow(
      this.parentSigner
    )
    const createRequest = isParentToChildTransactionRequest(params)
      ? params
      : await ParentToChildMessageCreator.getTicketCreationRequest(
          params,
          parentProvider,
          childProvider,
          options
        )

    const tx = await this.parentSigner.sendTransaction({
      ...createRequest.txRequest,
      ...params.overrides,
    })

    return ParentTransactionReceipt.monkeyPatchWait(tx)
  }
}
