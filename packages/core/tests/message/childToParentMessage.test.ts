import { describe, it, expect, vi } from 'vitest'
import {
  ChildToParentMessageReader,
  getChildToParentMessages,
  getExecuteRequest,
  type ChildToParentEventData,
} from '../../src/message/childToParentMessage'
import { ChildToParentMessageStatus } from '../../src/message/types'
import { encodeEventTopic, encodeFunctionData } from '../../src/encoding/abi'
import { ArbSysAbi } from '../../src/abi/ArbSys'
import { OutboxAbi } from '../../src/abi/Outbox'
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
    getChainId: vi.fn().mockResolvedValue(1),
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

function makeL2ToL1TxLog(): ArbitrumLog {
  const topic = encodeEventTopic(ArbSysAbi, 'L2ToL1Tx')

  return {
    address: '0x0000000000000000000000000000000000000064',
    topics: [
      topic,
      '0x000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754', // destination (indexed)
      '0x0000000000000000000000000000000000000000000000000000000000001234', // hash (indexed)
      '0x0000000000000000000000000000000000000000000000000000000000000042', // position (indexed)
    ],
    data:
      '0x' +
      '000000000000000000000000b2e06c19ee14255889f0ec0ca37f6d0778d06754' + // caller
      '0000000000000000000000000000000000000000000000000000000000abcdef' + // arbBlockNum
      '0000000000000000000000000000000000000000000000000000000000fedcba' + // ethBlockNum
      '0000000000000000000000000000000000000000000000000000000063ffffff' + // timestamp
      '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // callvalue (1 ETH)
      '00000000000000000000000000000000000000000000000000000000000000c0' + // offset to data
      '0000000000000000000000000000000000000000000000000000000000000004' + // data length
      'deadbeef00000000000000000000000000000000000000000000000000000000', // data bytes
    blockNumber: 50000000,
    blockHash: '0x' + 'cc'.repeat(32),
    transactionHash: '0x' + 'dd'.repeat(32),
    transactionIndex: 1,
    logIndex: 5,
    removed: false,
  }
}

describe('getChildToParentMessages', () => {
  it('returns ChildToParentMessageReader instances from receipt', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt([makeL2ToL1TxLog()])

    const messages = getChildToParentMessages(
      receipt,
      mockProvider,
      testNetwork
    )

    expect(messages).toHaveLength(1)
    expect(messages[0]).toBeInstanceOf(ChildToParentMessageReader)
  })

  it('parses event data correctly', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt([makeL2ToL1TxLog()])

    const messages = getChildToParentMessages(
      receipt,
      mockProvider,
      testNetwork
    )
    const msg = messages[0]

    expect(msg.event.destination).toBe(
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754'
    )
    expect(msg.event.hash).toBe(0x1234n)
    expect(msg.event.position).toBe(0x42n)
    expect(msg.event.caller).toBe(
      '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754'
    )
    expect(msg.event.arbBlockNum).toBe(0xabcdefn)
    expect(msg.event.ethBlockNum).toBe(0xfedcban)
    expect(msg.event.callvalue).toBe(1000000000000000000n) // 1 ETH
  })

  it('returns empty array when no L2ToL1Tx events', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt([])

    const messages = getChildToParentMessages(
      receipt,
      mockProvider,
      testNetwork
    )
    expect(messages).toHaveLength(0)
  })
})

describe('ChildToParentMessageReader status', () => {
  it('returns EXECUTED when Outbox.isSpent returns true', async () => {
    // ABI-encoded `true` (bool)
    const trueEncoded =
      '0x0000000000000000000000000000000000000000000000000000000000000001'

    const mockProvider = createMockProvider({
      call: vi.fn().mockResolvedValue(trueEncoded),
    })

    const event: ChildToParentEventData = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 1000000000000000000n,
      data: '0xdeadbeef',
    }

    const reader = new ChildToParentMessageReader(mockProvider, event)
    const status = await reader.status(testNetwork)
    expect(status).toBe(ChildToParentMessageStatus.EXECUTED)
  })

  it('returns UNCONFIRMED when Outbox.isSpent returns false', async () => {
    // ABI-encoded `false`
    const falseEncoded =
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    const mockProvider = createMockProvider({
      call: vi.fn().mockResolvedValue(falseEncoded),
    })

    const event: ChildToParentEventData = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 1000000000000000000n,
      data: '0xdeadbeef',
    }

    const reader = new ChildToParentMessageReader(mockProvider, event)
    const status = await reader.status(testNetwork)
    expect(status).toBe(ChildToParentMessageStatus.UNCONFIRMED)
  })
})

describe('getExecuteRequest', () => {
  it('returns TransactionRequestData encoding Outbox.executeTransaction', () => {
    const event: ChildToParentEventData = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 1000000000000000000n,
      data: '0xdeadbeef',
    }

    const proof = [
      '0x' + 'aa'.repeat(32),
      '0x' + 'bb'.repeat(32),
    ]

    const request = getExecuteRequest(event, proof, testNetwork)

    expect(request.to).toBe(testNetwork.ethBridge.outbox)
    expect(request.value).toBe(0n)
    expect(request.data).toBeTruthy()

    // Verify the calldata encodes executeTransaction correctly
    const expectedData = encodeFunctionData(
      OutboxAbi,
      'executeTransaction',
      [
        proof,
        event.position,
        event.caller,
        event.destination,
        event.arbBlockNum,
        event.ethBlockNum,
        event.timestamp,
        event.callvalue,
        event.data,
      ]
    )
    expect(request.data).toBe(expectedData)
  })

  it('targets the correct outbox address from the network', () => {
    const event: ChildToParentEventData = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 0n,
      data: '0x',
    }

    const customNetwork = {
      ...testNetwork,
      ethBridge: {
        ...testNetwork.ethBridge,
        outbox: '0x1234567890AbcdEF1234567890aBcdef12345678',
      },
    }

    const request = getExecuteRequest(event, [], customNetwork)
    expect(request.to).toBe('0x1234567890AbcdEF1234567890aBcdef12345678')
  })
})
