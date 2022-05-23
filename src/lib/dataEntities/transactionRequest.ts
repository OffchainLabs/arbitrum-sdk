import { TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from 'ethers'

/**
 * Make some properties required
 */
type NonOptional<TType, TProps extends keyof TType> =
  // make the picked props required
  Required<Pick<TType, TProps>> &
    // and include all existing properies
    TType

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the L2
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
