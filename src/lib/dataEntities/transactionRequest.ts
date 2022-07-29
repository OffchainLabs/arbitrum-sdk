import { TransactionRequest, Provider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the L2
 */
export interface L1ToL2TransactionRequest {
  /**
   * Core fields needed to form a transaction request: `to`, `data`, `value`
   */
  core: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>
  /**
   * The gas limit provided to this transactin when executed on L2 (units of gas)
   */
  l2GasLimit: BigNumber
  /**
   * The max fee per gas that will be paid on L2 (wei per gas).
   * Caution: Gas price changes on the L2 could mean that the l2MaxFeePerGas set here may not be high
   * enough by the time it's executed.
   * If that is the case the retryable ticket will fail to be redeemed automatically, and must be redeemed manually
   * by calling redeem on the l1ToL2Message.
   */
  l2MaxFeePerGas: BigNumber
  /**
   * The L2 retryable ticket submission cost (wei).
   * Caution: The Arbitrum submission price changes according to the l1 base fee,
   * which in turn means that the l2SubmissionFee needs to be changed in order to ensure submission succeeds.
   * If the l1 base fee increases by too much, then this transaction will fail upon execution on the L1.
   */
  l2SubmissionFee: BigNumber
  /**
   * The maximum total amount of eth that could be spent on L2 gas (wei)
   */
  l2GasCostsMaxTotal: BigNumber
  /**
   * If this request were sent now, would it have enough margin to reliably succeed
   */
  isValid(): Promise<boolean>
}
/*
 * Parameters that will be used to create the retryable ticket for this l1 to l2 message
 */
export interface IRetryableData {
  /**
   * The call data that will be sent on L2
   */
  callData: string
  /**
   * The sender of the retryable
   */
  sender: string
  /**
   * The L2 destination of the retryable
   */
  destination: string
  /**
   * The L2 address any excess fees will be refunded to
   */
  excessFeeRefundAddress: string
  /**
   * The L2 address the call value will be refunded to in event of failure
   */
  callValueRefundAddress: string
  /**
   * The L2 call value of the retryable
   */
  l2CallValue: BigNumber
}

/**
 * A transaction request for a transaction that will trigger an L2 to L1 message
 */
export interface L2ToL1TransactionRequest {
  txRequest: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>
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
  return (possibleRequest as L1ToL2TransactionRequest).core != undefined
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
