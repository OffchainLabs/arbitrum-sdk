/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { BigNumber, providers, utils } from 'ethers'
import { expect } from 'chai'
import { anything, instance, mock, when } from 'ts-mockito'
import { parseTypedLog, parseTypedLogs } from '../../src/lib/dataEntities/event'
import { Bridge__factory } from '../../src/lib/abi/factories/Bridge__factory'
import { Inbox__factory } from '../../src/lib/abi/factories/Inbox__factory'
import { ArbSys__factory } from '../../src/lib/abi/factories/ArbSys__factory'
import { ArbRetryableTx__factory } from '../../src/lib/abi/factories/ArbRetryableTx__factory'
import { ParentTransactionReceipt } from '../../src/lib/message/ParentTransaction'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { TransactionReceipt } from '@ethersproject/providers'
import {
  ARB_SYS_ADDRESS,
  ARB_RETRYABLE_TX_ADDRESS,
} from '../../src/lib/dataEntities/constants'
import { InboxMessageKind } from '../../src/lib/dataEntities/message'

// Real Arbitrum One (chainId 42161) bridge contract addresses, registered by
// default in the SDK's network list - used so getArbitrumNetwork(provider)
// resolves to a real, known-good set of addresses without registering a
// custom network.
const ARB_ONE_BRIDGE = '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a'
const ARB_ONE_INBOX = '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f'

function mockChildProvider(): providers.JsonRpcProvider {
  const providerMock = mock(providers.JsonRpcProvider)
  when(providerMock._isProvider).thenReturn(true)
  when(providerMock.getNetwork()).thenResolve({ chainId: 42161 } as any)
  when(providerMock.call(anything(), anything())).thenResolve('0x')
  return instance(providerMock)
}

const REAL_BRIDGE_ADDRESS = '0x0000000000000000000000000000000000000B01'
const REAL_INBOX_ADDRESS = '0x0000000000000000000000000000000000000B02'
// An unrelated contract, invoked in the same transaction, that emits a log
// whose topic0 happens to match MessageDelivered/InboxMessageDelivered's
// signature but is not actually the real Bridge/Inbox.
const ATTACKER_ADDRESS = '0x000000000000000000000000000000000000eeee'

const bridgeIface = Bridge__factory.createInterface()
const inboxIface = Inbox__factory.createInterface()

function topicPad(value: string): string {
  return utils.hexZeroPad(value, 32)
}

function makeMessageDeliveredLog(
  address: string,
  messageIndex: number,
  opts: { inbox?: string; kind?: number; sender?: string } = {}
) {
  return {
    blockNumber: 1,
    blockHash: topicPad('0x1'),
    transactionIndex: 0,
    removed: false,
    address,
    data: utils.defaultAbiCoder.encode(
      ['address', 'uint8', 'address', 'bytes32', 'uint256', 'uint64'],
      [
        opts.inbox ?? REAL_INBOX_ADDRESS,
        opts.kind ?? InboxMessageKind.L1MessageType_submitRetryableTx,
        opts.sender ?? '0x0000000000000000000000000000000000000009', // spoofed sender
        topicPad('0x0'),
        0,
        0,
      ]
    ),
    topics: [
      bridgeIface.getEventTopic('MessageDelivered'),
      topicPad(utils.hexlify(messageIndex)),
      topicPad('0x0'),
    ],
    transactionHash: topicPad('0x2'),
    logIndex: 0,
  }
}

function makeInboxMessageDeliveredLog(
  address: string,
  messageNum: number,
  data: string = utils.defaultAbiCoder.encode(['bytes'], ['0x'])
) {
  return {
    blockNumber: 1,
    blockHash: topicPad('0x1'),
    transactionIndex: 0,
    removed: false,
    address,
    data,
    topics: [
      inboxIface.getEventTopic('InboxMessageDelivered'),
      topicPad(utils.hexlify(messageNum)),
    ],
    transactionHash: topicPad('0x2'),
    logIndex: 1,
  }
}

