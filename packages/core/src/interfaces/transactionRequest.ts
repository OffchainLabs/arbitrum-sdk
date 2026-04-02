import type { TransactionRequestData } from './types'
import { isDefined } from '../utils/lib'

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the child chain.
 */
export interface ParentToChildTransactionRequest {
  /**
   * Core fields needed to form the parent component of the transaction request.
   */
  txRequest: Required<TransactionRequestData>
  /**
   * If this request were sent now, would it have enough margin to reliably succeed.
   */
  isValid(): Promise<boolean>
}

/**
 * A transaction request for a transaction that will trigger a child to parent message.
 */
export interface ChildToParentTransactionRequest {
  /**
   * Core fields needed to form the transaction request.
   */
  txRequest: Required<TransactionRequestData>
}

/**
 * Ensure the T is not of TransactionRequest type by ensuring it doesn't have a specific property.
 */
type IsNotTransactionRequest<T> = T extends { txRequest: unknown }
  ? never
  : T

/**
 * Check if an object is of ParentToChildTransactionRequest type.
 */
export const isParentToChildTransactionRequest = <T>(
  possibleRequest:
    | IsNotTransactionRequest<T>
    | ParentToChildTransactionRequest
): possibleRequest is ParentToChildTransactionRequest => {
  return isDefined(
    (possibleRequest as ParentToChildTransactionRequest).txRequest
  )
}

/**
 * Check if an object is of ChildToParentTransactionRequest type.
 */
export const isChildToParentTransactionRequest = <T>(
  possibleRequest:
    | IsNotTransactionRequest<T>
    | ChildToParentTransactionRequest
): possibleRequest is ChildToParentTransactionRequest => {
  return (
    (possibleRequest as ChildToParentTransactionRequest).txRequest != undefined
  )
}
