/**
 * Tests for the ethers v6 adapter layer.
 *
 * Verifies that wrapProvider converts ethers v6 Provider into ArbitrumProvider,
 * and that fromEthersReceipt / fromEthersLog correctly handle bigint-native fields.
 *
 * Key ethers v6 differences tested:
 * - getNetwork() returns { chainId: bigint } (not number)
 * - All numeric values are native bigint (no BigNumber)
 * - Receipt uses 'hash' instead of 'transactionHash', 'index' instead of 'transactionIndex'
 * - Log uses 'index' instead of 'logIndex'
 * - getStorage() instead of getStorageAt()
 */
import { describe, it, expect } from 'vitest'
import { wrapProvider, fromEthersReceipt, fromEthersLog } from '../src/adapter'

// ---------------------------------------------------------------------------
// Mock ethers v6 types (bigint-native)
// ---------------------------------------------------------------------------

function createMockProvider() {
  return {
    getNetwork: async () => ({ chainId: 42161n, name: 'arbitrum' }), // bigint chainId!
    getBlock: async (_tag: any) => ({
      hash: '0xblockhash',
      parentHash: '0xparenthash',
      number: 100,
      timestamp: 1234567890,
      nonce: '0x0000000000000000',
      difficulty: 0n, // native bigint
      gasLimit: 30000000n, // native bigint
      gasUsed: 21000n, // native bigint
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n, // native bigint
      transactions: ['0xtx1', '0xtx2'],
    }),
    getBlockNumber: async () => 100,
    getTransactionReceipt: async (_hash: string) => ({
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      index: 0, // v6 uses 'index' not 'transactionIndex'
      gasUsed: 21000n,
      blockHash: '0xblockhash',
      hash: '0xtxhash', // v6 uses 'hash' not 'transactionHash'
      logs: [
        {
          address: '0xlogaddr',
          topics: ['0xtopic0'] as readonly string[],
          data: '0xlogdata',
          blockNumber: 100,
          blockHash: '0xblockhash',
          transactionHash: '0xtxhash',
          transactionIndex: 0,
          index: 0, // v6 uses 'index' not 'logIndex'
          removed: false,
        },
      ],
      blockNumber: 100,
      cumulativeGasUsed: 21000n,
      gasPrice: 100000000n, // v6 uses 'gasPrice' not 'effectiveGasPrice'
      type: 2,
      status: 1,
    }),
    getLogs: async (_filter: any) => [
      {
        address: '0xlogaddr',
        topics: ['0xtopic0'] as readonly string[],
        data: '0xlogdata',
        blockNumber: 100,
        blockHash: '0xblockhash',
        transactionHash: '0xtxhash',
        transactionIndex: 0,
        index: 0,
        removed: false,
      },
    ],
    call: async (_tx: any) => '0xcallresult',
    estimateGas: async (_tx: any) => 21000n, // native bigint
    getCode: async (_addr: string) => '0x6080',
    getBalance: async (_addr: string) => 1000000000000000000n, // native bigint
    getStorage: async (_addr: string, _slot: string | number) =>
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    getTransactionCount: async (_addr: string) => 42,
    getFeeData: async () => ({
      gasPrice: 100000000n, // native bigint
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1500000000n,
    }),
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

  it('getChainId converts bigint chainId to number', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const chainId = await wrapped.getChainId()
    expect(chainId).toBe(42161)
    expect(typeof chainId).toBe('number') // must be number, not bigint
  })

  it('getBlockNumber returns a number', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const blockNumber = await wrapped.getBlockNumber()
    expect(blockNumber).toBe(100)
    expect(typeof blockNumber).toBe('number')
  })

  it('getBlock passes through bigint fields directly', async () => {
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
      difficulty: 1000n,
      gasLimit: 30000000n,
      gasUsed: 21000n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: null,
      transactions: [],
    })
    const wrapped = wrapProvider(mock as any)
    const block = await wrapped.getBlock(50)
    expect(block).not.toBeNull()
    expect(block!.baseFeePerGas).toBeNull()
  })

  it('getBlock handles null hash', async () => {
    const mock = createMockProvider()
    mock.getBlock = async () => ({
      hash: null, // v6 can return null hash for pending blocks
      parentHash: '0xparenthash',
      number: 100,
      timestamp: 1234567890,
      nonce: '0x0000000000000000',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 21000n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n,
      transactions: [],
    })
    const wrapped = wrapProvider(mock as any)
    const block = await wrapped.getBlock(100)
    expect(block).not.toBeNull()
    expect(block!.hash).toBe('') // null hash becomes empty string
  })

  it('getTransactionReceipt converts v6 field names', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const receipt = await wrapped.getTransactionReceipt('0xtxhash')
    expect(receipt).not.toBeNull()
    expect(receipt!.transactionHash).toBe('0xtxhash') // mapped from 'hash'
    expect(receipt!.transactionIndex).toBe(0) // mapped from 'index'
    expect(receipt!.gasUsed).toBe(21000n)
    expect(typeof receipt!.gasUsed).toBe('bigint')
    expect(receipt!.cumulativeGasUsed).toBe(21000n)
    expect(typeof receipt!.cumulativeGasUsed).toBe('bigint')
    expect(receipt!.effectiveGasPrice).toBe(100000000n) // mapped from 'gasPrice'
    expect(typeof receipt!.effectiveGasPrice).toBe('bigint')
    expect(receipt!.status).toBe(1)
    expect(typeof receipt!.status).toBe('number')
    expect(receipt!.logs).toHaveLength(1)
    expect(receipt!.logs[0].address).toBe('0xlogaddr')
    expect(receipt!.logs[0].logIndex).toBe(0) // mapped from 'index'
  })

  it('getTransactionReceipt returns null when not found', async () => {
    const mock = createMockProvider()
    mock.getTransactionReceipt = async () => null as any
    const wrapped = wrapProvider(mock as any)
    const receipt = await wrapped.getTransactionReceipt('0xnotfound')
    expect(receipt).toBeNull()
  })

  it('getFeeData passes through bigint values', async () => {
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
      gasPrice: 100000000n,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    })
    const wrapped = wrapProvider(mock as any)
    const feeData = await wrapped.getFeeData()
    expect(feeData.gasPrice).toBe(100000000n)
    expect(feeData.maxFeePerGas).toBeNull()
    expect(feeData.maxPriorityFeePerGas).toBeNull()
  })

  it('estimateGas passes through bigint directly', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const gas = await wrapped.estimateGas({ to: '0xto', data: '0x' })
    expect(gas).toBe(21000n)
    expect(typeof gas).toBe('bigint')
  })

  it('getBalance passes through bigint directly', async () => {
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

  it('call passes blockTag to ethers6 provider', async () => {
    const mock = createMockProvider()
    const callSpy = vi.fn().mockResolvedValue('0xresult')
    mock.call = callSpy
    const wrapped = wrapProvider(mock as any)
    await wrapped.call({ to: '0xto', data: '0xcalldata', blockTag: 42 })
    // ethers6 call should receive blockTag in the tx object
    expect(callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: '0xto', data: '0xcalldata', blockTag: 42 })
    )
  })

  it('call passes string blockTag to ethers6 provider', async () => {
    const mock = createMockProvider()
    const callSpy = vi.fn().mockResolvedValue('0xresult')
    mock.call = callSpy
    const wrapped = wrapProvider(mock as any)
    await wrapped.call({ to: '0xto', data: '0xcalldata', blockTag: 'safe' })
    expect(callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: '0xto', data: '0xcalldata', blockTag: 'safe' })
    )
  })

  it('getCode returns hex string', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const code = await wrapped.getCode('0xaddr')
    expect(code).toBe('0x6080')
  })

  it('getStorageAt delegates to v6 getStorage', async () => {
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

  it('getLogs converts logs correctly with v6 index field', async () => {
    const wrapped = wrapProvider(createMockProvider() as any)
    const logs = await wrapped.getLogs({})
    expect(logs).toHaveLength(1)
    expect(logs[0].address).toBe('0xlogaddr')
    expect(logs[0].topics).toEqual(['0xtopic0'])
    expect(logs[0].blockNumber).toBe(100)
    expect(logs[0].logIndex).toBe(0) // mapped from v6 'index'
  })
})

