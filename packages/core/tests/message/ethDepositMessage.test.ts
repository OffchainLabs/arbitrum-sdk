import { describe, it, expect, vi } from 'vitest'
import {
  EthDepositMessage,
  getEthDeposits,
} from '../../src/message/ethDepositMessage'
import { EthDepositMessageStatus, InboxMessageKind } from '../../src/message/types'
import { calculateDepositTxId } from '../../src/message/retryableId'
import { encodeEventTopic } from '../../src/encoding/abi'
import { BridgeAbi } from '../../src/abi/Bridge'
import { InboxAbi } from '../../src/abi/Inbox'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import type {
  ArbitrumLog,
  ArbitrumTransactionReceipt,
} from '../../src/interfaces/types'
import type { ArbitrumNetwork } from '../../src/networks'

function makeReceipt(logs: ArbitrumLog[]): ArbitrumTransactionReceipt {
  return {
    to: '0x0000000000000000000000000000000000000000',
    from: '0x0000000000000000000000000000000000000001',
    contractAddress: null,
    transactionHash: '0x' + 'aa'.repeat(32),
    transactionIndex: 0,
    blockHash: '0x' + 'bb'.repeat(32),
    blockNumber: 100,
    status: 1,
    logs,
    gasUsed: 21000n,
    effectiveGasPrice: 1000000000n,
    cumulativeGasUsed: 21000n,
  }
}

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(42161),
    getBlockNumber: vi.fn().mockResolvedValue(100000),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x' + '00'.repeat(32)),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi
      .fn()
      .mockResolvedValue({
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      }),
    ...overrides,
  }
}

const testNetwork: ArbitrumNetwork = {
  name: 'Arbitrum One',
  chainId: 42161,
  parentChainId: 1,
  ethBridge: {
    bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
    outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
    rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
  },
  confirmPeriodBlocks: 45818,
  isTestnet: false,
  isCustom: false,
}

describe('EthDepositMessage', () => {
  it('computes correct childTxHash matching calculateDepositTxId', () => {
    const mockProvider = createMockProvider()

    const msg = new EthDepositMessage(
      mockProvider,
      42161,
      100n,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      1000000000000000000n // 1 ETH
    )

    const expectedHash = calculateDepositTxId({
      chainId: 42161,
      messageNumber: 100n,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      toAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      value: 1000000000000000000n,
    })

    expect(msg.childTxHash).toBe(expectedHash)
  })

  it('returns DEPOSITED when provider returns a receipt', async () => {
    const depositReceipt: ArbitrumTransactionReceipt = {
      to: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      from: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      contractAddress: null,
      transactionHash: '0x' + 'ff'.repeat(32),
      transactionIndex: 0,
      blockHash: '0x' + 'ee'.repeat(32),
      blockNumber: 50000,
      status: 1,
      logs: [],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }

    const mockProvider = createMockProvider({
      getTransactionReceipt: vi.fn().mockResolvedValue(depositReceipt),
    })

    const msg = new EthDepositMessage(
      mockProvider,
      42161,
      100n,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      1000000000000000000n
    )

    const status = await msg.status()
    expect(status).toBe(EthDepositMessageStatus.DEPOSITED)
  })

  it('returns PENDING when provider returns null', async () => {
    const mockProvider = createMockProvider({
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
    })

    const msg = new EthDepositMessage(
      mockProvider,
      42161,
      100n,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      1000000000000000000n
    )

    const status = await msg.status()
    expect(status).toBe(EthDepositMessageStatus.PENDING)
  })

  it('fromEventComponents constructs correctly', () => {
    const mockProvider = createMockProvider()

    // ETH deposit event data: 20 bytes address + value
    // to = 0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754
    // value = 1 ETH = 0xde0b6b3a7640000
    const eventData =
      '0xa2e06c19ee14255889f0ec0ca37f6d0778d067540000000000000000000000000000000000000000000000000de0b6b3a7640000'

    const msg = EthDepositMessage.fromEventComponents(
      mockProvider,
      42161,
      100n,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      eventData
    )

    expect(msg.to).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(msg.value).toBe(1000000000000000000n)
    expect(msg.from).toBe('0xeA3123E9d9911199a6711321d1277285e6d4F3EC')
    expect(msg.messageNumber).toBe(100n)
    expect(msg.childChainId).toBe(42161)
  })
})