function makeL2ToL1TxLog(address: string) {
  // L2ToL1Tx(address caller, address indexed destination, uint256 indexed
  // hash, uint256 indexed position, uint256 arbBlockNum, uint256
  // ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)
  const arbSysIface = ArbSys__factory.createInterface()
  return {
    blockNumber: 1,
    blockHash: topicPad('0x1'),
    transactionIndex: 0,
    removed: false,
    address,
    data: utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
      [
        '0x0000000000000000000000000000000000000009', // caller
        0, // arbBlockNum
        0, // ethBlockNum
        0, // timestamp
        0, // callvalue
        '0x', // data
      ]
    ),
    topics: [
      arbSysIface.getEventTopic('L2ToL1Tx'),
      topicPad('0x2'), // destination
      topicPad('0x3'), // hash
      topicPad('0x1'), // position
    ],
    transactionHash: topicPad('0x4'),
    logIndex: 0,
  }
}

function makeRedeemScheduledLog(address: string) {
  // RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash,
  // uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor,
  // uint256 maxRefund, uint256 submissionFeeRefund)
  const retryableIface = ArbRetryableTx__factory.createInterface()
  return {
    blockNumber: 1,
    blockHash: topicPad('0x1'),
    transactionIndex: 0,
    removed: false,
    address,
    data: utils.defaultAbiCoder.encode(
      ['uint64', 'address', 'uint256', 'uint256'],
      [0, '0x0000000000000000000000000000000000000009', 0, 0]
    ),
    topics: [
      retryableIface.getEventTopic('RedeemScheduled'),
      topicPad('0x1'), // ticketId
      topicPad('0x2'), // retryTxHash
      topicPad('0x0'), // sequenceNum
    ],
    transactionHash: topicPad('0x4'),
    logIndex: 0,
  }
}

describe('parseTypedLog/parseTypedLogs address scoping', () => {
  it('accepts a matching-topic log from any address when no expectedAddress is given (back-compat)', () => {
    const log = makeMessageDeliveredLog(ATTACKER_ADDRESS, 0)
    const result = parseTypedLog(Bridge__factory, log, 'MessageDelivered')
    expect(result).to.not.equal(null)
  })

  it('rejects a matching-topic log from an unexpected address when expectedAddress is given', () => {
    const log = makeMessageDeliveredLog(ATTACKER_ADDRESS, 0)
    const result = parseTypedLog(
      Bridge__factory,
      log,
      'MessageDelivered',
      REAL_BRIDGE_ADDRESS
    )
    expect(result).to.equal(null)
  })

  it('accepts a matching-topic log from the expected address', () => {
    const log = makeMessageDeliveredLog(REAL_BRIDGE_ADDRESS, 0)
    const result = parseTypedLog(
      Bridge__factory,
      log,
      'MessageDelivered',
      REAL_BRIDGE_ADDRESS
    )
    expect(result).to.not.equal(null)
  })

  it('parseTypedLogs filters out spoofed logs from an unexpected address', () => {
    const logs = [
      makeMessageDeliveredLog(REAL_BRIDGE_ADDRESS, 0),
      makeMessageDeliveredLog(ATTACKER_ADDRESS, 1),
    ]
    const results = parseTypedLogs(
      Bridge__factory,
      logs,
      'MessageDelivered',
      REAL_BRIDGE_ADDRESS
    )
    expect(results.length).to.equal(1)
  })
})

