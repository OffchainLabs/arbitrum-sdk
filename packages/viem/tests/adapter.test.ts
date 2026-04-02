/**
 * Tests for the viem adapter — converts viem PublicClient to ArbitrumProvider.
 */
import { describe, it, expect, vi } from 'vitest'
import { wrapPublicClient, fromViemReceipt, fromViemLog } from '../src/adapter'
import type { ArbitrumProvider } from '@arbitrum/core'

/**
 * Create a mock viem PublicClient with all methods needed by the adapter.
 */
function createMockViemClient() {
  return {
    getChainId: vi.fn(),
    getBlock: vi.fn(),
    getBlockNumber: vi.fn(),
    getTransactionReceipt: vi.fn(),
    getLogs: vi.fn(),
    call: vi.fn(),
    estimateGas: vi.fn(),
    getCode: vi.fn(),
    getBalance: vi.fn(),
    getGasPrice: vi.fn(),
    estimateFeesPerGas: vi.fn(),
    getStorageAt: vi.fn(),
    getTransactionCount: vi.fn(),
  }
}

describe('wrapPublicClient', () => {
  it('returns an object satisfying ArbitrumProvider', () => {
    const mock = createMockViemClient()
    const provider: ArbitrumProvider = wrapPublicClient(mock as any)
    expect(provider).toBeDefined()
    expect(typeof provider.getChainId).toBe('function')
    expect(typeof provider.getBlockNumber).toBe('function')
    expect(typeof provider.getBlock).toBe('function')
    expect(typeof provider.getTransactionReceipt).toBe('function')
    expect(typeof provider.call).toBe('function')
    expect(typeof provider.estimateGas).toBe('function')
    expect(typeof provider.getBalance).toBe('function')
    expect(typeof provider.getCode).toBe('function')
    expect(typeof provider.getStorageAt).toBe('function')
    expect(typeof provider.getTransactionCount).toBe('function')
    expect(typeof provider.getLogs).toBe('function')
    expect(typeof provider.getFeeData).toBe('function')
  })

  describe('getChainId', () => {
    it('delegates to client.getChainId and returns a number', async () => {
      const mock = createMockViemClient()
      mock.getChainId.mockResolvedValue(42161)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getChainId()
      expect(result).toBe(42161)
      expect(mock.getChainId).toHaveBeenCalledOnce()
    })
  })

  describe('getBlockNumber', () => {
    it('delegates to client.getBlockNumber and converts bigint to number', async () => {
      const mock = createMockViemClient()
      mock.getBlockNumber.mockResolvedValue(12345678n)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getBlockNumber()
      expect(result).toBe(12345678)
      expect(typeof result).toBe('number')
      expect(mock.getBlockNumber).toHaveBeenCalledOnce()
    })
  })

  describe('getBlock', () => {
    it('converts a viem block to ArbitrumBlock with number blockTag', async () => {
      const mock = createMockViemClient()
      mock.getBlock.mockResolvedValue({
        hash: '0xblockhash',
        parentHash: '0xparenthash',
        number: 100n,
        timestamp: 1700000000n,
        nonce: '0x0000000000000000',
        difficulty: 0n,
        gasLimit: 30000000n,
        gasUsed: 15000000n,
        miner: '0x0000000000000000000000000000000000000000',
        baseFeePerGas: 100000000n,
        transactions: ['0xtx1', '0xtx2'],
      })
      const provider = wrapPublicClient(mock as any)
      const block = await provider.getBlock(100)
      expect(block).not.toBeNull()
      expect(block!.number).toBe(100)
      expect(typeof block!.number).toBe('number')
      expect(block!.timestamp).toBe(1700000000)
      expect(typeof block!.timestamp).toBe('number')
      expect(block!.hash).toBe('0xblockhash')
      expect(block!.gasLimit).toBe(30000000n)
      expect(block!.baseFeePerGas).toBe(100000000n)
      expect(block!.transactions).toEqual(['0xtx1', '0xtx2'])
      // Should have called with blockNumber for numeric tag
      expect(mock.getBlock).toHaveBeenCalledWith({ blockNumber: 100n })
    })

    it('passes string block tags correctly', async () => {
      const mock = createMockViemClient()
      mock.getBlock.mockResolvedValue({
        hash: '0xblockhash',
        parentHash: '0xparenthash',
        number: 100n,
        timestamp: 1700000000n,
        nonce: '0x0000000000000000',
        difficulty: 0n,
        gasLimit: 30000000n,
        gasUsed: 15000000n,
        miner: '0x0000000000000000000000000000000000000000',
        baseFeePerGas: null,
        transactions: [],
      })
      const provider = wrapPublicClient(mock as any)
      await provider.getBlock('latest')
      expect(mock.getBlock).toHaveBeenCalledWith({ blockTag: 'latest' })
    })

    it('returns null when viem returns null', async () => {
      const mock = createMockViemClient()
      mock.getBlock.mockResolvedValue(null)
      const provider = wrapPublicClient(mock as any)
      const block = await provider.getBlock('latest')
      expect(block).toBeNull()
    })
  })

  describe('getTransactionReceipt', () => {
    it('converts viem receipt with status success to core receipt with status 1', async () => {
      const mock = createMockViemClient()
      mock.getTransactionReceipt.mockResolvedValue({
        to: '0xto',
        from: '0xfrom',
        contractAddress: null,
        transactionHash: '0xtxhash',
        transactionIndex: 3,
        blockHash: '0xblockhash',
        blockNumber: 200n,
        status: 'success',
        logs: [
          {
            address: '0xlogaddr',
            topics: ['0xtopic0', '0xtopic1'],
            data: '0xdata',
            blockNumber: 200n,
            blockHash: '0xblockhash',
            transactionHash: '0xtxhash',
            transactionIndex: 3,
            logIndex: 0,
            removed: false,
          },
        ],
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
        cumulativeGasUsed: 100000n,
      })
      const provider = wrapPublicClient(mock as any)
      const receipt = await provider.getTransactionReceipt('0xtxhash')
      expect(receipt).not.toBeNull()
      expect(receipt!.status).toBe(1)
      expect(receipt!.blockNumber).toBe(200)
      expect(typeof receipt!.blockNumber).toBe('number')
      expect(receipt!.gasUsed).toBe(21000n)
      expect(receipt!.logs).toHaveLength(1)
      expect(receipt!.logs[0].address).toBe('0xlogaddr')
      expect(receipt!.logs[0].blockNumber).toBe(200)
      expect(mock.getTransactionReceipt).toHaveBeenCalledWith({ hash: '0xtxhash' })
    })

    it('converts viem receipt with status reverted to core receipt with status 0', async () => {
      const mock = createMockViemClient()
      mock.getTransactionReceipt.mockResolvedValue({
        to: '0xto',
        from: '0xfrom',
        contractAddress: null,
        transactionHash: '0xtxhash',
        transactionIndex: 0,
        blockHash: '0xblockhash',
        blockNumber: 100n,
        status: 'reverted',
        logs: [],
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
        cumulativeGasUsed: 50000n,
      })
      const provider = wrapPublicClient(mock as any)
      const receipt = await provider.getTransactionReceipt('0xtxhash')
      expect(receipt).not.toBeNull()
      expect(receipt!.status).toBe(0)
    })

    it('returns null when receipt is not found', async () => {
      const mock = createMockViemClient()
      mock.getTransactionReceipt.mockRejectedValue(
        new Error('Transaction receipt with hash "0x..." could not be found.')
      )
      const provider = wrapPublicClient(mock as any)
      const receipt = await provider.getTransactionReceipt('0xnotfound')
      expect(receipt).toBeNull()
    })
  })

  describe('call', () => {
    it('delegates to client.call with correct params for numeric blockTag', async () => {
      const mock = createMockViemClient()
      mock.call.mockResolvedValue({ data: '0xresultdata' })
      const provider = wrapPublicClient(mock as any)
      const result = await provider.call({
        to: '0xcontract',
        data: '0xcalldata',
        blockTag: 100,
      })
      expect(result).toBe('0xresultdata')
      expect(mock.call).toHaveBeenCalledWith({
        to: '0xcontract',
        data: '0xcalldata',
        blockNumber: 100n,
      })
    })

    it('delegates to client.call with string blockTag', async () => {
      const mock = createMockViemClient()
      mock.call.mockResolvedValue({ data: '0xresult' })
      const provider = wrapPublicClient(mock as any)
      await provider.call({ to: '0xcontract', data: '0xcalldata', blockTag: 'latest' })
      expect(mock.call).toHaveBeenCalledWith({
        to: '0xcontract',
        data: '0xcalldata',
        blockTag: 'latest',
      })
    })

    it('returns 0x when call returns no data', async () => {
      const mock = createMockViemClient()
      mock.call.mockResolvedValue({ data: undefined })
      const provider = wrapPublicClient(mock as any)
      const result = await provider.call({ to: '0xcontract', data: '0xcalldata' })
      expect(result).toBe('0x')
    })
  })

  describe('estimateGas', () => {
    it('delegates to client.estimateGas', async () => {
      const mock = createMockViemClient()
      mock.estimateGas.mockResolvedValue(21000n)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.estimateGas({
        to: '0xcontract',
        data: '0xcalldata',
        from: '0xsender',
        value: 1000n,
      })
      expect(result).toBe(21000n)
      expect(mock.estimateGas).toHaveBeenCalledWith({
        to: '0xcontract',
        data: '0xcalldata',
        account: '0xsender',
        value: 1000n,
      })
    })
  })

  describe('getBalance', () => {
    it('delegates to client.getBalance', async () => {
      const mock = createMockViemClient()
      mock.getBalance.mockResolvedValue(1000000000000000000n)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getBalance('0xaddr')
      expect(result).toBe(1000000000000000000n)
      expect(mock.getBalance).toHaveBeenCalledWith({ address: '0xaddr' })
    })

    it('passes blockTag when provided', async () => {
      const mock = createMockViemClient()
      mock.getBalance.mockResolvedValue(0n)
      const provider = wrapPublicClient(mock as any)
      await provider.getBalance('0xaddr', 100)
      expect(mock.getBalance).toHaveBeenCalledWith({
        address: '0xaddr',
        blockNumber: 100n,
      })
    })
  })

  describe('getCode', () => {
    it('delegates to client.getCode', async () => {
      const mock = createMockViemClient()
      mock.getCode.mockResolvedValue('0x6080604052')
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getCode('0xcontract')
      expect(result).toBe('0x6080604052')
      expect(mock.getCode).toHaveBeenCalledWith({ address: '0xcontract' })
    })

    it('returns 0x for accounts with no code', async () => {
      const mock = createMockViemClient()
      mock.getCode.mockResolvedValue(undefined)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getCode('0xeoa')
      expect(result).toBe('0x')
    })

    it('passes numeric blockTag to client.getCode', async () => {
      const mock = createMockViemClient()
      mock.getCode.mockResolvedValue('0x6080604052')
      const provider = wrapPublicClient(mock as any)
      await provider.getCode('0xcontract', 100)
      expect(mock.getCode).toHaveBeenCalledWith({
        address: '0xcontract',
        blockNumber: 100n,
      })
    })

    it('passes string blockTag to client.getCode', async () => {
      const mock = createMockViemClient()
      mock.getCode.mockResolvedValue('0x6080604052')
      const provider = wrapPublicClient(mock as any)
      await provider.getCode('0xcontract', 'safe')
      expect(mock.getCode).toHaveBeenCalledWith({
        address: '0xcontract',
        blockTag: 'safe',
      })
    })
  })

  describe('getStorageAt', () => {
    it('delegates to client.getStorageAt', async () => {
      const mock = createMockViemClient()
      mock.getStorageAt.mockResolvedValue(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getStorageAt('0xcontract', '0x0')
      expect(result).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(mock.getStorageAt).toHaveBeenCalledWith({
        address: '0xcontract',
        slot: '0x0',
      })
    })

    it('returns 0x for empty storage', async () => {
      const mock = createMockViemClient()
      mock.getStorageAt.mockResolvedValue(undefined)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getStorageAt('0xcontract', '0x0')
      expect(result).toBe('0x')
    })
  })

  describe('getTransactionCount', () => {
    it('delegates to client.getTransactionCount', async () => {
      const mock = createMockViemClient()
      mock.getTransactionCount.mockResolvedValue(42)
      const provider = wrapPublicClient(mock as any)
      const result = await provider.getTransactionCount('0xaddr')
      expect(result).toBe(42)
      expect(mock.getTransactionCount).toHaveBeenCalledWith({ address: '0xaddr' })
    })
  })

  describe('getLogs', () => {
    it('delegates to client.getLogs and converts results', async () => {
      const mock = createMockViemClient()
      mock.getLogs.mockResolvedValue([
        {
          address: '0xlogaddr',
          topics: ['0xtopic0'],
          data: '0xdata',
          blockNumber: 300n,
          blockHash: '0xblockhash',
          transactionHash: '0xtxhash',
          transactionIndex: 5,
          logIndex: 2,
          removed: false,
        },
      ])
      const provider = wrapPublicClient(mock as any)
      const logs = await provider.getLogs({
        address: '0xlogaddr',
        topics: ['0xtopic0'],
        fromBlock: 100,
        toBlock: 200,
      })
      expect(logs).toHaveLength(1)
      expect(logs[0].blockNumber).toBe(300)
      expect(typeof logs[0].blockNumber).toBe('number')
      expect(logs[0].address).toBe('0xlogaddr')
      expect(mock.getLogs).toHaveBeenCalledWith({
        address: '0xlogaddr',
        topics: ['0xtopic0'],
        fromBlock: 100n,
        toBlock: 200n,
      })
    })

    it('handles string block tags in log filter', async () => {
      const mock = createMockViemClient()
      mock.getLogs.mockResolvedValue([])
      const provider = wrapPublicClient(mock as any)
      await provider.getLogs({
        fromBlock: 'latest',
        toBlock: 'latest',
      })
      expect(mock.getLogs).toHaveBeenCalledWith({
        fromBlock: 'latest',
        toBlock: 'latest',
      })
    })
  })

  describe('getFeeData', () => {
    it('returns fee data from estimateFeesPerGas and getGasPrice', async () => {
      const mock = createMockViemClient()
      mock.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1000000000n,
      })
      mock.getGasPrice.mockResolvedValue(25000000000n)
      const provider = wrapPublicClient(mock as any)
      const feeData = await provider.getFeeData()
      expect(feeData.maxFeePerGas).toBe(30000000000n)
      expect(feeData.maxPriorityFeePerGas).toBe(1000000000n)
      expect(feeData.gasPrice).toBe(25000000000n)
    })

    it('handles legacy chains without EIP-1559', async () => {
      const mock = createMockViemClient()
      mock.estimateFeesPerGas.mockRejectedValue(new Error('not supported'))
      mock.getGasPrice.mockResolvedValue(20000000000n)
      const provider = wrapPublicClient(mock as any)
      const feeData = await provider.getFeeData()
      expect(feeData.gasPrice).toBe(20000000000n)
      expect(feeData.maxFeePerGas).toBeNull()
      expect(feeData.maxPriorityFeePerGas).toBeNull()
    })
  })
})

