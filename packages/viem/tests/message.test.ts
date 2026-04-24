/**
 * Tests for viem message function re-exports.
 *
 * Verifies that message functions accept viem types directly
 * (viem TransactionReceipt and PublicClient).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  getParentToChildMessages,
  getChildToParentMessages,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
} from '../src/message'
import { fromViemReceipt } from '../src/adapter'

describe('viem message functions', () => {
  describe('getRedeemRequest', () => {
    it('returns a TransactionRequestData with correct target', () => {
      const retryableId = '0x' + '11'.repeat(32)
      const result = getRedeemRequest(retryableId)
      // Target should be ArbRetryableTx precompile
      expect(result.to).toBe('0x000000000000000000000000000000000000006E')
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
    })
  })

  describe('getCancelRetryableRequest', () => {
    it('returns a TransactionRequestData', () => {
      const retryableId = '0x' + '22'.repeat(32)
      const result = getCancelRetryableRequest(retryableId)
      expect(result.to).toBe('0x000000000000000000000000000000000000006E')
      expect(result.data).toBeDefined()
    })
  })

  describe('getKeepAliveRequest', () => {
    it('returns a TransactionRequestData', () => {
      const retryableId = '0x' + '33'.repeat(32)
      const result = getKeepAliveRequest(retryableId)
      expect(result.to).toBe('0x000000000000000000000000000000000000006E')
      expect(result.data).toBeDefined()
    })
  })

  describe('getParentToChildMessages', () => {
    it('accepts a core ArbitrumTransactionReceipt and mock provider', () => {
      // A receipt with no relevant events returns empty array
      const viemReceipt = {
        to: '0xto' as `0x${string}`,
        from: '0xfrom' as `0x${string}`,
        contractAddress: null,
        transactionHash: '0xtxhash' as `0x${string}`,
        transactionIndex: 0,
        blockHash: '0xblockhash' as `0x${string}`,
        blockNumber: 100n,
        status: 'success' as const,
        logs: [],
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
        cumulativeGasUsed: 21000n,
      }

      const mockViemClient = {
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

      const network = {
        name: 'Arbitrum One',
        chainId: 42161,
        parentChainId: 1,
        ethBridge: {
          bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
          inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
          outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
          rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
          sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
        },
        confirmPeriodBlocks: 45818,
        isTestnet: false,
        isCustom: false,
      }

      // Convert viem receipt to core receipt, then pass to getParentToChildMessages
      const coreReceipt = fromViemReceipt(viemReceipt as any)
      const messages = getParentToChildMessages(
        coreReceipt,
        mockViemClient as any,
        network
      )
      expect(messages).toEqual([])
    })
  })

  describe('getChildToParentMessages', () => {
    it('accepts a core ArbitrumTransactionReceipt and mock provider', () => {
      const viemReceipt = {
        to: '0xto' as `0x${string}`,
        from: '0xfrom' as `0x${string}`,
        contractAddress: null,
        transactionHash: '0xtxhash' as `0x${string}`,
        transactionIndex: 0,
        blockHash: '0xblockhash' as `0x${string}`,
        blockNumber: 100n,
        status: 'success' as const,
        logs: [],
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
        cumulativeGasUsed: 21000n,
      }

      const mockViemClient = {
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

      const network = {
        name: 'Arbitrum One',
        chainId: 42161,
        parentChainId: 1,
        ethBridge: {
          bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
          inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
          outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
          rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
          sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
        },
        confirmPeriodBlocks: 45818,
        isTestnet: false,
        isCustom: false,
      }

      const coreReceipt = fromViemReceipt(viemReceipt as any)
      const messages = getChildToParentMessages(
        coreReceipt,
        mockViemClient as any,
        network
      )
      expect(messages).toEqual([])
    })
  })
})
