/**
 * Tests for viem ERC-20 bridging re-exports.
 *
 * The ERC-20 withdrawal function doesn't need a provider, so we can test it directly.
 * The deposit and approve functions need providers, so we verify the type signature
 * accepts viem PublicClient.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  getErc20WithdrawalRequest,
  getApproveTokenRequest,
} from '../src/erc20'
import type { ArbitrumNetwork } from '@arbitrum/core'

const testNetwork: ArbitrumNetwork = {
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
  tokenBridge: {
    parentGatewayRouter: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
    childGatewayRouter: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
    parentErc20Gateway: '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
    childErc20Gateway: '0x09e9222E96E7B4AE2a407B98d48e330053351EEe',
    parentCustomGateway: '0xcEe284F754E854890e311e3280b767F80797180d',
    childCustomGateway: '0x096760F208390250649E3e8763348E783AEF5562',
    parentWethGateway: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
    childWethGateway: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
    parentWeth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    childWeth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  confirmPeriodBlocks: 45818,
  isTestnet: false,
  isCustom: false,
}

describe('viem ERC-20 bridging', () => {
  describe('getErc20WithdrawalRequest', () => {
    it('builds a withdrawal request', () => {
      const result = getErc20WithdrawalRequest({
        network: testNetwork,
        erc20ParentAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: 1000000n, // 1 USDC
        destinationAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe(testNetwork.tokenBridge!.childGatewayRouter)
      expect(result.value).toBe(0n)
      expect(result.from).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
      expect(result.data).toBeDefined()
    })
  })

  describe('getApproveTokenRequest', () => {
    it('accepts a mock viem PublicClient for gateway resolution', async () => {
      // Create a mock that returns a gateway address when queried
      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(1),
        getBlock: vi.fn(),
        getBlockNumber: vi.fn(),
        getTransactionReceipt: vi.fn(),
        getLogs: vi.fn(),
        call: vi.fn().mockResolvedValue({
          data:
            '0x000000000000000000000000a3a7b6f88361f48403514059f1f16c8e78d60eec',
        }),
        estimateGas: vi.fn(),
        getCode: vi.fn(),
        getBalance: vi.fn(),
        getGasPrice: vi.fn(),
        estimateFeesPerGas: vi.fn(),
        getStorageAt: vi.fn(),
        getTransactionCount: vi.fn(),
      }

      const result = await getApproveTokenRequest({
        network: testNetwork,
        erc20ParentAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        parentProvider: mockClient as any,
      })

      expect(result.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(result.value).toBe(0n)
      expect(result.data).toBeDefined()
    })
  })
})
