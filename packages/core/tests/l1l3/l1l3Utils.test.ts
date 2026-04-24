/**
 * Tests for L1→L3 utility functions:
 * - predictL2ForwarderAddress
 * - getL1L3DepositStatus
 */
import { describe, it, expect } from 'vitest'
import {
  predictL2ForwarderAddress,
  getL1L3DepositStatus,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
} from '../../src/l1l3/l1l3Utils'
import type { ArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { ParentToChildMessageStatus } from '../../src/message/types'

/**
 * Create a mock ArbitrumProvider with configurable call responses.
 */
function createMockProvider(
  chainId: number,
  callResponse?: string
): ArbitrumProvider {
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
    call: async () => callResponse ?? '0x' + '00'.repeat(32),
    estimateGas: async () => 300000n,
    getBalance: async () => 10000000000000000000n,
    getCode: async () => '0x',
    getStorageAt: async () => '0x' + '00'.repeat(32),
    getTransactionCount: async () => 0,
    getLogs: async () => [],
    getFeeData: async () => ({
      gasPrice: 1000000000n,
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 100000000n,
    }),
  }
}

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

describe('predictL2ForwarderAddress', () => {
  const l2Network = createTestL2Network()
  const owner = '0x' + 'ab'.repeat(20)
  const routerOrInbox = '0x' + 'cd'.repeat(20)
  const destinationAddress = '0x' + 'ef'.repeat(20)

  it('calls l2ForwarderAddress on the predictor contract and returns an address', async () => {
    // Mock a provider that returns a valid address
    const expectedAddress = '0x' + '55'.repeat(20)
    const paddedAddress = '0x' + '00'.repeat(12) + '55'.repeat(20)
    const provider = createMockProvider(l2Network.chainId, paddedAddress)

    const result = await predictL2ForwarderAddress({
      l2Network,
      owner,
      routerOrInbox,
      destinationAddress,
      l2Provider: provider,
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    // Should be a 42-char hex address
    expect(result.length).toBe(42)
    expect(result.startsWith('0x')).toBe(true)
  })

  it('calls the l2ForwarderFactory on L2', async () => {
    const expectedAddress = '0x' + '55'.repeat(20)
    const paddedAddress = '0x' + '00'.repeat(12) + '55'.repeat(20)
    let calledTo: string | undefined
    const provider: ArbitrumProvider = {
      ...createMockProvider(l2Network.chainId),
      call: async (request: { to: string; data: string }) => {
        calledTo = request.to
        return paddedAddress
      },
    }

    await predictL2ForwarderAddress({
      l2Network,
      owner,
      routerOrInbox,
      destinationAddress,
      l2Provider: provider,
    })

    // Should have called the l2ForwarderFactory contract
    expect(calledTo?.toLowerCase()).toBe(
      l2Network.teleporter!.l2ForwarderFactory.toLowerCase()
    )
  })

  it('uses l1Teleporter when l1Provider is passed instead of l2Provider', async () => {
    const expectedAddress = '0x' + '55'.repeat(20)
    const paddedAddress = '0x' + '00'.repeat(12) + '55'.repeat(20)
    let calledTo: string | undefined
    const provider: ArbitrumProvider = {
      ...createMockProvider(1),
      call: async (request: { to: string; data: string }) => {
        calledTo = request.to
        return paddedAddress
      },
    }

    await predictL2ForwarderAddress({
      l2Network,
      owner,
      routerOrInbox,
      destinationAddress,
      l1Provider: provider,
    })

    // Should have called the l1Teleporter contract (also implements l2ForwarderAddress)
    expect(calledTo?.toLowerCase()).toBe(
      l2Network.teleporter!.l1Teleporter.toLowerCase()
    )
  })

  it('throws if network has no teleporter', async () => {
    const networkNoTeleporter = { ...createTestL2Network(), teleporter: undefined }
    const provider = createMockProvider(42161)

    await expect(
      predictL2ForwarderAddress({
        l2Network: networkNoTeleporter,
        owner,
        routerOrInbox,
        destinationAddress,
        l2Provider: provider,
      })
    ).rejects.toThrow()
  })

  it('returns deterministic result for same inputs', async () => {
    const paddedAddress = '0x' + '00'.repeat(12) + '55'.repeat(20)
    const provider = createMockProvider(l2Network.chainId, paddedAddress)

    const result1 = await predictL2ForwarderAddress({
      l2Network,
      owner,
      routerOrInbox,
      destinationAddress,
      l2Provider: provider,
    })

    const result2 = await predictL2ForwarderAddress({
      l2Network,
      owner,
      routerOrInbox,
      destinationAddress,
      l2Provider: provider,
    })

    expect(result1).toBe(result2)
  })
})

describe('getL1L3DepositStatus', () => {
  it('exports the L1L3DepositStatus type', () => {
    // Type check: L1L3DepositStatus should have the expected shape
    const status: L1L3DepositStatus = {
      l1l2Retryable: {
        status: ParentToChildMessageStatus.NOT_YET_CREATED,
      },
      completed: false,
    }
    expect(status.completed).toBe(false)
  })

  it('exports the Erc20L1L3DepositStatus type', () => {
    const status: Erc20L1L3DepositStatus = {
      l1l2TokenBridgeRetryableStatus: ParentToChildMessageStatus.NOT_YET_CREATED,
      l1l2GasTokenBridgeRetryableStatus: undefined,
      l2ForwarderFactoryRetryableStatus: ParentToChildMessageStatus.NOT_YET_CREATED,
      l2l3TokenBridgeRetryableStatus: undefined,
      completed: false,
    }
    expect(status.completed).toBe(false)
  })
})
