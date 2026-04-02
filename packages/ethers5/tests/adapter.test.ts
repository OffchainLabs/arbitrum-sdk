/**
 * Tests for the ethers v5 adapter layer.
 *
 * Verifies that wrapProvider converts ethers v5 Provider into ArbitrumProvider,
 * and that fromEthersReceipt / fromEthersLog correctly convert BigNumber fields to bigint.
 */
import { describe, it, expect } from 'vitest'
import { wrapProvider, fromEthersReceipt, fromEthersLog } from '../src/adapter'
import type { ArbitrumProvider } from '@arbitrum/core'

// ---------------------------------------------------------------------------
// Mock ethers v5 types (BigNumber-like objects with toBigInt())
// ---------------------------------------------------------------------------

function bn(value: bigint) {
  return {
    toBigInt: () => value,
    toNumber: () => Number(value),
    _isBigNumber: true,
  }
}

function createMockProvider() {
  return {
    getNetwork: async () => ({ chainId: 42161, name: 'arbitrum' }),
    getBlock: async (_tag: any) => ({
      hash: '0xblockhash',
      parentHash: '0xparenthash',
      number: 100,
      timestamp: 1234567890,
      nonce: '0x0000000000000000',
      difficulty: bn(0n),
      gasLimit: bn(30000000n),
      gasUsed: bn(21000n),
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: bn(1000000000n),
      transactions: ['0xtx1', '0xtx2'],
    }),
    getBlockNumber: async () => 100,
    getGasPrice: async () => bn(100000000n),
    getTransactionReceipt: async (_hash: string) => ({
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      transactionIndex: 0,
      gasUsed: bn(21000n),
      logsBloom: '0x00',
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      logs: [
        {
          address: '0xlogaddr',
          topics: ['0xtopic0'],
          data: '0xlogdata',
          blockNumber: 100,
          blockHash: '0xblockhash',
          transactionHash: '0xtxhash',
          transactionIndex: 0,
          logIndex: 0,
          removed: false,
        },
      ],
      blockNumber: 100,
      confirmations: 1,
      cumulativeGasUsed: bn(21000n),
      effectiveGasPrice: bn(100000000n),
      byzantium: true,
      type: 2,
      status: 1,
    }),
    getLogs: async (_filter: any) => [
      {
        address: '0xlogaddr',
        topics: ['0xtopic0'],
        data: '0xlogdata',
        blockNumber: 100,
        blockHash: '0xblockhash',
        transactionHash: '0xtxhash',
        transactionIndex: 0,
        logIndex: 0,
        removed: false,
      },
    ],
    call: async (_tx: any, _blockTag?: any) => '0xcallresult',
    estimateGas: async (_tx: any) => bn(21000n),
    getCode: async (_addr: string) => '0x6080',
    getBalance: async (_addr: string) => bn(1000000000000000000n),
    waitForTransaction: async (
      _hash: string,
      _confirmations?: number,
      _timeout?: number
    ) => ({
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      transactionIndex: 0,
      gasUsed: bn(21000n),
      logsBloom: '0x00',
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      logs: [],
      blockNumber: 100,
      confirmations: 1,
      cumulativeGasUsed: bn(21000n),
      effectiveGasPrice: bn(100000000n),
      byzantium: true,
      type: 2,
      status: 1,
    }),
    getFeeData: async () => ({
      gasPrice: bn(100000000n),
      maxFeePerGas: bn(2000000000n),
      maxPriorityFeePerGas: bn(1500000000n),
    }),
    getStorageAt: async (_addr: string, _slot: string | number) =>
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    getTransactionCount: async (_addr: string) => 42,
  }
}

