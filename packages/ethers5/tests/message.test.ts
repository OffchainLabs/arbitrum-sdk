/**
 * Tests for the ethers v5 message re-export layer.
 *
 * Verifies that message functions accept ethers v5 TransactionReceipt and Provider,
 * converting them internally to ArbitrumProvider / ArbitrumTransactionReceipt.
 */
import { describe, it, expect } from 'vitest'
import {
  getParentToChildMessages,
  getChildToParentMessages,
} from '../src/message'
import type { ArbitrumNetwork } from '@arbitrum/core'

function bn(value: bigint) {
  return {
    toBigInt: () => value,
    toNumber: () => Number(value),
    _isBigNumber: true,
  }
}

function createMockProvider() {
  return {
    getNetwork: async () => ({ chainId: 42161, name: 'arbitrum' }),
    getBlock: async (_tag: any) => ({
      hash: '0xblockhash',
      parentHash: '0xparenthash',
      number: 100,
      timestamp: 1234567890,
      nonce: '0x0000000000000000',
      difficulty: bn(0n),
      gasLimit: bn(30000000n),
      gasUsed: bn(21000n),
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: bn(1000000000n),
      transactions: [],
    }),
    getBlockNumber: async () => 100,
    getGasPrice: async () => bn(100000000n),
    getTransactionReceipt: async (_hash: string) => null,
    getLogs: async (_filter: any) => [],
    call: async (_tx: any) => '0x',
    estimateGas: async (_tx: any) => bn(21000n),
    getCode: async (_addr: string) => '0x',
    getBalance: async (_addr: string) => bn(0n),
    waitForTransaction: async () => null,
    getFeeData: async () => ({
      gasPrice: bn(100000000n),
      maxFeePerGas: bn(2000000000n),
      maxPriorityFeePerGas: bn(1500000000n),
    }),
    getStorageAt: async (_addr: string, _slot: string | number) => '0x00',
    getTransactionCount: async (_addr: string) => 0,
  }
}

// Minimal network
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

describe('ethers5 message functions', () => {
  describe('getParentToChildMessages', () => {
    it('accepts ethers v5 receipt and provider, returns message readers', () => {
      // A receipt with no matching events returns empty array
      const ethersReceipt = {
        to: '0xto',
        from: '0xfrom',
        contractAddress: null,
        transactionIndex: 0,
        gasUsed: bn(21000n),
        logsBloom: '0x00',
        blockHash: '0xblockhash',
        transactionHash: '0xtxhash',
        logs: [],
        blockNumber: 100,
        confirmations: 1,
        cumulativeGasUsed: bn(21000n),
        effectiveGasPrice: bn(100000000n),
        byzantium: true,
        type: 2,
        status: 1,
      }

      const mockProvider = createMockProvider()

      // With no events in the receipt, we should get empty array
      const messages = getParentToChildMessages(
        ethersReceipt as any,
        mockProvider as any,
        mockNetwork
      )

      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBe(0)
    })
  })

  describe('getChildToParentMessages', () => {
    it('accepts ethers v5 receipt and provider, returns message readers', () => {
      const ethersReceipt = {
        to: '0xto',
        from: '0xfrom',
        contractAddress: null,
        transactionIndex: 0,
        gasUsed: bn(21000n),
        logsBloom: '0x00',
        blockHash: '0xblockhash',
        transactionHash: '0xtxhash',
        logs: [],
        blockNumber: 100,
        confirmations: 1,
        cumulativeGasUsed: bn(21000n),
        effectiveGasPrice: bn(100000000n),
        byzantium: true,
        type: 2,
        status: 1,
      }

      const mockProvider = createMockProvider()

      const messages = getChildToParentMessages(
        ethersReceipt as any,
        mockProvider as any,
        mockNetwork
      )

      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBe(0)
    })
  })
})