describe('fromViemReceipt', () => {
  it('converts a viem TransactionReceipt to ArbitrumTransactionReceipt', () => {
    const viemReceipt = {
      to: '0xto' as `0x${string}`,
      from: '0xfrom' as `0x${string}`,
      contractAddress: null,
      transactionHash: '0xtxhash' as `0x${string}`,
      transactionIndex: 1,
      blockHash: '0xblockhash' as `0x${string}`,
      blockNumber: 500n,
      status: 'success' as const,
      logs: [
        {
          address: '0xaddr' as `0x${string}`,
          topics: ['0xtopic0' as `0x${string}`],
          data: '0xdata' as `0x${string}`,
          blockNumber: 500n,
          blockHash: '0xblockhash' as `0x${string}`,
          transactionHash: '0xtxhash' as `0x${string}`,
          transactionIndex: 1,
          logIndex: 0,
          removed: false,
        },
      ],
      gasUsed: 50000n,
      effectiveGasPrice: 2000000000n,
      cumulativeGasUsed: 200000n,
    }

    const result = fromViemReceipt(viemReceipt as any)
    expect(result.status).toBe(1)
    expect(result.blockNumber).toBe(500)
    expect(typeof result.blockNumber).toBe('number')
    expect(result.gasUsed).toBe(50000n)
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].blockNumber).toBe(500)
  })

  it('converts reverted status to 0', () => {
    const viemReceipt = {
      to: '0xto' as `0x${string}`,
      from: '0xfrom' as `0x${string}`,
      contractAddress: null,
      transactionHash: '0xtxhash' as `0x${string}`,
      transactionIndex: 0,
      blockHash: '0xblockhash' as `0x${string}`,
      blockNumber: 100n,
      status: 'reverted' as const,
      logs: [],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }

    const result = fromViemReceipt(viemReceipt as any)
    expect(result.status).toBe(0)
  })
})

describe('fromViemLog', () => {
  it('converts a viem Log to ArbitrumLog', () => {
    const viemLog = {
      address: '0xlogaddr' as `0x${string}`,
      topics: ['0xtopic0' as `0x${string}`, '0xtopic1' as `0x${string}`],
      data: '0xlogdata' as `0x${string}`,
      blockNumber: 999n,
      blockHash: '0xblockhash' as `0x${string}`,
      transactionHash: '0xtxhash' as `0x${string}`,
      transactionIndex: 7,
      logIndex: 3,
      removed: false,
    }

    const result = fromViemLog(viemLog as any)
    expect(result.address).toBe('0xlogaddr')
    expect(result.topics).toEqual(['0xtopic0', '0xtopic1'])
    expect(result.data).toBe('0xlogdata')
    expect(result.blockNumber).toBe(999)
    expect(typeof result.blockNumber).toBe('number')
    expect(result.logIndex).toBe(3)
  })
})