describe('ParentTransactionReceipt event address scoping', () => {
  function buildReceipt(logs: unknown[]): ParentTransactionReceipt {
    return new ParentTransactionReceipt({
      logs,
    } as unknown as TransactionReceipt)
  }

  it('getMessageDeliveredEvents includes a spoofed log when no address is given (documents the previously-unscoped default)', () => {
    const receipt = buildReceipt([makeMessageDeliveredLog(ATTACKER_ADDRESS, 0)])
    expect(receipt.getMessageDeliveredEvents().length).to.equal(1)
  })

  it('getMessageDeliveredEvents excludes a spoofed log when the real bridge address is given', () => {
    const receipt = buildReceipt([makeMessageDeliveredLog(ATTACKER_ADDRESS, 0)])
    expect(
      receipt.getMessageDeliveredEvents(REAL_BRIDGE_ADDRESS).length
    ).to.equal(0)
  })

  it('getInboxMessageDeliveredEvents excludes a spoofed log when the real inbox address is given', () => {
    const receipt = buildReceipt([
      makeInboxMessageDeliveredLog(ATTACKER_ADDRESS, 0),
    ])
    expect(
      receipt.getInboxMessageDeliveredEvents(REAL_INBOX_ADDRESS).length
    ).to.equal(0)
  })

  it("getMessageEvents pairs against the bridge event's own attested inbox - so a forged bridge log that also self-declares its own address as the inbox still pairs unless bridgeAddress is given", () => {
    const logs = [
      makeMessageDeliveredLog(ATTACKER_ADDRESS, 0, { inbox: ATTACKER_ADDRESS }),
      makeInboxMessageDeliveredLog(ATTACKER_ADDRESS, 0),
    ]
    const receipt = buildReceipt(logs)

    // Without bridgeAddress: the forged bridge log's self-declared "inbox"
    // (the attacker's own address) matches the forged inbox log, so the
    // pair forms - proving bridgeAddress scoping is load-bearing on its
    // own, not merely a nice-to-have on top of inbox scoping.
    expect(receipt.getMessageEvents().length).to.equal(1)

    // With the real bridgeAddress: the forged bridge log is rejected
    // outright, so no pairing is even attempted.
    expect(receipt.getMessageEvents(REAL_BRIDGE_ADDRESS).length).to.equal(0)
  })

  it("getMessageEvents throws on a forged inbox log that does not match a real bridge event's attested inbox, even without bridgeAddress", () => {
    const logs = [
      makeMessageDeliveredLog(REAL_BRIDGE_ADDRESS, 0), // inbox defaults to REAL_INBOX_ADDRESS
      makeInboxMessageDeliveredLog(ATTACKER_ADDRESS, 0), // forged, wrong address
    ]
    const receipt = buildReceipt(logs)
    expect(() => receipt.getMessageEvents()).to.throw(
      /Unexepected missing event/
    )
  })

  it('getMessageEvents correctly pairs a legitimate message from a second allowed inbox, instead of throwing a count-mismatch (regression check)', () => {
    const SECOND_REAL_INBOX = '0x0000000000000000000000000000000000000B03'
    const logs = [
      makeMessageDeliveredLog(REAL_BRIDGE_ADDRESS, 0, {
        inbox: SECOND_REAL_INBOX,
      }),
      makeInboxMessageDeliveredLog(SECOND_REAL_INBOX, 0),
    ]
    const receipt = buildReceipt(logs)

    // Before the fix, getMessageEvents scoped the Inbox side to a single
    // hardcoded network.ethBridge.inbox address - a genuine message from
    // any OTHER allowed delayed inbox would be silently dropped from
    // inboxMessages, causing bridgeMessages.length !== inboxMessages.length
    // and an incorrect throw. Scoping against the bridge event's own
    // attested inbox fixes this: it's per-message, not a single constant.
    expect(receipt.getMessageEvents(REAL_BRIDGE_ADDRESS).length).to.equal(1)
  })
})

