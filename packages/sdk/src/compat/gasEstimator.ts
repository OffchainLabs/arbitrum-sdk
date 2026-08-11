/**
 * Compat layer: ParentToChildMessageGasEstimator
 *
 * Backwards-compatible class wrapper that delegates to the original
 * lib implementation. The class maintains the same API surface.
 */
import type { Provider } from '@ethersproject/abstract-provider'
import { BigNumber, BigNumberish, BytesLike } from 'ethers'

import {
  ParentToChildMessageGasEstimator as OriginalEstimator,
  GasOverrides,
  PercentIncrease,
} from '../lib/message/ParentToChildMessageGasEstimator'
import type {
  ParentToChildMessageGasParams,
  ParentToChildMessageNoGasParams,
} from '../lib/message/ParentToChildMessageCreator'
import type { ParentToChildTransactionRequest } from '../lib/dataEntities/transactionRequest'
import type { OmitTyped } from '../lib/utils/types'
import type { RetryableData } from '../lib/dataEntities/retryableData'

export { GasOverrides, PercentIncrease }

export class ParentToChildMessageGasEstimator {
  private readonly original: OriginalEstimator

  constructor(public readonly childProvider: Provider) {
    this.original = new OriginalEstimator(childProvider)
  }

  public async estimateSubmissionFee(
    parentProvider: Provider,
    parentBaseFee: BigNumber,
    callDataSize: BigNumber | number,
    options?: PercentIncrease
  ): Promise<BigNumber> {
    return this.original.estimateSubmissionFee(
      parentProvider,
      parentBaseFee,
      callDataSize,
      options
    )
  }

  public async estimateRetryableTicketGasLimit(
    params: ParentToChildMessageNoGasParams,
    senderDeposit?: BigNumber
  ): Promise<BigNumber> {
    return this.original.estimateRetryableTicketGasLimit(params, senderDeposit)
  }

  public async estimateMaxFeePerGas(
    options?: PercentIncrease
  ): Promise<BigNumber> {
    return this.original.estimateMaxFeePerGas(options)
  }

  public static async isValid(
    estimates: ParentToChildMessageGasParams,
    reEstimates: ParentToChildMessageGasParams
  ): Promise<boolean> {
    return OriginalEstimator.isValid(estimates, reEstimates)
  }

  public async estimateAll(
    retryableEstimateData: ParentToChildMessageNoGasParams,
    parentBaseFee: BigNumber,
    parentProvider: Provider,
    options?: GasOverrides
  ): Promise<ParentToChildMessageGasParams> {
    return this.original.estimateAll(
      retryableEstimateData,
      parentBaseFee,
      parentProvider,
      options
    )
  }

  public async populateFunctionParams(
    dataFunc: (
      params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
    ) => ParentToChildTransactionRequest['txRequest'],
    parentProvider: Provider,
    gasOverrides?: GasOverrides
  ): Promise<{
    estimates: ParentToChildMessageGasParams
    retryable: RetryableData
    data: BytesLike
    to: string
    value: BigNumberish
  }> {
    return this.original.populateFunctionParams(
      dataFunc,
      parentProvider,
      gasOverrides
    )
  }
}
