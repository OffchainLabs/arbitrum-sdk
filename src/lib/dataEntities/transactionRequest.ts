import { TransactionRequest, Provider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
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
  txRequest: Required<
    Pick<TransactionRequest, 'to' | 'data' | 'value' | 'from'>
  >
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
 * A transaction request for a transaction that will trigger an L2 to L1 message
 */
export interface L2ToL1TransactionRequest {
  txRequest: Required<
    Pick<TransactionRequest, 'to' | 'data' | 'value' | 'from'>
  >
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
  return isDefined((possibleRequest as L1ToL2TransactionRequest).txRequest)
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
