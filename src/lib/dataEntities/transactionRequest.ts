import { TransactionRequest } from '@ethersproject/providers'
import {
  L1ToL2MessageGasParams,
  L1ToL2MessageParams,
} from '../message/L1ToL2MessageCreator'
import { isDefined } from '../utils/lib'

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the L2
 */
export interface L1ToL2TransactionRequest {
  /**
   * Core fields needed to form the L1 component of the transaction request
   */
  core: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>

  /**
   * Information about the retryable ticket, and it's subsequent execution, that
   * will occur on L2
   */
  retryableData: L1ToL2MessageParams & L1ToL2MessageGasParams

  /**
   * If this request were sent now, would it have enough margin to reliably succeed
   */
  isValid(): Promise<boolean>
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
  return isDefined((possibleRequest as L1ToL2TransactionRequest).core)
}
