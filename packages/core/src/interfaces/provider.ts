/**
 * ArbitrumProvider — the internal interface that core uses for all chain reads.
 * Each library package (ethers5, ethers6, viem) implements this interface
 * by wrapping its native provider. Users never interact with this directly.
 *
 * The interface is deliberately minimal — only 12 read-only methods are needed.
 */
import {
  BlockTag,
  LogFilter,
  ArbitrumLog,
  ArbitrumTransactionReceipt,
  ArbitrumBlock,
  FeeData,
} from './types'

export interface ArbitrumProvider {
  /** Get the chain ID */
  getChainId(): Promise<number>

  /** Get the current block number */
  getBlockNumber(): Promise<number>

  /** Get a block by number or tag */
  getBlock(blockTag: BlockTag): Promise<ArbitrumBlock | null>

  /** Get a transaction receipt by hash */
  getTransactionReceipt(
    txHash: string
  ): Promise<ArbitrumTransactionReceipt | null>

  /** Execute a read-only call (eth_call) */
  call(request: { to: string; data: string; blockTag?: BlockTag }): Promise<string>

  /** Estimate gas for a transaction */
  estimateGas(request: {
    to: string
    data: string
    from?: string
    value?: bigint
  }): Promise<bigint>

  /** Get the balance of an address */
  getBalance(address: string, blockTag?: BlockTag): Promise<bigint>

  /** Get the code at an address */
  getCode(address: string, blockTag?: BlockTag): Promise<string>

  /** Get a storage slot value */
  getStorageAt(
    address: string,
    slot: string,
    blockTag?: BlockTag
  ): Promise<string>

  /** Get the transaction count (nonce) for an address */
  getTransactionCount(address: string, blockTag?: BlockTag): Promise<number>

  /** Fetch logs matching a filter */
  getLogs(filter: LogFilter): Promise<ArbitrumLog[]>

  /** Get current fee data */
  getFeeData(): Promise<FeeData>
}
