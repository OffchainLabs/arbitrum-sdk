import { describe, it, expect } from 'vitest'
import {
  getMessageDeliveredEvents,
  getInboxMessageDeliveredEvents,
  getChildToParentEvents,
  getRedeemScheduledEvents,
} from '../../src/events/parsing'
import { encodeEventTopic } from '../../src/encoding/abi'
import { BridgeAbi } from '../../src/abi/Bridge'
import { InboxAbi } from '../../src/abi/Inbox'
import { ArbSysAbi } from '../../src/abi/ArbSys'
import { ArbRetryableTxAbi } from '../../src/abi/ArbRetryableTx'
import type { ArbitrumLog, ArbitrumTransactionReceipt } from '../../src/interfaces/types'

/**
 * Helper to build a minimal receipt with logs.
 */
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

describe('getMessageDeliveredEvents', () => {
  it('parses MessageDelivered events from a receipt', () => {
    const topic = encodeEventTopic(BridgeAbi, 'MessageDelivered')

    // Data from mainnet tx 0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba
    const log: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        topic,
        '0x000000000000000000000000000000000000000000000000000000000000504c', // messageIndex
        '0x2a5dcbed3d730861a810a913641dd7b8d5ff3ee20b716517934795dcef1fa7a7', // beforeInboxAcc
      ],
      data:
        '0x' +
        '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' + // inbox
        '0000000000000000000000000000000000000000000000000000000000000009' + // kind
        '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' + // sender
        '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' + // messageDataHash
        '00000000000000000000000000000000000000000000000000000005e0fc4c58' + // baseFeeL1
        '00000000000000000000000000000000000000000000000000000000631abc80', // timestamp
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 446,
      removed: false,
    }

    const receipt = makeReceipt([log])
    const events = getMessageDeliveredEvents(receipt)

    expect(events).toHaveLength(1)
    expect(events[0].args.messageIndex).toBe(0x504cn)
    expect(events[0].args.kind).toBe(9n)
    expect(events[0].args.sender).toBe('0xeA3123E9d9911199a6711321d1277285e6d4F3EC')
    expect(events[0].args.baseFeeL1).toBe(0x05e0fc4c58n)
    expect(events[0].args.timestamp).toBe(0x631abc80n)
    expect(events[0].args.inbox).toBe('0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f')
  })

  it('handles receipts with no matching events', () => {
    // A log from a different event
    const unrelatedLog: ArbitrumLog = {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754',
        '0x000000000000000000000000d92023e9d9911199a6711321d1277285e6d4e2db',
      ],
      data: '0x0000000000000000000000000000000000000000000000000853a0d2313c0000',
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 444,
      removed: false,
    }

    const events = getMessageDeliveredEvents(makeReceipt([unrelatedLog]))
    expect(events).toHaveLength(0)
  })

  it('works with raw log arrays', () => {
    const topic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
    const log: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        topic,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ],
      data:
        '0x' +
        '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' +
        '0000000000000000000000000000000000000000000000000000000000000009' +
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

    const events = getMessageDeliveredEvents([log])
    expect(events).toHaveLength(1)
    expect(events[0].args.messageIndex).toBe(1n)
  })
})

