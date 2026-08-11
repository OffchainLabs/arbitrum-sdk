/**
 * Tests for viem network re-exports.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getArbitrumNetworkFromProvider,
} from '../src/network'

describe('viem network functions', () => {
  describe('getArbitrumNetwork', () => {
    it('returns Arbitrum One by chain ID', () => {
      const network = getArbitrumNetwork(42161)
      expect(network.name).toBe('Arbitrum One')
      expect(network.chainId).toBe(42161)
      expect(network.parentChainId).toBe(1)
    })
  })

  describe('getArbitrumNetworks', () => {
    it('returns an array of networks', () => {
      const networks = getArbitrumNetworks()
      expect(Array.isArray(networks)).toBe(true)
      expect(networks.length).toBeGreaterThan(0)
    })
  })

  describe('getArbitrumNetworkFromProvider', () => {
    it('resolves network from a mock viem PublicClient', async () => {
      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(42161),
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

      const network = await getArbitrumNetworkFromProvider(mockClient as any)
      expect(network.chainId).toBe(42161)
      expect(network.name).toBe('Arbitrum One')
    })

    it('throws for unknown chain ID', async () => {
      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(999999),
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

      await expect(
        getArbitrumNetworkFromProvider(mockClient as any)
      ).rejects.toThrow()
    })
  })
})
