/**
 * Tests for the ethers v6 ETH bridger re-export layer.
 *
 * Verifies that ETH deposit/withdrawal functions work through the ethers6 package
 * and return TransactionRequestData with bigint values.
 */
import { describe, it, expect } from 'vitest'
import {
  getDepositRequest,
  getWithdrawalRequest,
} from '../src/eth'
import type { ArbitrumNetwork } from '@arbitrum/core'

// A minimal ArbitrumNetwork for ETH-native chains
const mockNetwork: ArbitrumNetwork = {
  chainId: 42161,
  parentChainId: 1,
  name: 'Arbitrum One',
  confirmPeriodBlocks: 45818,
  ethBridge: {
    bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
    outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
    rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
  },
  isCustom: false,
  isTestnet: false,
}

describe('ethers6 ETH functions', () => {
  describe('getDepositRequest', () => {
    it('builds an ETH deposit request with bigint value', () => {
      const result = getDepositRequest({
        network: mockNetwork,
        amount: 1000000000000000000n, // 1 ETH
        from: '0x1234567890abcdef1234567890abcdef12345678',
      })

      expect(result).toBeDefined()
      expect(result.to).toBe(mockNetwork.ethBridge.inbox)
      expect(result.value).toBe(1000000000000000000n)
      expect(typeof result.value).toBe('bigint')
      expect(typeof result.data).toBe('string')
      expect(result.data.startsWith('0x')).toBe(true)
      expect(result.from).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })
  })

  describe('getWithdrawalRequest', () => {
    it('builds an ETH withdrawal request', () => {
      const result = getWithdrawalRequest({
        network: mockNetwork,
        amount: 500000000000000000n, // 0.5 ETH
        destinationAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        from: '0x1234567890abcdef1234567890abcdef12345678',
      })

      expect(result).toBeDefined()
      expect(result.value).toBe(500000000000000000n)
      expect(typeof result.value).toBe('bigint')
      expect(typeof result.data).toBe('string')
      expect(result.data.startsWith('0x')).toBe(true)
    })
  })
})