describe('wrapProvider', () => {
  it('returns an object satisfying ArbitrumProvider', () => {
    const mockProvider = createMockProvider()
    const wrapped = wrapProvider(mockProvider as any)

    // Verify all 12 ArbitrumProvider methods exist
    expect(typeof wrapped.getChainId).toBe('function')
    expect(typeof wrapped.getBlockNumber).toBe('function')
    expect(typeof wrapped.getBlock).toBe('function')
    expect(typeof wrapped.getTransactionReceipt).toBe('function')
    expect(typeof wrapped.call).toBe('function')
    expect(typeof wrapped.estimateGas).toBe('function')
    expect(typeof wrapped.getBalance).toBe('function')
    expect(typeof wrapped.getCode).toBe('function')
    expect(typeof wrapped.getStorageAt).toBe('function')
    expect(typeof wrapped.getTransactionCount).toBe('function')
    expect(typeof wrapped.getLogs).toBe('function')
    expect(typeof wrapped.getFeeData).toBe('function')
  })

  it('getChainId returns a number', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const chainId = await wrapped.getChainId()
    expect(chainId).toBe(42161)
    expect(typeof chainId).toBe('number')
  })

  it('getBlockNumber returns a number', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const blockNumber = await wrapped.getBlockNumber()
    expect(blockNumber).toBe(100)
    expect(typeof blockNumber).toBe('number')
  })

  it('getBlock converts BigNumber fields to bigint', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const block = await wrapped.getBlock('latest')
    expect(block).not.toBeNull()
    expect(block!.hash).toBe('0xblockhash')
    expect(block!.number).toBe(100)
    expect(block!.baseFeePerGas).toBe(1000000000n)
    expect(typeof block!.baseFeePerGas).toBe('bigint')
    expect(block!.gasUsed).toBe(21000n)
    expect(typeof block!.gasUsed).toBe('bigint')
    expect(block!.gasLimit).toBe(30000000n)
    expect(typeof block!.gasLimit).toBe('bigint')
    expect(block!.difficulty).toBe(0n)
    expect(typeof block!.difficulty).toBe('bigint')
  })

  it('getBlock returns null when provider returns null', async () => {
    const mock = createMockProvider()
    mock.getBlock = async () => null as any
    const wrapped = wrapProvider(mock as any)
    const block = await wrapped.getBlock('latest')
    expect(block).toBeNull()
  })

  it('getBlock handles null baseFeePerGas (pre-EIP-1559)', async () => {
    const mock = createMockProvider()
    mock.getBlock = async () => ({
      hash: '0xblockhash',
      parentHash: '0xparenthash',
      number: 50,
      timestamp: 1234567890,
      nonce: '0x0000000000000000',
      difficulty: bn(1000n),
      gasLimit: bn(30000000n),
      gasUsed: bn(21000n),
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: null,
      transactions: [],
    })
    const wrapped = wrapProvider(mock as any)
    const block = await wrapped.getBlock(50)
    expect(block).not.toBeNull()
    expect(block!.baseFeePerGas).toBeNull()
  })

  it('getTransactionReceipt converts BigNumber fields to bigint', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const receipt = await wrapped.getTransactionReceipt('0xtxhash')
    expect(receipt).not.toBeNull()
    expect(receipt!.gasUsed).toBe(21000n)
    expect(typeof receipt!.gasUsed).toBe('bigint')
    expect(receipt!.cumulativeGasUsed).toBe(21000n)
    expect(typeof receipt!.cumulativeGasUsed).toBe('bigint')
    expect(receipt!.effectiveGasPrice).toBe(100000000n)
    expect(typeof receipt!.effectiveGasPrice).toBe('bigint')
    expect(receipt!.status).toBe(1)
    expect(typeof receipt!.status).toBe('number')
    expect(receipt!.logs).toHaveLength(1)
    expect(receipt!.logs[0].address).toBe('0xlogaddr')
  })

  it('getTransactionReceipt returns null when not found', async () => {
    const mock = createMockProvider()
    mock.getTransactionReceipt = async () => null as any
    const wrapped = wrapProvider(mock as any)
    const receipt = await wrapped.getTransactionReceipt('0xnotfound')
    expect(receipt).toBeNull()
  })

  it('getGasPrice via getFeeData converts BigNumber to bigint', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const feeData = await wrapped.getFeeData()
    expect(feeData.gasPrice).toBe(100000000n)
    expect(typeof feeData.gasPrice).toBe('bigint')
    expect(feeData.maxFeePerGas).toBe(2000000000n)
    expect(feeData.maxPriorityFeePerGas).toBe(1500000000n)
  })

  it('getFeeData handles null values', async () => {
    const mock = createMockProvider()
    mock.getFeeData = async () => ({
      gasPrice: bn(100000000n),
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    })
    const wrapped = wrapProvider(mock as any)
    const feeData = await wrapped.getFeeData()
    expect(feeData.gasPrice).toBe(100000000n)
    expect(feeData.maxFeePerGas).toBeNull()
    expect(feeData.maxPriorityFeePerGas).toBeNull()
  })

  it('estimateGas converts BigNumber to bigint', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const gas = await wrapped.estimateGas({ to: '0xto', data: '0x' })
    expect(gas).toBe(21000n)
    expect(typeof gas).toBe('bigint')
  })

  it('getBalance converts BigNumber to bigint', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const balance = await wrapped.getBalance('0xaddr')
    expect(balance).toBe(1000000000000000000n)
    expect(typeof balance).toBe('bigint')
  })

  it('call returns hex string', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const result = await wrapped.call({ to: '0xto', data: '0x' })
    expect(result).toBe('0xcallresult')
  })

  it('getCode returns hex string', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const code = await wrapped.getCode('0xaddr')
    expect(code).toBe('0x6080')
  })

  it('getStorageAt returns hex string', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const storage = await wrapped.getStorageAt('0xaddr', '0x0')
    expect(storage).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000001'
    )
  })

  it('getTransactionCount returns a number', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const nonce = await wrapped.getTransactionCount('0xaddr')
    expect(nonce).toBe(42)
  })

  it('getLogs converts logs correctly', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const logs = await wrapped.getLogs({})
    expect(logs).toHaveLength(1)
    expect(logs[0].address).toBe('0xlogaddr')
    expect(logs[0].topics).toEqual(['0xtopic0'])
    expect(logs[0].blockNumber).toBe(100)
  })
})

