import { TransactionRequest, Provider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import {
  ParentToChildMessageGasParams,
  ParentToChildMessageParams,
} from '../message/L1ToL2MessageCreator'
import { isDefined } from '../utils/lib'

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the child chain
 */
export interface ParentToChildTransactionRequest {
  /**
   * Core fields needed to form the parent component of the transaction request
   */
  txRequest: Required<
    Pick<TransactionRequest, 'to' | 'data' | 'value' | 'from'>
  >
  /**
   * Information about the retryable ticket, and it's subsequent execution, that
   * will occur on the child chain
   */
  retryableData: ParentToChildMessageParams & ParentToChildMessageGasParams
  /**
   * If this request were sent now, would it have enough margin to reliably succeed
   */
  isValid(): Promise<boolean>
}

/**
 * A transaction request for a transaction that will trigger a child to parent message
 */
export interface ChildToParentTransactionRequest {
  txRequest: Required<
    Pick<TransactionRequest, 'to' | 'data' | 'value' | 'from'>
  >
  /**
   * Estimate the gas limit required to execute the withdrawal on the parent chain.
   * Note that this is only a rough estimate as it may not be possible to know
   * the exact size of the proof straight away, however the real value should be
   * within a few thousand gas of this estimate.
   */
  estimateParentGasLimit: (l1Provider: Provider) => Promise<BigNumber>
}

/**
 * Ensure the T is not of TransactionRequest type by ensure it doesn't have a specific TransactionRequest property
 */
type IsNotTransactionRequest<T> = T extends { txRequest: any } ? never : T

/**
 * Check if an object is of ParentToChildTransactionRequest type
 * @param possibleRequest
 * @returns
 */
export const isParentToChildTransactionRequest = <T>(
  possibleRequest: IsNotTransactionRequest<T> | ParentToChildTransactionRequest
): possibleRequest is ParentToChildTransactionRequest => {
  return isDefined(
    (possibleRequest as ParentToChildTransactionRequest).txRequest
  )
}

/**
 * Check if an object is of ChildToParentTransactionRequest type
 * @param possibleRequest
 * @returns
 */
export const isChildToParentTransactionRequest = <T>(
  possibleRequest: IsNotTransactionRequest<T> | ChildToParentTransactionRequest
): possibleRequest is ChildToParentTransactionRequest => {
  return (
    (possibleRequest as ChildToParentTransactionRequest).txRequest != undefined
  )
}
