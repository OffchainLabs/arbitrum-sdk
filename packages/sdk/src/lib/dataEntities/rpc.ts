import { TransactionReceipt, Block } from '@ethersproject/providers'
import { BlockWithTransactions } from '@ethersproject/abstract-provider'
import { BigNumber } from 'ethers'

export interface ArbBlockProps {
  /**
   * The merkle root of the withdrawals tree
   */
  sendRoot: string

  /**
   * Cumulative number of withdrawals since genesis
   */
  sendCount: BigNumber

  /**
   * The l1 block number as seen from within this l2 block
   */
  l1BlockNumber: number
}

export type ArbBlock = ArbBlockProps & Block
export type ArbBlockWithTransactions = ArbBlockProps & BlockWithTransactions

/**
 * Eth transaction receipt with additional arbitrum specific fields
 */
export interface ArbTransactionReceipt extends TransactionReceipt {
  /**
   * The l1 block number that would be used for block.number calls
   * that occur within this transaction.
   * See https://developer.offchainlabs.com/docs/time_in_arbitrum
   */
  l1BlockNumber: number
  /**
   * Amount of gas spent on l1 computation in units of l2 gas
   */
  gasUsedForL1: BigNumber
}