describe('getEthDeposits', () => {
  it('returns EthDepositMessage instances from receipt with ETH deposit events', () => {
    const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
    const inboxTopic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

    // Bridge event with kind = 12 (L1MessageType_ethDeposit)
    const bridgeLog: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        bridgeTopic,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
      data:
        '0x' +
        '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' + // inbox
        '000000000000000000000000000000000000000000000000000000000000000c' + // kind = 12 (ethDeposit)
        '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' + // sender
        '0000000000000000000000000000000000000000000000000000000000000000' + // messageDataHash
        '0000000000000000000000000000000000000000000000000000000000000001' + // baseFeeL1
        '0000000000000000000000000000000000000000000000000000000000000002', // timestamp
      blockNumber: 100,
      blockHash: '0x' + 'aa'.repeat(32),
      transactionHash: '0x' + 'bb'.repeat(32),
      transactionIndex: 0,
      logIndex: 0,
      removed: false,
    }

    // Inbox event with packed ETH deposit data:
    // The data field for InboxMessageDelivered is ABI-encoded bytes.
    // The inner bytes contain: 20-byte address + value
    // We need to ABI-encode this as bytes(address + value)
    const innerData =
      'a2e06c19ee14255889f0ec0ca37f6d0778d067540000000000000000000000000000000000000000000000000de0b6b3a7640000'
    const innerDataLen = innerData.length / 2 // 52 bytes

    const inboxLog: ArbitrumLog = {
      address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      topics: [
        inboxTopic,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ],
      // ABI-encoded bytes: offset(32) + length(32) + padded data
      data:
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' + // offset
        innerDataLen.toString(16).padStart(64, '0') + // length
        innerData +
        '0'.repeat(64 - (innerData.length % 64 === 0 ? 64 : innerData.length % 64)), // padding
      blockNumber: 100,
      blockHash: '0x' + 'aa'.repeat(32),
      transactionHash: '0x' + 'bb'.repeat(32),
      transactionIndex: 0,
      logIndex: 1,
      removed: false,
    }

    const receipt = makeReceipt([bridgeLog, inboxLog])
    const mockProvider = createMockProvider()

    const deposits = getEthDeposits(receipt, mockProvider, testNetwork)

    expect(deposits).toHaveLength(1)
    expect(deposits[0]).toBeInstanceOf(EthDepositMessage)
    expect(deposits[0].to).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(deposits[0].value).toBe(1000000000000000000n)
    expect(deposits[0].childChainId).toBe(42161)
  })

  it('filters out non-ETH-deposit events', () => {
    const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
    const inboxTopic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

    // Bridge event with kind = 9 (submitRetryableTx, NOT ethDeposit)
    const bridgeLog: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        bridgeTopic,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
      data:
        '0x' +
        '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' +
        '0000000000000000000000000000000000000000000000000000000000000009' + // kind = 9 (retryable)
        '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000001' +
        '0000000000000000000000000000000000000000000000000000000000000002',
      blockNumber: 100,
      blockHash: '0x' + 'aa'.repeat(32),
      transactionHash: '0x' + 'bb'.repeat(32),
      transactionIndex: 0,
      logIndex: 0,
      removed: false,
    }

    const inboxLog: ArbitrumLog = {
      address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      topics: [
        inboxTopic,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ],
      data:
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
      blockNumber: 100,
      blockHash: '0x' + 'aa'.repeat(32),
      transactionHash: '0x' + 'bb'.repeat(32),
      transactionIndex: 0,
      logIndex: 1,
      removed: false,
    }

    const receipt = makeReceipt([bridgeLog, inboxLog])
    const mockProvider = createMockProvider()

    const deposits = getEthDeposits(receipt, mockProvider, testNetwork)
    expect(deposits).toHaveLength(0)
  })
})