describe('getInboxMessageDeliveredEvents', () => {
  it('parses InboxMessageDelivered events from a receipt', () => {
    const topic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

    // Data from mainnet tx 0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba
    // InboxMessageDelivered(uint256 indexed messageNum, bytes data)
    const log: ArbitrumLog = {
      address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      topics: [
        topic,
        '0x000000000000000000000000000000000000000000000000000000000000504c',
      ],
      // bytes data: offset(32) + length(32) + encoded data
      data:
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' + // offset to dynamic data
        '0000000000000000000000000000000000000000000000000000000000000264' + // length = 612 bytes
        '0000000000000000000000006c411ad3e74de3e7bd422b94a27770f5b86c623b' + // dest
        '0000000000000000000000000000000000000000000000000853a0d2313c0000' + // l2CallValue
        '0000000000000000000000000000000000000000000000000854e8ab1802ca80' + // l1Value
        '00000000000000000000000000000000000000000000000001270f6740d880' +
        '00' + // maxSubmissionFee (padded)
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' + // excessFeeRefundAddr
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' + // callValueRefundAddr
        '000000000000000000000000000000000000000000000000000000000001d566' + // gasLimit
        '0000000000000000000000000000000000000000000000000000000011e1a300' + // maxFeePerGas
        '0000000000000000000000000000000000000000000000000000000000000144' + // dataLength
        // (remaining is calldata)
        '2e567b36000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' +
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' +
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' +
        '0000000000000000000000000000000000000000000000000853a0d2313c0000' +
        '00000000000000000000000000000000000000000000000000000000000000a0' +
        '0000000000000000000000000000000000000000000000000000000000000080' +
        '0000000000000000000000000000000000000000000000000000000000000040' +
        '0000000000000000000000000000000000000000000000000000000000000060' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000',
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 447,
      removed: false,
    }

    const receipt = makeReceipt([log])
    const events = getInboxMessageDeliveredEvents(receipt)

    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('InboxMessageDelivered')
    // messageNum is indexed uint256
    expect(events[0].args.messageNum).toBe(0x504cn)
    // data is a dynamic bytes field
    expect(typeof events[0].args.data).toBe('string')
    expect((events[0].args.data as string).startsWith('0x')).toBe(true)
  })
})

describe('getChildToParentEvents', () => {
  it('parses L2ToL1Tx events from a receipt', () => {
    const topic = encodeEventTopic(ArbSysAbi, 'L2ToL1Tx')

    // L2ToL1Tx(address caller, address indexed destination, uint256 indexed hash,
    //   uint256 indexed position, uint256 arbBlockNum, uint256 ethBlockNum,
    //   uint256 timestamp, uint256 callvalue, bytes data)
    const log: ArbitrumLog = {
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

    const events = getChildToParentEvents([log])

    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('L2ToL1Tx')
    expect(events[0].args.destination).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(events[0].args.hash).toBe(0x1234n)
    expect(events[0].args.position).toBe(0x42n)
    expect(events[0].args.caller).toBe('0xB2e06c19eE14255889f0eC0ca37F6d0778D06754')
    expect(events[0].args.arbBlockNum).toBe(0xabcdefn)
    expect(events[0].args.ethBlockNum).toBe(0xfedcban)
    expect(events[0].args.callvalue).toBe(1000000000000000000n) // 1 ETH
  })
})

describe('getRedeemScheduledEvents', () => {
  it('parses RedeemScheduled events from a receipt', () => {
    const topic = encodeEventTopic(ArbRetryableTxAbi, 'RedeemScheduled')

    // RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash,
    //   uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor,
    //   uint256 maxRefund, uint256 submissionFeeRefund)
    const ticketId = '0x' + 'ab'.repeat(32)
    const retryTxHash = '0x' + 'cd'.repeat(32)
    // sequenceNum is uint64 indexed — stored in a 32-byte topic
    const sequenceNum =
      '0x0000000000000000000000000000000000000000000000000000000000000007'

    const log: ArbitrumLog = {
      address: '0x000000000000000000000000000000000000006E',
      topics: [topic, ticketId, retryTxHash, sequenceNum],
      data:
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000002710' + // donatedGas = 10000
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' + // gasDonor
        '00000000000000000000000000000000000000000000000000038d7ea4c68000' + // maxRefund
        '00000000000000000000000000000000000000000000000000005af3107a4000', // submissionFeeRefund
      blockNumber: 50000100,
      blockHash: '0x' + 'ee'.repeat(32),
      transactionHash: '0x' + 'ff'.repeat(32),
      transactionIndex: 0,
      logIndex: 2,
      removed: false,
    }

    const events = getRedeemScheduledEvents([log])

    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('RedeemScheduled')
    expect(events[0].args.ticketId).toBe(ticketId)
    expect(events[0].args.retryTxHash).toBe(retryTxHash)
    expect(events[0].args.sequenceNum).toBe(7n)
    expect(events[0].args.donatedGas).toBe(10000n)
    expect(events[0].args.gasDonor).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(events[0].args.maxRefund).toBe(1000000000000000n)
    expect(events[0].args.submissionFeeRefund).toBe(100000000000000n)
  })
})
