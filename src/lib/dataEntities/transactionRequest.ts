import { TransactionRequest, Provider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'

/**
 * Make some properties required
 */
export type NonOptional<TType, TProps extends keyof TType> =
  // make the picked props required
  Required<Pick<TType, TProps>> &
    // and include all existing properies
    TType

/**
 * A transaction request for a transaction that will trigger an
 * execution on L2
 */
export interface L1ToL2TransactionRequest {
  txRequest: NonOptional<TransactionRequest, 'to' | 'data' | 'value'>
  /**
   * The gas limit provided to this transactin when executed on L2 (units of gas)
   */
  l2GasLimit: BigNumber
  /**
   * The max fee per gas that will be paid on L2 (wei per gas)
   */
  l2MaxFeePerGas: BigNumber
  /**
   * The L2 retryable ticket submission cost (wei)
   */
  l2SubmissionFee: BigNumber
  /**
   * The maximum total amount of eth that could be spent on L2 (wei)
   */
  l2GasCostsMaxTotal: BigNumber
}

/**
 * A transaction request for a transaction that will trigger an L2 to L1 message
 */
export interface L2ToL1TransactionRequest {
  txRequest: NonOptional<TransactionRequest, 'to' | 'data' | 'value'>
  /**
   * Estimate the gas limit required to execute the withdrawal on L1.
   * Note that this is only a rough estimate as it may not be possible to know
   * the exact size of the proof straight away, however the real value should be
   * within a few thousand gas of this estimate.
   */
  estimateL1GasLimit: (l1Provider: Provider) => Promise<BigNumber>
}

/**
 * Ensure the T is not of TransactionRequest type by ensure it doesnt have a specific TransactionRequest property
 */
type IsNotTransactionRequest<T> = T extends { txRequest: any } ? never : T

/**
 * Check if an object is of L1ToL2TransactionRequest type
 * @param possibleRequest
 * @returns
 */
export const isL1ToL2TransactionRequest = <T>(
  possibleRequest: IsNotTransactionRequest<T> | L1ToL2TransactionRequest
): possibleRequest is L1ToL2TransactionRequest => {
  return (possibleRequest as L1ToL2TransactionRequest).txRequest != undefined
}

/**
 * Check if an object is of L2ToL1TransactionRequest type
 * @param possibleRequest
 * @returns
 */
export const isL2ToL1TransactionRequest = <T>(
  possibleRequest: IsNotTransactionRequest<T> | L2ToL1TransactionRequest
): possibleRequest is L2ToL1TransactionRequest => {
  return (possibleRequest as L2ToL1TransactionRequest).txRequest != undefined
}
