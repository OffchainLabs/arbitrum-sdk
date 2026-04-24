import { describe, it, expect } from 'vitest'
import { getMessageEvents, getTokenDepositEvents } from '../../src/message/parentTransaction'
import { encodeEventTopic } from '../../src/encoding/abi'
import { BridgeAbi } from '../../src/abi/Bridge'
import { InboxAbi } from '../../src/abi/Inbox'
import { L1ERC20GatewayAbi } from '../../src/abi/L1ERC20Gateway'
import type { ArbitrumLog, ArbitrumTransactionReceipt } from '../../src/interfaces/types'

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

describe('getMessageEvents', () => {
  it('pairs inbox and bridge events correctly by messageNum/messageIndex', () => {
    const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
    const inboxTopic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

    // MessageDelivered: messageIndex=0x504c (indexed), beforeInboxAcc (indexed),
    // then data: inbox, kind, sender, messageDataHash, baseFeeL1, timestamp
    const bridgeLog: ArbitrumLog = {
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        bridgeTopic,
        '0x000000000000000000000000000000000000000000000000000000000000504c',
        '0x2a5dcbed3d730861a810a913641dd7b8d5ff3ee20b716517934795dcef1fa7a7',
      ],
      data:
        '0x' +
        '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' +
        '0000000000000000000000000000000000000000000000000000000000000009' +
        '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' +
        '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' +
        '00000000000000000000000000000000000000000000000000000005e0fc4c58' +
        '00000000000000000000000000000000000000000000000000000000631abc80',
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 446,
      removed: false,
    }

    // InboxMessageDelivered: messageNum=0x504c (indexed), bytes data
    const inboxLog: ArbitrumLog = {
      address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      topics: [
        inboxTopic,
        '0x000000000000000000000000000000000000000000000000000000000000504c',
      ],
      // Exact data from mainnet tx 0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba
      data: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000002640000000000000000000000006c411ad3e74de3e7bd422b94a27770f5b86c623b0000000000000000000000000000000000000000000000000853a0d2313c00000000000000000000000000000000000000000000000000000854e8ab1802ca800000000000000000000000000000000000000000000000000001270f6740d880000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000000000000000000000000000000000000001d5660000000000000000000000000000000000000000000000000000000011e1a30000000000000000000000000000000000000000000000000000000000000001442e567b36000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d067540000000000000000000000000000000000000000000000000853a0d2313c000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 447,
      removed: false,
    }

    const receipt = makeReceipt([bridgeLog, inboxLog])
    const events = getMessageEvents(receipt)

    expect(events).toHaveLength(1)
    expect(events[0].bridgeMessageEvent.args.messageIndex).toBe(0x504cn)
    expect(events[0].inboxMessageEvent.args.messageNum).toBe(0x504cn)
    expect(events[0].bridgeMessageEvent.args.kind).toBe(9n)
    expect(events[0].bridgeMessageEvent.args.sender).toBe(
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC'
    )
  })

  it('throws when bridge and inbox event counts do not match', () => {
    const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')

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

    // Only bridge event, no inbox event
    const receipt = makeReceipt([bridgeLog])
    expect(() => getMessageEvents(receipt)).toThrow('Unexpected missing events')
  })

  it('pairs multiple events correctly', () => {
    const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
    const inboxTopic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

    const makeMinimalBridgeLog = (messageIndex: string): ArbitrumLog => ({
      address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      topics: [
        bridgeTopic,
        messageIndex,
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
    })

    const makeMinimalInboxLog = (messageNum: string): ArbitrumLog => ({
      address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      topics: [inboxTopic, messageNum],
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
    })

    const msgIndex1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
    const msgIndex2 = '0x0000000000000000000000000000000000000000000000000000000000000002'

    const receipt = makeReceipt([
      makeMinimalBridgeLog(msgIndex1),
      makeMinimalBridgeLog(msgIndex2),
      makeMinimalInboxLog(msgIndex1),
      makeMinimalInboxLog(msgIndex2),
    ])

    const events = getMessageEvents(receipt)
    expect(events).toHaveLength(2)
    expect(events[0].bridgeMessageEvent.args.messageIndex).toBe(1n)
    expect(events[0].inboxMessageEvent.args.messageNum).toBe(1n)
    expect(events[1].bridgeMessageEvent.args.messageIndex).toBe(2n)
    expect(events[1].inboxMessageEvent.args.messageNum).toBe(2n)
  })
})

describe('getTokenDepositEvents', () => {
  it('parses DepositInitiated events from L1ERC20Gateway', () => {
    const topic = encodeEventTopic(L1ERC20GatewayAbi, 'DepositInitiated')

    // DepositInitiated(address l1Token, address indexed _from, address indexed _to,
    //   uint256 indexed _sequenceNumber, uint256 _amount)
    const log: ArbitrumLog = {
      address: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
      topics: [
        topic,
        '0x000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754', // _from
        '0x000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754', // _to
        '0x000000000000000000000000000000000000000000000000000000000000504c', // _sequenceNumber
      ],
      data:
        '0x' +
        '000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' + // l1Token
        '0000000000000000000000000000000000000000000000000853a0d2313c0000', // _amount
      blockNumber: 15500657,
      blockHash: '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
      transactionHash: '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
      transactionIndex: 323,
      logIndex: 449,
      removed: false,
    }

    const receipt = makeReceipt([log])
    const events = getTokenDepositEvents(receipt)

    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('DepositInitiated')
    expect(events[0].args._from).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(events[0].args._to).toBe('0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754')
    expect(events[0].args._sequenceNumber).toBe(0x504cn)
    expect(events[0].args.l1Token).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    expect(events[0].args._amount).toBe(0x0853a0d2313c0000n)
  })

  it('returns empty array when no matching events', () => {
    const receipt = makeReceipt([])
    const events = getTokenDepositEvents(receipt)
    expect(events).toHaveLength(0)
  })
})
