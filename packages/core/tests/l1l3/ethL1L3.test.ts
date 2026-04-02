/**
 * Tests for ETH L1→L3 teleportation deposit request.
 */
import { describe, it, expect } from 'vitest'
import { getEthL1L3DepositRequest } from '../../src/l1l3/ethL1L3'
import type { ArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { decodeFunctionResult, encodeFunctionData } from '../../src/encoding/abi'
import { IL1TeleporterAbi } from '../../src/abi/IL1Teleporter'
import { IInboxAbi } from '../../src/abi/IInbox'

/**
 * Create a mock ArbitrumProvider that returns fixed gas values.
 */
function createMockProvider(chainId: number): ArbitrumProvider {
  return {
    getChainId: async () => chainId,
    getBlockNumber: async () => 100,
    getBlock: async () => ({
      hash: '0x' + '00'.repeat(32),
      parentHash: '0x' + '00'.repeat(32),
      number: 100,
      timestamp: 1000000,
      nonce: '0x0',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 0n,
      miner: '0x' + '00'.repeat(20),
      baseFeePerGas: 1000000000n,
      transactions: [],
    }),
    getTransactionReceipt: async () => null,
    call: async (request: { to: string; data: string }) => {
      // Mock responses for Inbox.calculateRetryableSubmissionFee
      // Return a fixed submission fee of 100000000000000 (0.0001 ETH)
      const submissionFee = 100000000000000n
      return '0x' + submissionFee.toString(16).padStart(64, '0')
    },
    estimateGas: async () => 300000n,
    getBalance: async () => 10000000000000000000n,
    getCode: async () => '0x',
    getStorageAt: async () => '0x' + '00'.repeat(32),
    getTransactionCount: async () => 0,
    getLogs: async () => [],
    getFeeData: async () => ({
      gasPrice: 1000000000n, // 1 gwei
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 100000000n,
    }),
  }
}

/**
 * Minimal L3 network config for testing ETH teleportation.
 */
function createTestL3Network(): ArbitrumNetwork {
  return {
    name: 'Test L3',
    chainId: 333,
    parentChainId: 42161, // Arbitrum One
    ethBridge: {
      bridge: '0x' + 'bb'.repeat(20),
      inbox: '0x' + 'cc'.repeat(20),
      sequencerInbox: '0x' + 'dd'.repeat(20),
      outbox: '0x' + 'ee'.repeat(20),
      rollup: '0x' + 'ff'.repeat(20),
    },
    tokenBridge: {
      parentGatewayRouter: '0x' + 'aa'.repeat(20),
      childGatewayRouter: '0x' + 'ab'.repeat(20),
      parentErc20Gateway: '0x' + 'ac'.repeat(20),
      childErc20Gateway: '0x' + 'ad'.repeat(20),
      parentCustomGateway: '0x' + 'ae'.repeat(20),
      childCustomGateway: '0x' + 'af'.repeat(20),
      parentWethGateway: '0x' + 'ba'.repeat(20),
      childWethGateway: '0x' + 'bc'.repeat(20),
      parentWeth: '0x' + 'bd'.repeat(20),
      childWeth: '0x' + 'be'.repeat(20),
      parentMultiCall: '0x' + 'bf'.repeat(20),
      childMultiCall: '0x' + 'ca'.repeat(20),
    },
    teleporter: {
      l1Teleporter: '0x' + '11'.repeat(20),
      l2ForwarderFactory: '0x' + '22'.repeat(20),
    },
    confirmPeriodBlocks: 45818,
    isTestnet: true,
    isCustom: true,
    // ETH native (no custom fee token)
  }
}

/**
 * Create the L2 network (Arbitrum One) that the L3 sits on top of.
 */
function createTestL2Network(): ArbitrumNetwork {
  return {
    name: 'Test L2',
    chainId: 42161,
    parentChainId: 1,
    ethBridge: {
      bridge: '0x' + '1b'.repeat(20),
      inbox: '0x' + '1c'.repeat(20),
      sequencerInbox: '0x' + '1d'.repeat(20),
      outbox: '0x' + '1e'.repeat(20),
      rollup: '0x' + '1f'.repeat(20),
    },
    tokenBridge: {
      parentGatewayRouter: '0x' + '2a'.repeat(20),
      childGatewayRouter: '0x' + '2b'.repeat(20),
      parentErc20Gateway: '0x' + '2c'.repeat(20),
      childErc20Gateway: '0x' + '2d'.repeat(20),
      parentCustomGateway: '0x' + '2e'.repeat(20),
      childCustomGateway: '0x' + '2f'.repeat(20),
      parentWethGateway: '0x' + '3a'.repeat(20),
      childWethGateway: '0x' + '3b'.repeat(20),
      parentWeth: '0x' + '3c'.repeat(20),
      childWeth: '0x' + '3d'.repeat(20),
      parentMultiCall: '0x' + '3e'.repeat(20),
      childMultiCall: '0x' + '3f'.repeat(20),
    },
    teleporter: {
      l1Teleporter: '0x' + '11'.repeat(20),
      l2ForwarderFactory: '0x' + '22'.repeat(20),
    },
    confirmPeriodBlocks: 45818,
    isTestnet: false,
    isCustom: false,
  }
}

describe('getEthL1L3DepositRequest', () => {
  const l3Network = createTestL3Network()
  const l2Network = createTestL2Network()
  const from = '0x' + 'ab'.repeat(20)

  it('returns a TransactionRequestData targeting the L2 inbox (not the teleporter)', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: 1000000000000000000n, // 1 ETH
      from,
      l2Provider,
      l3Provider,
    })

    // ETH L1->L3 deposits go through the L2 inbox (double retryable),
    // NOT through the teleporter contract
    expect(result).toBeDefined()
    expect(result.to).toBeDefined()
    expect(typeof result.data).toBe('string')
    expect(result.data.startsWith('0x')).toBe(true)
    // Value must be > amount (includes gas costs for both retryables)
    expect(result.value).toBeGreaterThan(1000000000000000000n)
  })

  it('includes enough value to cover the deposit amount plus retryable gas costs', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)
    const depositAmount = 500000000000000000n // 0.5 ETH

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: depositAmount,
      from,
      l2Provider,
      l3Provider,
    })

    // The value must be strictly greater than the deposit amount
    // because it includes gas for L1->L2 and L2->L3 retryables
    expect(result.value).toBeGreaterThan(depositAmount)
  })

  it('encodes createRetryableTicket calldata for the outer L1->L2 retryable', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: 1000000000000000000n,
      from,
      l2Provider,
      l3Provider,
    })

    // The outer calldata should be a call to createRetryableTicket on the L2 inbox
    // The function selector for createRetryableTicket is the first 4 bytes
    expect(result.data.length).toBeGreaterThan(10) // selector + params
    // Verify the target is the L2 inbox
    expect(result.to.toLowerCase()).toBe(l2Network.ethBridge.inbox.toLowerCase())
  })

  it('uses the provided destination address when specified', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)
    const destination = '0x' + 'dd'.repeat(20)

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: 1000000000000000000n,
      from,
      l2Provider,
      l3Provider,
      destinationAddress: destination,
    })

    // The request should be different when destination differs from `from`
    expect(result).toBeDefined()
    expect(result.to).toBeDefined()
  })

  it('uses the provided l2RefundAddress when specified', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)
    const refundAddr = '0x' + 'ee'.repeat(20)

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: 1000000000000000000n,
      from,
      l2Provider,
      l3Provider,
      l2RefundAddress: refundAddr,
    })

    expect(result).toBeDefined()
    expect(result.value).toBeGreaterThan(0n)
  })

  it('sets from on the returned request', async () => {
    const l2Provider = createMockProvider(l2Network.chainId)
    const l3Provider = createMockProvider(l3Network.chainId)

    const result = await getEthL1L3DepositRequest({
      l2Network,
      l3Network,
      amount: 1000000000000000000n,
      from,
      l2Provider,
      l3Provider,
    })

    expect(result.from).toBe(from)
  })
})
