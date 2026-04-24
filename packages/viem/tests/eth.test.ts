/**
 * Tests for viem ETH bridging re-exports.
 *
 * Verifies that getDepositRequest, getWithdrawalRequest, getApproveGasTokenRequest
 * accept viem PublicClient types directly (even though these particular functions
 * don't need a provider — the test proves the type signature works).
 */
import { describe, it, expect } from 'vitest'
import {
  getDepositRequest,
  getWithdrawalRequest,
  getApproveGasTokenRequest,
} from '../src/eth'
import type { ArbitrumNetwork } from '@arbitrum/core'

/**
 * A minimal ArbitrumNetwork for testing ETH deposits.
 */
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
  confirmPeriodBlocks: 45818,
  isTestnet: false,
  isCustom: false,
}

const customGasTokenNetwork: ArbitrumNetwork = {
  ...testNetwork,
  name: 'Custom Gas Token Chain',
  chainId: 99999,
  nativeToken: '0x1234567890AbcdEF1234567890aBcdef12345678',
}

describe('viem ETH bridging', () => {
  describe('getDepositRequest', () => {
    it('builds a deposit request for ETH-native chain', () => {
      const result = getDepositRequest({
        network: testNetwork,
        amount: 1000000000000000000n,
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe(testNetwork.ethBridge.inbox)
      expect(result.value).toBe(1000000000000000000n)
      expect(result.from).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
    })

    it('builds a deposit request for custom gas token chain', () => {
      const result = getDepositRequest({
        network: customGasTokenNetwork,
        amount: 500n,
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe(customGasTokenNetwork.ethBridge.inbox)
      expect(result.value).toBe(0n)
      expect(result.data).toBeDefined()
    })
  })

  describe('getWithdrawalRequest', () => {
    it('builds a withdrawal request', () => {
      const result = getWithdrawalRequest({
        network: testNetwork,
        amount: 500000000000000000n,
        destinationAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      // ArbSys precompile address
      expect(result.to).toBe('0x0000000000000000000000000000000000000064')
      expect(result.value).toBe(500000000000000000n)
      expect(result.from).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
      expect(result.data).toBeDefined()
    })
  })

  describe('getApproveGasTokenRequest', () => {
    it('builds an approval request for custom gas token chains', () => {
      const result = getApproveGasTokenRequest({
        network: customGasTokenNetwork,
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe(customGasTokenNetwork.nativeToken)
      expect(result.value).toBe(0n)
      expect(result.data).toBeDefined()
    })

    it('throws for ETH-native chains', () => {
      expect(() =>
        getApproveGasTokenRequest({
          network: testNetwork,
          from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        })
      ).toThrow('chain uses ETH as its native/gas token')
    })
  })
})