describe('fromEthersReceipt', () => {
  it('converts ethers v6 receipt to ArbitrumTransactionReceipt', () => {
    const ethersReceipt = {
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      index: 0, // v6 field
      gasUsed: 21000n,
      blockHash: '0xblockhash',
      hash: '0xtxhash', // v6 field
      logs: [
        {
          address: '0xlogaddr',
          topics: ['0xtopic0'] as readonly string[],
          data: '0xlogdata',
          blockNumber: 100,
          blockHash: '0xblockhash',
          transactionHash: '0xtxhash',
          transactionIndex: 0,
          index: 0, // v6 field
          removed: false,
        },
      ],
      blockNumber: 100,
      cumulativeGasUsed: 21000n,
      gasPrice: 100000000n, // v6 field
      type: 2,
      status: 1,
    }

    const result = fromEthersReceipt(ethersReceipt as any)

    expect(result.to).toBe('0xto')
    expect(result.from).toBe('0xfrom')
    expect(result.contractAddress).toBeNull()
    expect(result.transactionHash).toBe('0xtxhash') // mapped from 'hash'
    expect(result.transactionIndex).toBe(0) // mapped from 'index'
    expect(result.blockHash).toBe('0xblockhash')
    expect(result.blockNumber).toBe(100)
    expect(result.status).toBe(1)
    expect(result.gasUsed).toBe(21000n)
    expect(typeof result.gasUsed).toBe('bigint')
    expect(result.cumulativeGasUsed).toBe(21000n)
    expect(typeof result.cumulativeGasUsed).toBe('bigint')
    expect(result.effectiveGasPrice).toBe(100000000n) // mapped from 'gasPrice'
    expect(typeof result.effectiveGasPrice).toBe('bigint')
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].address).toBe('0xlogaddr')
    expect(result.logs[0].logIndex).toBe(0) // mapped from 'index'
  })

  it('handles receipt with null status', () => {
    const ethersReceipt = {
      to: '0xto',
      from: '0xfrom',
      contractAddress: null,
      index: 0,
      gasUsed: 21000n,
      blockHash: '0xblockhash',
      hash: '0xtxhash',
      logs: [],
      blockNumber: 100,
      cumulativeGasUsed: 21000n,
      gasPrice: 100000000n,
      type: 2,
      status: null as number | null,
    }

    const result = fromEthersReceipt(ethersReceipt as any)
    expect(result.status).toBe(1) // null defaults to 1
  })

  it('handles contract creation receipt', () => {
    const ethersReceipt = {
      to: null,
      from: '0xfrom',
      contractAddress: '0xnewcontract',
      index: 0,
      gasUsed: 100000n,
      blockHash: '0xblockhash',
      hash: '0xtxhash',
      logs: [],
      blockNumber: 200,
      cumulativeGasUsed: 100000n,
      gasPrice: 50000000n,
      type: 0,
      status: 1,
    }

    const result = fromEthersReceipt(ethersReceipt as any)
    expect(result.to).toBeNull()
    expect(result.contractAddress).toBe('0xnewcontract')
  })
})

describe('fromEthersLog', () => {
  it('converts ethers v6 Log to ArbitrumLog', () => {
    const ethersLog = {
      address: '0xlogaddr',
      topics: ['0xtopic0', '0xtopic1'] as readonly string[],
      data: '0xlogdata',
      blockNumber: 100,
      blockHash: '0xblockhash',
      transactionHash: '0xtxhash',
      transactionIndex: 0,
      index: 3, // v6 field
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
    expect(result.logIndex).toBe(3) // mapped from v6 'index'
    expect(result.removed).toBe(false)
  })
})
