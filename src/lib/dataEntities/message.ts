import { BigNumber } from '@ethersproject/bignumber'

/**
 * The components of a submit retryable message. Can be parsed from the
 * events emitted from the Inbox.
 */
export interface RetryableMessageParams {
  /**
   * Destination address for L2 message
   */
  destAddress: string
  /**
   * Call value in L2 message
   */
  l2CallValue: BigNumber
  /**
   * Value sent at L1
   */
  l1Value: BigNumber
  /**
   * Max gas deducted from L2 balance to cover base submission fee
   */
  maxSubmissionFee: BigNumber
  /**
   * L2 address address to credit (gaslimit x gasprice - execution cost)
   */
  excessFeeRefundAddress: string
  /**
   *  Address to credit l2Callvalue on L2 if retryable txn times out or gets cancelled
   */
  callValueRefundAddress: string
  /**
   * Max gas deducted from user's L2 balance to cover L2 execution
   */
  gasLimit: BigNumber
  /**
   * Gas price for L2 execution
   */
  maxFeePerGas: BigNumber
  /**
   * Calldata for of the L2 message
   */
  data: string
}
