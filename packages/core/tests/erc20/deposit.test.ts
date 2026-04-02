import { describe, it, expect, vi } from 'vitest'
import { getApproveTokenRequest } from '../../src/erc20/deposit'
import { getArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { encodeFunctionData } from '../../src/encoding/abi'
import { ERC20Abi } from '../../src/abi/ERC20'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const TOKEN_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const GATEWAY_ADDRESS = '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'

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
    call: vi.fn().mockResolvedValue(encodeAddress(GATEWAY_ADDRESS)),
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

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

describe('ERC-20 Deposit', () => {
  const network = getArbitrumNetwork(42161)

  describe('getApproveTokenRequest', () => {
    it('returns ERC20.approve calldata for the resolved gateway', async () => {
      const parentProvider = createMockProvider()

      const result = await getApproveTokenRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        from: SENDER,
        parentProvider,
      })

      // Should target the token contract
      expect(result.to).toBe(TOKEN_ADDRESS)
      expect(result.value).toBe(0n)
      expect(result.from).toBe(SENDER)

      // Should encode approve(gateway, maxUint256) with the resolved gateway
      const expectedData = encodeFunctionData(ERC20Abi, 'approve', [
        GATEWAY_ADDRESS.toLowerCase(),
        MAX_UINT256,
      ])
      expect(result.data).toBe(expectedData)
    })

    it('uses custom amount when provided', async () => {
      const parentProvider = createMockProvider()
      const customAmount = 1000000n

      const result = await getApproveTokenRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        from: SENDER,
        parentProvider,
        amount: customAmount,
      })

      const expectedData = encodeFunctionData(ERC20Abi, 'approve', [
        GATEWAY_ADDRESS.toLowerCase(),
        customAmount,
      ])
      expect(result.data).toBe(expectedData)
    })

    it('resolves the gateway from the router', async () => {
      const mockCall = vi
        .fn()
        .mockResolvedValue(encodeAddress(GATEWAY_ADDRESS))

      const parentProvider = createMockProvider({ call: mockCall })

      await getApproveTokenRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        from: SENDER,
        parentProvider,
      })

      // Should have called the router to get the gateway
      expect(mockCall).toHaveBeenCalled()
      const callArg = mockCall.mock.calls[0][0]
      expect(callArg.to).toBe(network.tokenBridge!.parentGatewayRouter)
    })
  })
})
