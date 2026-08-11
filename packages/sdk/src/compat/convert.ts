/**
 * Conversion utilities between ethers v5 types and @arbitrum/core types.
 *
 * Handles BigNumber <-> bigint, TransactionReceipt, and Log conversions.
 */
import { BigNumber } from 'ethers'
import type { TransactionReceipt, Log } from '@ethersproject/providers'
import type { ArbitrumTransactionReceipt, ArbitrumLog } from '@arbitrum/core'

/**
 * Convert an ethers v5 BigNumber to a native bigint.
 */
export function toBigInt(bn: BigNumber): bigint {
  return bn.toBigInt()
}

/**
 * Convert a native bigint to an ethers v5 BigNumber.
 */
export function toBigNumber(bi: bigint): BigNumber {
  return BigNumber.from(bi)
}

/**
 * Convert an ethers v5 Log to a core ArbitrumLog.
 */
export function toCoreLog(log: Log): ArbitrumLog {
  return {
    address: log.address,
    topics: [...log.topics],
    data: log.data,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    removed: log.removed,
  }
}

/**
 * Convert a core ArbitrumLog to an ethers v5 Log.
 */
export function toEthersLog(log: ArbitrumLog): Log {
  return {
    address: log.address,
    topics: [...log.topics],
    data: log.data,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    removed: log.removed,
  }
}

/**
 * Convert an ethers v5 TransactionReceipt to a core ArbitrumTransactionReceipt.
 * BigNumber fields (gasUsed, cumulativeGasUsed, effectiveGasPrice) become bigint.
 */
export function toCoreReceipt(
  receipt: TransactionReceipt
): ArbitrumTransactionReceipt {
  return {
    to: receipt.to,
    from: receipt.from,
    contractAddress: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status ?? 1,
    logs: receipt.logs.map(toCoreLog),
    gasUsed: receipt.gasUsed.toBigInt(),
    cumulativeGasUsed: receipt.cumulativeGasUsed.toBigInt(),
    effectiveGasPrice: receipt.effectiveGasPrice.toBigInt(),
  }
}

/**
 * Convert a core ArbitrumTransactionReceipt to an ethers v5 TransactionReceipt.
 * bigint fields become BigNumber. Fields that don't exist in core
 * (root, logsBloom, confirmations, byzantium) get defaults.
 */
export function toEthersReceipt(
  receipt: ArbitrumTransactionReceipt
): TransactionReceipt {
  return {
    to: receipt.to ?? '',
    from: receipt.from,
    contractAddress: receipt.contractAddress ?? '',
    transactionIndex: receipt.transactionIndex,
    gasUsed: BigNumber.from(receipt.gasUsed),
    logsBloom: '0x',
    blockHash: receipt.blockHash,
    transactionHash: receipt.transactionHash,
    logs: receipt.logs.map(toEthersLog),
    blockNumber: receipt.blockNumber,
    confirmations: 0,
    cumulativeGasUsed: BigNumber.from(receipt.cumulativeGasUsed),
    effectiveGasPrice: BigNumber.from(receipt.effectiveGasPrice),
    byzantium: true,
    type: 0,
    status: receipt.status,
  }
}
