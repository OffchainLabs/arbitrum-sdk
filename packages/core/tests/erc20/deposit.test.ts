import { describe, it, expect, vi } from 'vitest'
import { getApproveTokenRequest, getErc20DepositRequest } from '../../src/erc20/deposit'
import { getArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { encodeFunctionData } from '../../src/encoding/abi'
import { ERC20Abi } from '../../src/abi/ERC20'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const TOKEN_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const GATEWAY_ADDRESS = '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'
const WETH_GATEWAY_ADDRESS = '0xd92023E9d9911199a6711321D1277285e6d4e2db'
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

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

  describe('getErc20DepositRequest WETH detection', () => {
    /**
     * Create a mock parent provider that returns the specified gateway address
     * from the router, and optionally simulates a WETH gateway (l1Weth returns
     * a non-zero address).
     */
    function createParentProvider(
      gatewayAddr: string,
      isWeth: boolean
    ): ArbitrumProvider {
      const submissionFee = 10000n
      const mockCall = vi.fn().mockImplementation(
        (request: { to: string; data: string }) => {
          const selector = request.data.slice(0, 10)
          // getGateway selector
          if (request.to.toLowerCase() === network.tokenBridge!.parentGatewayRouter.toLowerCase()) {
            return Promise.resolve(encodeAddress(gatewayAddr))
          }
          // l1Weth() selector = 0x70840075 (from L1WethGateway ABI)
          if (request.to.toLowerCase() === gatewayAddr.toLowerCase()) {
            if (isWeth) {
              return Promise.resolve(encodeAddress(WETH_ADDRESS))
            }
            // Not a WETH gateway - revert
            return Promise.reject(new Error('execution reverted'))
          }
          // Inbox.calculateRetryableSubmissionFee
          return Promise.resolve('0x' + submissionFee.toString(16).padStart(64, '0'))
        }
      )

      return createMockProvider({
        call: mockCall,
        getBlock: vi.fn().mockResolvedValue({
          hash: '0x',
          parentHash: '0x',
          number: 100,
          timestamp: 1000,
          nonce: '0x',
          difficulty: 0n,
          gasLimit: 30000000n,
          gasUsed: 0n,
          miner: '0x0000000000000000000000000000000000000000',
          baseFeePerGas: 1000000000n,
          transactions: [],
        }),
      })
    }

    function createChildProvider(): ArbitrumProvider {
      return createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice: 100000000n,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        estimateGas: vi.fn().mockResolvedValue(100000n),
      })
    }

    it('sets l2CallValue to amount for WETH gateway deposits', async () => {
      const amount = 1000000000000000000n // 1 WETH
      const parentProvider = createParentProvider(WETH_GATEWAY_ADDRESS, true)
      const childProvider = createChildProvider()

      const result = await getErc20DepositRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount,
        from: SENDER,
        parentProvider,
        childProvider,
      })

      // The deposit should include the amount as l2CallValue
      // deposit = gasLimit * maxFeePerGas + maxSubmissionCost + l2CallValue
      // Since l2CallValue = amount, the deposit should be significantly larger
      expect(result.gasEstimates.deposit).toBeGreaterThan(amount)
    })

    it('sets l2CallValue to 0 for non-WETH gateway deposits', async () => {
      const amount = 1000000000000000000n // 1 token
      const parentProvider = createParentProvider(GATEWAY_ADDRESS, false)
      const childProvider = createChildProvider()

      const result = await getErc20DepositRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount,
        from: SENDER,
        parentProvider,
        childProvider,
      })

      // The deposit should NOT include the amount as l2CallValue
      // deposit = gasLimit * maxFeePerGas + maxSubmissionCost (l2CallValue = 0)
      expect(result.gasEstimates.deposit).toBeLessThan(amount)
    })
  })
})
