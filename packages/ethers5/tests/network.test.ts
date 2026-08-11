/**
 * Tests for the ethers v5 network re-export layer.
 *
 * Verifies that getArbitrumNetworkFromProvider accepts ethers v5 Provider.
 */
import { describe, it, expect } from 'vitest'
import {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getArbitrumNetworkFromProvider,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
} from '../src/network'

function bn(value: bigint) {
  return {
    toBigInt: () => value,
    toNumber: () => Number(value),
    _isBigNumber: true,
  }
}

describe('ethers5 network functions', () => {
  it('re-exports getArbitrumNetwork from core', () => {
    const network = getArbitrumNetwork(42161)
    expect(network.chainId).toBe(42161)
    expect(network.name).toBe('Arbitrum One')
  })

  it('re-exports getArbitrumNetworks from core', () => {
    const networks = getArbitrumNetworks()
    expect(networks.length).toBeGreaterThan(0)
    expect(networks.some(n => n.chainId === 42161)).toBe(true)
  })

  it('getArbitrumNetworkFromProvider accepts ethers v5 Provider', async () => {
    const mockProvider = {
      getNetwork: async () => ({ chainId: 42161, name: 'arbitrum' }),
      getBlock: async () => null,
      getBlockNumber: async () => 100,
      getGasPrice: async () => bn(100000000n),
      getTransactionReceipt: async () => null,
      getLogs: async () => [],
      call: async () => '0x',
      estimateGas: async () => bn(21000n),
      getCode: async () => '0x',
      getBalance: async () => bn(0n),
      waitForTransaction: async () => null,
      getFeeData: async () => ({
        gasPrice: bn(100000000n),
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      }),
      getStorageAt: async () => '0x00',
      getTransactionCount: async () => 0,
    }

    const network = await getArbitrumNetworkFromProvider(mockProvider as any)
    expect(network.chainId).toBe(42161)
    expect(network.name).toBe('Arbitrum One')
  })

  it('getArbitrumNetworkFromProvider throws for unknown chain', async () => {
    const mockProvider = {
      getNetwork: async () => ({ chainId: 99999, name: 'unknown' }),
      getBlock: async () => null,
      getBlockNumber: async () => 100,
      getGasPrice: async () => bn(0n),
      getTransactionReceipt: async () => null,
      getLogs: async () => [],
      call: async () => '0x',
      estimateGas: async () => bn(0n),
      getCode: async () => '0x',
      getBalance: async () => bn(0n),
      waitForTransaction: async () => null,
      getFeeData: async () => ({
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      }),
      getStorageAt: async () => '0x00',
      getTransactionCount: async () => 0,
    }

    await expect(
      getArbitrumNetworkFromProvider(mockProvider as any)
    ).rejects.toThrow('Unrecognized network 99999')
  })

  it('registerCustomArbitrumNetwork and resetNetworksToDefault work', () => {
    const customNetwork = {
      chainId: 999999,
      parentChainId: 1,
      name: 'Custom Test',
      confirmPeriodBlocks: 100,
      ethBridge: {
        bridge: '0x0000000000000000000000000000000000000001',
        inbox: '0x0000000000000000000000000000000000000002',
        sequencerInbox: '0x0000000000000000000000000000000000000003',
        outbox: '0x0000000000000000000000000000000000000004',
        rollup: '0x0000000000000000000000000000000000000005',
      },
      isCustom: true,
      isTestnet: true,
    }

    registerCustomArbitrumNetwork(customNetwork)
    const retrieved = getArbitrumNetwork(999999)
    expect(retrieved.name).toBe('Custom Test')

    resetNetworksToDefault()
    expect(() => getArbitrumNetwork(999999)).toThrow()
  })
})