describe('ParentTransactionReceipt high-level methods thread real addresses through (not just the low-level getters)', () => {
  function buildReceipt(
    logs: unknown[],
    blockNumber = 20000000
  ): ParentTransactionReceipt {
    return new ParentTransactionReceipt({
      logs,
      blockNumber,
    } as unknown as TransactionReceipt)
  }

  it('getEthDeposits ignores a spoofed MessageDelivered/InboxMessageDelivered pair from an unrelated contract', async () => {
    const ethDepositData = utils.hexConcat([
      '0x0000000000000000000000000000000000004242', // to
      utils.hexlify(BigNumber.from('1000000000000000000')), // value
    ])
    const forgedLogs = [
      makeMessageDeliveredLog(ATTACKER_ADDRESS, 0, {
        inbox: ATTACKER_ADDRESS,
        kind: InboxMessageKind.L1MessageType_ethDeposit,
      }),
      makeInboxMessageDeliveredLog(
        ATTACKER_ADDRESS,
        0,
        utils.defaultAbiCoder.encode(['bytes'], [ethDepositData])
      ),
    ]
    const receipt = buildReceipt(forgedLogs)
    const deposits = await receipt.getEthDeposits(mockChildProvider())
    expect(deposits.length).to.equal(0)
  })

  it('getEthDeposits accepts a genuine MessageDelivered/InboxMessageDelivered pair from the real Arbitrum One bridge/inbox', async () => {
    const ethDepositData = utils.hexConcat([
      '0x0000000000000000000000000000000000004242', // to
      utils.hexlify(BigNumber.from('1000000000000000000')), // value
    ])
    const realLogs = [
      makeMessageDeliveredLog(ARB_ONE_BRIDGE, 0, {
        inbox: ARB_ONE_INBOX,
        kind: InboxMessageKind.L1MessageType_ethDeposit,
      }),
      makeInboxMessageDeliveredLog(
        ARB_ONE_INBOX,
        0,
        utils.defaultAbiCoder.encode(['bytes'], [ethDepositData])
      ),
    ]
    const receipt = buildReceipt(realLogs)
    const deposits = await receipt.getEthDeposits(mockChildProvider())
    expect(deposits.length).to.equal(1)
  })

  it('getParentToChildMessagesClassic ignores a spoofed InboxMessageDelivered log from an unrelated contract', async () => {
    const receipt = buildReceipt(
      [makeInboxMessageDeliveredLog(ATTACKER_ADDRESS, 0)],
      1 // below ARB1_NITRO_GENESIS_L1_BLOCK -> classic
    )
    const messages = await receipt.getParentToChildMessagesClassic(
      mockChildProvider()
    )
    expect(messages.length).to.equal(0)
  })

  it('getParentToChildMessagesClassic accepts a genuine InboxMessageDelivered log from the real Arbitrum One inbox', async () => {
    const receipt = buildReceipt(
      [makeInboxMessageDeliveredLog(ARB_ONE_INBOX, 0)],
      1 // below ARB1_NITRO_GENESIS_L1_BLOCK -> classic
    )
    const messages = await receipt.getParentToChildMessagesClassic(
      mockChildProvider()
    )
    expect(messages.length).to.equal(1)
  })
})

describe('ChildTransactionReceipt event address scoping (fixed precompile addresses)', () => {
  function buildReceipt(logs: unknown[]): ChildTransactionReceipt {
    return new ChildTransactionReceipt({
      logs,
    } as unknown as TransactionReceipt)
  }

  it('getChildToParentEvents ignores a spoofed L2ToL1Tx log from an unrelated contract', () => {
    const receipt = buildReceipt([makeL2ToL1TxLog(ATTACKER_ADDRESS)])
    expect(receipt.getChildToParentEvents().length).to.equal(0)
  })

  it('getChildToParentEvents accepts a genuine L2ToL1Tx log from ARB_SYS_ADDRESS', () => {
    const receipt = buildReceipt([makeL2ToL1TxLog(ARB_SYS_ADDRESS)])
    expect(receipt.getChildToParentEvents().length).to.equal(1)
  })

  it('getRedeemScheduledEvents ignores a spoofed RedeemScheduled log from an unrelated contract', () => {
    const receipt = buildReceipt([makeRedeemScheduledLog(ATTACKER_ADDRESS)])
    expect(receipt.getRedeemScheduledEvents().length).to.equal(0)
  })

  it('getRedeemScheduledEvents accepts a genuine RedeemScheduled log from ARB_RETRYABLE_TX_ADDRESS', () => {
    const receipt = buildReceipt([
      makeRedeemScheduledLog(ARB_RETRYABLE_TX_ADDRESS),
    ])
    expect(receipt.getRedeemScheduledEvents().length).to.equal(1)
  })
})
