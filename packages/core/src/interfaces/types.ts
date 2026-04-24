/**
 * Core data types for the provider-agnostic Arbitrum SDK.
 * All amounts use bigint. All addresses/hashes use string.
 */

/**
 * The universal return type for all SDK functions.
 * Users send this with their own signer/wallet — the SDK never signs.
 */
export interface TransactionRequestData {
  /** Target contract address */
  to: string
  /** ABI-encoded calldata */
  data: string
  /** Native token value to send (wei) */
  value: bigint
  /** Sender address (for gas estimation) */
  from?: string
  /** Gas limit override (optional — adapters let the provider estimate if omitted) */
  gasLimit?: bigint
}

/**
 * Block tag: a block number, or a named tag.
 */
export type BlockTag = number | 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized'

/**
 * Filter for fetching logs.
 */
export interface LogFilter {
  address?: string
  topics?: (string | string[] | null)[]
  fromBlock?: BlockTag
  toBlock?: BlockTag
}

/**
 * A log entry from a transaction receipt.
 */
export interface ArbitrumLog {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  blockHash: string
  transactionHash: string
  transactionIndex: number
  logIndex: number
  removed: boolean
}

/**
 * Transaction receipt.
 */
export interface ArbitrumTransactionReceipt {
  to: string | null
  from: string
  contractAddress: string | null
  transactionHash: string
  transactionIndex: number
  blockHash: string
  blockNumber: number
  status: number // 1 = success, 0 = failure
  logs: ArbitrumLog[]
  gasUsed: bigint
  effectiveGasPrice: bigint
  cumulativeGasUsed: bigint
}

/**
 * Block data.
 */
export interface ArbitrumBlock {
  hash: string
  parentHash: string
  number: number
  timestamp: number
  nonce: string
  difficulty: bigint
  gasLimit: bigint
  gasUsed: bigint
  miner: string
  baseFeePerGas: bigint | null
  transactions: string[]
  /**
   * Arbitrum-specific: number of L2-to-L1 messages sent up to and including
   * this block. Present on Arbitrum Nitro blocks; absent on L1/non-Arbitrum.
   */
  sendCount?: bigint
}

/**
 * Gas fee data.
 */
export interface FeeData {
  gasPrice: bigint | null
  maxFeePerGas: bigint | null
  maxPriorityFeePerGas: bigint | null
}

/**
 * Parameters for an eth_call.
 */
export interface CallRequest {
  to: string
  data: string
  from?: string
  value?: bigint
  blockTag?: BlockTag
}
