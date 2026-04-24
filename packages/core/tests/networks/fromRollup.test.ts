import { describe, it, expect, vi } from 'vitest'
import { getArbitrumNetworkInformationFromRollup } from '../../src/networks/fromRollup'
import type { ArbitrumProvider } from '../../src/interfaces/provider'

const ROLLUP_ADDRESS = '0x4DCeB440657f21083db8aDd07665f8ddBe1DCfc0'
const BRIDGE_ADDRESS = '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a'
const INBOX_ADDRESS = '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f'
const SEQUENCER_INBOX_ADDRESS = '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6'
const OUTBOX_ADDRESS = '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840'
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

function encodeAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '')
  return '0x' + clean.padStart(64, '0')
}

function encodeUint64(val: bigint): string {
  return '0x' + val.toString(16).padStart(64, '0')
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

describe('getArbitrumNetworkInformationFromRollup', () => {
  it('reads bridge, inbox, outbox, sequencerInbox, and confirmPeriodBlocks from rollup', async () => {
    // The function reads bridge(), inbox(), sequencerInbox(), outbox(), confirmPeriodBlocks()
    // These are 5 calls, and then it reads nativeToken() from the bridge.
    // We need to route different return values based on the call data / target.
    const callMock = vi.fn().mockImplementation((request: { to: string; data: string }) => {
      const selector = request.data.slice(0, 10)
      // We'll match on selectors. Let me compute the expected selectors:
      // bridge() = 0xe78cea92
      // inbox() = 0xfb0e722b
      // sequencerInbox() = 0xee35f327
      // outbox() = 0xce11e6ab
      // confirmPeriodBlocks() = 0x2e7acfa6
      // nativeToken() = 0xe1758bd8
      if (request.to.toLowerCase() === ROLLUP_ADDRESS.toLowerCase()) {
        switch (selector) {
          case '0xe78cea92': return Promise.resolve(encodeAddress(BRIDGE_ADDRESS))
          case '0xfb0e722b': return Promise.resolve(encodeAddress(INBOX_ADDRESS))
          case '0xee35f327': return Promise.resolve(encodeAddress(SEQUENCER_INBOX_ADDRESS))
          case '0xce11e6ab': return Promise.resolve(encodeAddress(OUTBOX_ADDRESS))
          case '0x2e7acfa6': return Promise.resolve(encodeUint64(45818n))
          default: return Promise.resolve('0x' + '0'.repeat(64))
        }
      }
      // Call to bridge for nativeToken()
      if (request.to.toLowerCase() === BRIDGE_ADDRESS.toLowerCase()) {
        return Promise.resolve(encodeAddress(NATIVE_TOKEN_ADDRESS))
      }
      return Promise.resolve('0x' + '0'.repeat(64))
    })

    const provider = createMockProvider({
      call: callMock,
    })

    const result = await getArbitrumNetworkInformationFromRollup(
      ROLLUP_ADDRESS,
      provider
    )

    expect(result.parentChainId).toBe(1)
    expect(result.confirmPeriodBlocks).toBe(45818)
    expect(result.ethBridge.bridge.toLowerCase()).toBe(BRIDGE_ADDRESS.toLowerCase())
    expect(result.ethBridge.inbox.toLowerCase()).toBe(INBOX_ADDRESS.toLowerCase())
    expect(result.ethBridge.sequencerInbox.toLowerCase()).toBe(SEQUENCER_INBOX_ADDRESS.toLowerCase())
    expect(result.ethBridge.outbox.toLowerCase()).toBe(OUTBOX_ADDRESS.toLowerCase())
    expect(result.ethBridge.rollup).toBe(ROLLUP_ADDRESS)
  })

  it('returns the native token address when bridge has a non-zero nativeToken', async () => {
    const customNativeToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    const callMock = vi.fn().mockImplementation((request: { to: string; data: string }) => {
      const selector = request.data.slice(0, 10)
      if (request.to.toLowerCase() === ROLLUP_ADDRESS.toLowerCase()) {
        switch (selector) {
          case '0xe78cea92': return Promise.resolve(encodeAddress(BRIDGE_ADDRESS))
          case '0xfb0e722b': return Promise.resolve(encodeAddress(INBOX_ADDRESS))
          case '0xee35f327': return Promise.resolve(encodeAddress(SEQUENCER_INBOX_ADDRESS))
          case '0xce11e6ab': return Promise.resolve(encodeAddress(OUTBOX_ADDRESS))
          case '0x2e7acfa6': return Promise.resolve(encodeUint64(45818n))
          default: return Promise.resolve('0x' + '0'.repeat(64))
        }
      }
      // Bridge returns custom native token
      if (request.to.toLowerCase() === BRIDGE_ADDRESS.toLowerCase()) {
        return Promise.resolve(encodeAddress(customNativeToken))
      }
      return Promise.resolve('0x' + '0'.repeat(64))
    })

    const provider = createMockProvider({
      call: callMock,
    })

    const result = await getArbitrumNetworkInformationFromRollup(
      ROLLUP_ADDRESS,
      provider
    )

    expect(result.nativeToken?.toLowerCase()).toBe(customNativeToken.toLowerCase())
  })

  it('returns zero address for nativeToken when bridge.nativeToken() reverts', async () => {
    const callMock = vi.fn().mockImplementation((request: { to: string; data: string }) => {
      const selector = request.data.slice(0, 10)
      if (request.to.toLowerCase() === ROLLUP_ADDRESS.toLowerCase()) {
        switch (selector) {
          case '0xe78cea92': return Promise.resolve(encodeAddress(BRIDGE_ADDRESS))
          case '0xfb0e722b': return Promise.resolve(encodeAddress(INBOX_ADDRESS))
          case '0xee35f327': return Promise.resolve(encodeAddress(SEQUENCER_INBOX_ADDRESS))
          case '0xce11e6ab': return Promise.resolve(encodeAddress(OUTBOX_ADDRESS))
          case '0x2e7acfa6': return Promise.resolve(encodeUint64(45818n))
          default: return Promise.resolve('0x' + '0'.repeat(64))
        }
      }
      // Bridge nativeToken() reverts (ETH-native bridge)
      if (request.to.toLowerCase() === BRIDGE_ADDRESS.toLowerCase()) {
        return Promise.reject(new Error('execution reverted'))
      }
      return Promise.resolve('0x' + '0'.repeat(64))
    })

    const provider = createMockProvider({
      call: callMock,
    })

    const result = await getArbitrumNetworkInformationFromRollup(
      ROLLUP_ADDRESS,
      provider
    )

    expect(result.nativeToken).toBe('0x0000000000000000000000000000000000000000')
  })
})
