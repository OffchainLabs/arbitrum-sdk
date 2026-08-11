import { describe, it, expect } from 'vitest'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import type {
  TransactionRequestData,
  BlockTag,
  LogFilter,
  ArbitrumLog,
  ArbitrumTransactionReceipt,
  ArbitrumBlock,
  FeeData,
  CallRequest,
} from '../../src/interfaces/types'

/**
 * These are primarily compile-time type checks.
 * If this file compiles, the types are correctly defined.
 */

describe('Core types', () => {
  it('TransactionRequestData has required fields', () => {
    const tx: TransactionRequestData = {
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: 0n,
    }
    expect(tx.to).toBe('0x0000000000000000000000000000000000000001')
    expect(tx.data).toBe('0x')
    expect(tx.value).toBe(0n)
    // from is optional
    expect(tx.from).toBeUndefined()
  })

  it('TransactionRequestData accepts from', () => {
    const tx: TransactionRequestData = {
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: 100n,
      from: '0x0000000000000000000000000000000000000002',
    }
    expect(tx.from).toBe('0x0000000000000000000000000000000000000002')
  })

  it('TransactionRequestData value is bigint', () => {
    const tx: TransactionRequestData = {
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: 1000000000000000000n, // 1 ETH in wei
    }
    expect(typeof tx.value).toBe('bigint')
  })

  it('BlockTag supports all variants', () => {
    const tags: BlockTag[] = [123, 'latest', 'earliest', 'pending', 'safe', 'finalized']
    expect(tags).toHaveLength(6)
  })

  it('ArbitrumLog has all fields', () => {
    const log: ArbitrumLog = {
      address: '0x0000000000000000000000000000000000000001',
      topics: ['0xabc'],
      data: '0x',
      blockNumber: 100,
      blockHash: '0xabc',
      transactionHash: '0xdef',
      transactionIndex: 0,
      logIndex: 0,
      removed: false,
    }
    expect(log.address).toBeDefined()
    expect(log.removed).toBe(false)
  })

  it('ArbitrumTransactionReceipt has all fields', () => {
    const receipt: ArbitrumTransactionReceipt = {
      to: '0x0000000000000000000000000000000000000001',
      from: '0x0000000000000000000000000000000000000002',
      contractAddress: null,
      transactionHash: '0xabc',
      transactionIndex: 0,
      blockHash: '0xdef',
      blockNumber: 100,
      status: 1,
      logs: [],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }
    expect(receipt.status).toBe(1)
    expect(typeof receipt.gasUsed).toBe('bigint')
  })

  it('ArbitrumBlock has all fields', () => {
    const block: ArbitrumBlock = {
      hash: '0xabc',
      parentHash: '0xdef',
      number: 100,
      timestamp: 1700000000,
      nonce: '0x0',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 15000000n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n,
      transactions: [],
    }
    expect(block.number).toBe(100)
    expect(typeof block.gasLimit).toBe('bigint')
  })

  it('ArbitrumBlock accepts optional Arbitrum-specific fields', () => {
    const block: ArbitrumBlock = {
      hash: '0xabc',
      parentHash: '0xdef',
      number: 100,
      timestamp: 1700000000,
      nonce: '0x0',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 15000000n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n,
      transactions: [],
      sendRoot: '0x' + 'ab'.repeat(32),
      sendCount: 42n,
      l1BlockNumber: 19000000,
    }
    expect(block.sendRoot).toBe('0x' + 'ab'.repeat(32))
    expect(block.sendCount).toBe(42n)
    expect(block.l1BlockNumber).toBe(19000000)
  })

  it('ArbitrumBlock Arbitrum-specific fields are optional', () => {
    const block: ArbitrumBlock = {
      hash: '0xabc',
      parentHash: '0xdef',
      number: 100,
      timestamp: 1700000000,
      nonce: '0x0',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 15000000n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n,
      transactions: [],
    }
    expect(block.sendRoot).toBeUndefined()
    expect(block.sendCount).toBeUndefined()
    expect(block.l1BlockNumber).toBeUndefined()
  })

  it('FeeData has all fields', () => {
    const fee: FeeData = {
      gasPrice: 1000000000n,
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1500000000n,
    }
    expect(typeof fee.gasPrice).toBe('bigint')
  })

  it('FeeData allows null fields', () => {
    const fee: FeeData = {
      gasPrice: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }
    expect(fee.gasPrice).toBeNull()
  })

  it('CallRequest has required and optional fields', () => {
    const call: CallRequest = {
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
    }
    expect(call.from).toBeUndefined()
    expect(call.value).toBeUndefined()
    expect(call.blockTag).toBeUndefined()
  })

  it('LogFilter has all optional fields', () => {
    const filter: LogFilter = {}
    expect(filter.address).toBeUndefined()

    const fullFilter: LogFilter = {
      address: '0x0000000000000000000000000000000000000001',
      topics: ['0xabc', null, ['0xdef', '0xghi']],
      fromBlock: 100,
      toBlock: 'latest',
    }
    expect(fullFilter.topics).toHaveLength(3)
  })
})

describe('ArbitrumProvider interface', () => {
  it('has all 12 methods', () => {
    // This is a compile-time check. We create a mock that satisfies the interface.
    const mockProvider: ArbitrumProvider = {
      getChainId: async () => 1,
      getBlockNumber: async () => 100,
      getBlock: async () => null,
      getTransactionReceipt: async () => null,
      call: async () => '0x',
      estimateGas: async () => 21000n,
      getBalance: async () => 0n,
      getCode: async () => '0x',
      getStorageAt: async () => '0x0',
      getTransactionCount: async () => 0,
      getLogs: async () => [],
      getFeeData: async () => ({
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      }),
    }

    // Verify all methods exist
    expect(typeof mockProvider.getChainId).toBe('function')
    expect(typeof mockProvider.getBlockNumber).toBe('function')
    expect(typeof mockProvider.getBlock).toBe('function')
    expect(typeof mockProvider.getTransactionReceipt).toBe('function')
    expect(typeof mockProvider.call).toBe('function')
    expect(typeof mockProvider.estimateGas).toBe('function')
    expect(typeof mockProvider.getBalance).toBe('function')
    expect(typeof mockProvider.getCode).toBe('function')
    expect(typeof mockProvider.getStorageAt).toBe('function')
    expect(typeof mockProvider.getTransactionCount).toBe('function')
    expect(typeof mockProvider.getLogs).toBe('function')
    expect(typeof mockProvider.getFeeData).toBe('function')
  })
})
