import { describe, it, expect, vi } from 'vitest'
import { EventFetcher } from '../../src/utils/eventFetcher'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import type { ArbitrumLog } from '../../src/interfaces/types'
import { encodeEventTopic } from '../../src/encoding/abi'
import { BridgeAbi } from '../../src/abi/Bridge'

/**
 * Create a mock ArbitrumProvider that returns known log entries.
 */
function createMockProvider(logs: ArbitrumLog[]): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(42161),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x'),
    estimateGas: vi.fn().mockResolvedValue(0n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x'),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue(logs),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }),
  }
}

describe('EventFetcher', () => {
  it('fetches and parses MessageDelivered events from Bridge ABI', async () => {
    // Build a realistic MessageDelivered log entry
    // MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc,
    //   address inbox, uint8 kind, address sender, bytes32 messageDataHash,
    //   uint256 baseFeeL1, uint64 timestamp)
    const messageDeliveredTopic = encodeEventTopic(
      BridgeAbi,
      'MessageDelivered'
    )

    // messageIndex = 0x504c (indexed)
    const messageIndexTopic =
      '0x000000000000000000000000000000000000000000000000000000000000504c'
    // beforeInboxAcc (indexed, bytes32)
    const beforeInboxAccTopic =
      '0x2a5dcbed3d730861a810a913641dd7b8d5ff3ee20b716517934795dcef1fa7a7'

    // Non-indexed data: inbox, kind, sender, messageDataHash, baseFeeL1, timestamp
    // inbox = 0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f
    // kind = 9 (L1MessageType_submitRetryableTx)
    // sender = 0xeA3123E9d9911199a6711321d1277285e6d4F3EC
    // messageDataHash = 0x33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1
    // baseFeeL1 = 0x05e0fc4c58
    // timestamp = 0x631abc80
    const data =
      '0x' +
      '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' + // inbox
      '0000000000000000000000000000000000000000000000000000000000000009' + // kind
      '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' + // sender
      '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' + // messageDataHash
      '00000000000000000000000000000000000000000000000000000005e0fc4c58' + // baseFeeL1
      '00000000000000000000000000000000000000000000000000000000631abc80' // timestamp

    const mockLog: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [messageDeliveredTopic, messageIndexTopic, beforeInboxAccTopic],
      data,
      blockNumber: 15500657,
      blockHash:
        '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash:
        '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 446,
      removed: false,
    }

    const provider = createMockProvider([mockLog])
    const fetcher = new EventFetcher(provider)

    const events = await fetcher.getEvents(BridgeAbi, 'MessageDelivered', {
      fromBlock: 15500000,
      toBlock: 15501000,
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    })

    expect(events).toHaveLength(1)
    const event = events[0]

    // Check that the event was parsed correctly
    expect(event.name).toBe('MessageDelivered')
    expect(event.blockNumber).toBe(15500657)
    expect(event.transactionHash).toBe(
      '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba'
    )

    // Check decoded args
    // messageIndex is indexed (uint256) -> comes from topic
    expect(event.args.messageIndex).toBe(0x504cn)
    // kind is uint8
    expect(event.args.kind).toBe(9n)
    // sender is address
    expect(event.args.sender).toBe(
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC'
    )
    // baseFeeL1 is uint256
    expect(event.args.baseFeeL1).toBe(0x05e0fc4c58n)
    // timestamp is uint64
    expect(event.args.timestamp).toBe(0x631abc80n)

    // Verify getLogs was called with the correct filter
    expect(provider.getLogs).toHaveBeenCalledWith({
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [messageDeliveredTopic],
      fromBlock: 15500000,
      toBlock: 15501000,
    })
  })

  it('returns empty array when no matching logs found', async () => {
    const provider = createMockProvider([])
    const fetcher = new EventFetcher(provider)

    const events = await fetcher.getEvents(BridgeAbi, 'MessageDelivered', {
      fromBlock: 0,
      toBlock: 100,
    })

    expect(events).toHaveLength(0)
  })

  it('filters out removed logs', async () => {
    const messageDeliveredTopic = encodeEventTopic(
      BridgeAbi,
      'MessageDelivered'
    )
    const messageIndexTopic =
      '0x0000000000000000000000000000000000000000000000000000000000000001'
    const beforeInboxAccTopic =
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    const data =
      '0x' +
      '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' +
      '0000000000000000000000000000000000000000000000000000000000000009' +
      '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' +
      '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' +
      '00000000000000000000000000000000000000000000000000000005e0fc4c58' +
      '00000000000000000000000000000000000000000000000000000000631abc80'

    const removedLog: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [messageDeliveredTopic, messageIndexTopic, beforeInboxAccTopic],
      data,
      blockNumber: 100,
      blockHash: '0x' + 'aa'.repeat(32),
      transactionHash: '0x' + 'bb'.repeat(32),
      transactionIndex: 0,
      logIndex: 0,
      removed: true,
    }

    const provider = createMockProvider([removedLog])
    const fetcher = new EventFetcher(provider)

    const events = await fetcher.getEvents(BridgeAbi, 'MessageDelivered', {
      fromBlock: 0,
      toBlock: 200,
    })

    expect(events).toHaveLength(0)
  })
})