describe('fromEthersReceipt', () => {
  it('converts ethers v5 receipt to ArbitrumTransactionReceipt', () => {
    const ethersReceipt = {
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      transactionIndex: 0,
      gasUsed: bn(21000n),
      logsBloom: '0x00',
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      logs: [
        {
          address: '0xlogaddr',
          topics: ['0xtopic0'],
          data: '0xlogdata',
          blockNumber: 100,
          blockHash: '0xblockhash',
          transactionHash: '0xtxhash',
          transactionIndex: 0,
          logIndex: 0,
          removed: false,
        },
      ],
      blockNumber: 100,
      confirmations: 1,
      cumulativeGasUsed: bn(21000n),
      effectiveGasPrice: bn(100000000n),
      byzantium: true,
      type: 2,
      status: 1,
    }

    const result = fromEthersReceipt(ethersReceipt as any)

    expect(result.to).toBe('0xto')
    expect(result.from).toBe('0xfrom')
    expect(result.contractAddress).toBeNull()
    expect(result.transactionHash).toBe('0xtxhash')
    expect(result.transactionIndex).toBe(0)
    expect(result.blockHash).toBe('0xblockhash')
    expect(result.blockNumber).toBe(100)
    expect(result.status).toBe(1)
    expect(result.gasUsed).toBe(21000n)
    expect(typeof result.gasUsed).toBe('bigint')
    expect(result.cumulativeGasUsed).toBe(21000n)
    expect(typeof result.cumulativeGasUsed).toBe('bigint')
    expect(result.effectiveGasPrice).toBe(100000000n)
    expect(typeof result.effectiveGasPrice).toBe('bigint')
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].address).toBe('0xlogaddr')
  })

  it('handles receipt with null "to" field (contract creation)', () => {
    const ethersReceipt = {
      to: null,
      from: '0xfrom',
      contractAddress: '0xnewcontract',
      transactionIndex: 0,
      gasUsed: bn(100000n),
      logsBloom: '0x00',
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      logs: [],
      blockNumber: 200,
      confirmations: 1,
      cumulativeGasUsed: bn(100000n),
      effectiveGasPrice: bn(50000000n),
      byzantium: true,
      type: 0,
      status: 1,
    }

    const result = fromEthersReceipt(ethersReceipt as any)
    expect(result.to).toBeNull()
    expect(result.contractAddress).toBe('0xnewcontract')
  })

  it('converts status 0 (failure) correctly', () => {
    const ethersReceipt = {
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      transactionIndex: 0,
      gasUsed: bn(21000n),
      logsBloom: '0x00',
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      logs: [],
      blockNumber: 100,
      confirmations: 1,
      cumulativeGasUsed: bn(21000n),
      effectiveGasPrice: bn(100000000n),
      byzantium: true,
      type: 2,
      status: 0,
    }

    const result = fromEthersReceipt(ethersReceipt as any)
    expect(result.status).toBe(0)
  })
})

describe('fromEthersLog', () => {
  it('converts ethers v5 Log to ArbitrumLog', () => {
    const ethersLog = {
      address: '0xlogaddr',
      topics: ['0xtopic0', '0xtopic1'],
      data: '0xlogdata',
      blockNumber: 100,
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      transactionIndex: 0,
      logIndex: 3,
      removed: false,
    }

    const result = fromEthersLog(ethersLog as any)

    expect(result.address).toBe('0xlogaddr')
    expect(result.topics).toEqual(['0xtopic0', '0xtopic1'])
    expect(result.data).toBe('0xlogdata')
    expect(result.blockNumber).toBe(100)
    expect(result.blockHash).toBe('0xblockhash')
    expect(result.transactionHash).toBe('0xtxhash')
    expect(result.transactionIndex).toBe(0)
    expect(result.logIndex).toBe(3)
    expect(result.removed).toBe(false)
  })
})
