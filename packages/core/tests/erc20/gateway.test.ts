import { describe, it, expect, vi } from 'vitest'
import {
  getParentGatewayAddress,
  getChildGatewayAddress,
  getChildErc20Address,
  getParentErc20Address,
} from '../../src/erc20/gateway'
import { getArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'

const TOKEN_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F' // DAI on mainnet
const CHILD_TOKEN_ADDRESS = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
const GATEWAY_ADDRESS = '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'

/**
 * Encode an address as a 32-byte ABI return value.
 */
function encodeAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '')
  return '0x' + clean.padStart(64, '0')
}

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(1),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x' + '0'.repeat(64)),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x0'),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: 0n,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }),
    ...overrides,
  }
}

describe('ERC-20 Gateway Resolution', () => {
  const network = getArbitrumNetwork(42161) // Arbitrum One

  describe('getParentGatewayAddress', () => {
    it('returns the gateway address from the L1 router', async () => {
      const mockCall = vi
        .fn()
        .mockResolvedValue(encodeAddress(GATEWAY_ADDRESS))

      const parentProvider = createMockProvider({ call: mockCall })

      const result = await getParentGatewayAddress(
        TOKEN_ADDRESS,
        parentProvider,
        network
      )

      expect(result.toLowerCase()).toBe(GATEWAY_ADDRESS.toLowerCase())
      expect(mockCall).toHaveBeenCalled()

      // Verify the call targets the parent gateway router
      const callArg = mockCall.mock.calls[0][0]
      expect(callArg.to).toBe(network.tokenBridge!.parentGatewayRouter)
    })
  })

  describe('getChildGatewayAddress', () => {
    it('returns the gateway address from the L2 router', async () => {
      const childGateway = '0x09e9222E96E7B4AE2a407B98d48e330053351EEe'
      const mockCall = vi
        .fn()
        .mockResolvedValue(encodeAddress(childGateway))

      const childProvider = createMockProvider({ call: mockCall })

      const result = await getChildGatewayAddress(
        TOKEN_ADDRESS,
        childProvider,
        network
      )

      expect(result.toLowerCase()).toBe(childGateway.toLowerCase())
      expect(mockCall).toHaveBeenCalled()

      // Verify the call targets the child gateway router
      const callArg = mockCall.mock.calls[0][0]
      expect(callArg.to).toBe(network.tokenBridge!.childGatewayRouter)
    })
  })

  describe('getChildErc20Address', () => {
    it('returns the calculated child token address', async () => {
      const mockCall = vi
        .fn()
        .mockResolvedValue(encodeAddress(CHILD_TOKEN_ADDRESS))

      const parentProvider = createMockProvider({ call: mockCall })

      const result = await getChildErc20Address(
        TOKEN_ADDRESS,
        parentProvider,
        network
      )

      expect(result.toLowerCase()).toBe(CHILD_TOKEN_ADDRESS.toLowerCase())
    })
  })

  describe('getParentErc20Address', () => {
    it('returns parent WETH for child WETH', async () => {
      const childProvider = createMockProvider()

      const result = await getParentErc20Address(
        network.tokenBridge!.childWeth,
        childProvider,
        network
      )

      expect(result).toBe(network.tokenBridge!.parentWeth)
    })

    it('reads l1Address from the child token and validates', async () => {
      // First call: l1Address() returns TOKEN_ADDRESS
      // Second call: calculateL2TokenAddress() returns CHILD_TOKEN_ADDRESS
      const mockCall = vi
        .fn()
        .mockResolvedValueOnce(encodeAddress(TOKEN_ADDRESS))
        .mockResolvedValueOnce(encodeAddress(CHILD_TOKEN_ADDRESS))

      const childProvider = createMockProvider({ call: mockCall })

      const result = await getParentErc20Address(
        CHILD_TOKEN_ADDRESS,
        childProvider,
        network
      )

      expect(result.toLowerCase()).toBe(TOKEN_ADDRESS.toLowerCase())
    })

    it('throws when child address does not match', async () => {
      const differentChildAddress =
        '0x0000000000000000000000000000000000000999'

      // First call: l1Address() returns TOKEN_ADDRESS
      // Second call: calculateL2TokenAddress() returns a DIFFERENT address
      const mockCall = vi
        .fn()
        .mockResolvedValueOnce(encodeAddress(TOKEN_ADDRESS))
        .mockResolvedValueOnce(encodeAddress(differentChildAddress))

      const childProvider = createMockProvider({ call: mockCall })

      await expect(
        getParentErc20Address(CHILD_TOKEN_ADDRESS, childProvider, network)
      ).rejects.toThrow('Unexpected parent address')
    })
  })
})
