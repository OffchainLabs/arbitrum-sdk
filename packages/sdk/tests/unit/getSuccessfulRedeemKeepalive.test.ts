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

import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { BigNumber, providers, utils } from 'ethers'
import { expect } from 'chai'
import { anything, instance, mock, when } from 'ts-mockito'
import {
  ParentToChildMessageReader,
  ParentToChildMessageStatus,
} from '../../src/lib/message/ParentToChildMessage'
import { SEVEN_DAYS_IN_SECONDS } from '../../src/lib/dataEntities/constants'
import { ArbRetryableTx__factory } from '../../src/lib/abi/factories/ArbRetryableTx__factory'

const iface = ArbRetryableTx__factory.createInterface()
const REDEEM_SCHEDULED_TOPIC = iface.getEventTopic('RedeemScheduled')
const LIFETIME_EXTENDED_TOPIC = iface.getEventTopic('LifetimeExtended')
const ARB_RETRYABLE_TX_ADDRESS = '0x000000000000000000000000000000000000006E'

function topicPad(value: string): string {
  return utils.hexZeroPad(value, 32)
}

function makeLifetimeExtendedLog(
  ticketId: string,
  newTimeout: number,
  blockNumber: number
) {
  return {
    blockNumber,
    blockHash: utils.hexZeroPad(utils.hexlify(blockNumber), 32),
    transactionIndex: 0,
    removed: false,
    address: ARB_RETRYABLE_TX_ADDRESS,
    data: utils.defaultAbiCoder.encode(['uint256'], [newTimeout]),
    topics: [LIFETIME_EXTENDED_TOPIC, topicPad(ticketId)],
    transactionHash: utils.hexZeroPad(utils.hexlify(blockNumber + 1), 32),
    logIndex: 0,
  }
}

function makeRedeemScheduledLog(
  ticketId: string,
  retryTxHash: string,
  blockNumber: number
) {
  return {
    blockNumber,
    blockHash: utils.hexZeroPad(utils.hexlify(blockNumber), 32),
    transactionIndex: 0,
    removed: false,
    address: ARB_RETRYABLE_TX_ADDRESS,
    data: utils.defaultAbiCoder.encode(
      ['uint64', 'address', 'uint256', 'uint256'],
      [0, '0x0000000000000000000000000000000000000001', 0, 0]
    ),
    topics: [
      REDEEM_SCHEDULED_TOPIC,
      topicPad(ticketId),
      topicPad(retryTxHash),
      topicPad(utils.hexlify(0)),
    ],
    transactionHash: utils.hexZeroPad(utils.hexlify(blockNumber + 1), 32),
    logIndex: 1,
  }
}

// Each 1000-block range spans exactly 86400 real seconds (1 "day"), so the
// adaptive `increment` in getSuccessfulRedeem's scan loop stays stable at
// 1000 blocks per iteration - giving fully predictable, controllable ranges
// to place synthetic events in. Arbitrum One does not configure a custom
// `retryableLifetimeSeconds`, so the code falls back to SEVEN_DAYS_IN_SECONDS.
const SECONDS_PER_BLOCK = 86.4
const L = SEVEN_DAYS_IN_SECONDS

function buildMessage() {
  const providerMock = mock(providers.JsonRpcProvider)
  when(providerMock._isProvider).thenReturn(true)
  when(providerMock.getNetwork()).thenResolve({ chainId: 42161 } as any)

  const provider = instance(providerMock)

  const message = new ParentToChildMessageReader(
    provider,
    42161,
    '0x0000000000000000000000000000000000000001',
    BigNumber.from(1),
    BigNumber.from(0),
    {
      destAddress: '0x0000000000000000000000000000000000000002',
      l2CallValue: BigNumber.from(0),
      l1Value: BigNumber.from(0),
      maxSubmissionFee: BigNumber.from(0),
      excessFeeRefundAddress: '0x0000000000000000000000000000000000000003',
      callValueRefundAddress: '0x0000000000000000000000000000000000000004',
      gasLimit: BigNumber.from(100000),
      maxFeePerGas: BigNumber.from(1),
      data: '0x',
    }
  )

  // Isolate the code path under test (the keepalive-scan loop inside
  // getSuccessfulRedeem) by stubbing the surrounding checks directly on the
  // instance - each of these requires its own heavy provider/contract-call
  // setup unrelated to the loop being tested here.
  ;(message as any).getRetryableCreationReceipt = async () => ({
    blockNumber: 0,
    status: 1,
  })
  ;(message as any).getAutoRedeemAttempt = async () => null
  ;(message as any).retryableExists = async () => false

  return { message, provider, providerMock }
}

describe('getSuccessfulRedeem keepalive scan', () => {
  it('finds a later keepalive that only became discoverable after an earlier, insufficient one already triggered a range-trim, and correctly redeems instead of reporting EXPIRED', async () => {
    const { message, providerMock } = buildMessage()
    const ticketId = message.retryableCreationId

    when(providerMock.getBlockNumber()).thenResolve(20000)
    when(providerMock.getBlock(anything())).thenCall(
      async (blockNumber: number) => ({
        number: blockNumber,
        timestamp: Math.round(blockNumber * SECONDS_PER_BLOCK),
        hash: utils.hexZeroPad(utils.hexlify(blockNumber), 32),
      })
    )

    // Protocol-realistic keepalive semantics: each LifetimeExtended event
    // adds one full retryable lifetime to the CURRENT timeout (this mirrors
    // Nitro's real ArbRetryableTx.keepalive behaviour: newTimeout = timeout
    // + RetryableLifetimeSeconds), not an arbitrary synthetic value.
    //   T0 (creation)      = L          = 604800
    //   keepalive1 (T1)    = T0 + L     = 1209600  - insufficient alone
    //   keepalive2 (T2)    = T1 + L     = 1814400  - the true final timeout
    const T1 = 2 * L // 1209600
    const T2 = 3 * L // 1814400

    // keepalive1 sits in the very first queried range; keepalive2 sits in a
    // LATER range that is nonetheless still part of the SAME accumulated
    // `queriedRange` batch by the time the first crossing (against T0)
    // triggers a backward-scan - both are already fetched by then.
    const keepalive1Block = 500 // range [0, 1000]
    const keepalive2Block = 6500 // range [6000, 7000]

    // The real, successful redeem sits well after keepalive1's own (too
    // small) timeout T1 would have already caused an old, buggy scan to
    // conclude EXPIRED - but still comfortably before the true timeout T2.
    const redeemBlock = 16000
    const retryTxHash = utils.hexZeroPad('0x1234', 32)

    when(providerMock.getLogs(anything())).thenCall(async (filter: any) => {
      const from = Number(filter.fromBlock)
      const to = Number(filter.toBlock)
      const isLifetimeExtended = filter.topics?.[0] === LIFETIME_EXTENDED_TOPIC
      const isRedeemScheduled = filter.topics?.[0] === REDEEM_SCHEDULED_TOPIC

      if (isRedeemScheduled) {
        if (redeemBlock >= from && redeemBlock <= to) {
          return [makeRedeemScheduledLog(ticketId, retryTxHash, redeemBlock)]
        }
        return []
      }

      if (isLifetimeExtended) {
        const logs = []
        if (keepalive1Block >= from && keepalive1Block <= to) {
          logs.push(makeLifetimeExtendedLog(ticketId, T1, keepalive1Block))
        }
        if (keepalive2Block >= from && keepalive2Block <= to) {
          logs.push(makeLifetimeExtendedLog(ticketId, T2, keepalive2Block))
        }
        return logs
      }
      return []
    })

    when(providerMock.getTransactionReceipt(retryTxHash)).thenResolve({
      status: 1,
      transactionHash: retryTxHash,
    } as any)

    const result = await message.getSuccessfulRedeem()

    expect(result.status).to.equal(ParentToChildMessageStatus.REDEEMED)
    if (result.status === ParentToChildMessageStatus.REDEEMED) {
      expect(result.childTxReceipt.transactionHash).to.equal(retryTxHash)
    }
  })

  it('takes a genuine numeric maximum across multiple keepalive events in the same range, not a lexicographic one', async () => {
    const { message, providerMock } = buildMessage()
    const ticketId = message.retryableCreationId

    when(providerMock.getBlockNumber()).thenResolve(15000)
    when(providerMock.getBlock(anything())).thenCall(
      async (blockNumber: number) => ({
        number: blockNumber,
        timestamp: Math.round(blockNumber * SECONDS_PER_BLOCK),
        hash: utils.hexZeroPad(utils.hexlify(blockNumber), 32),
      })
    )

    // Two keepalives in the SAME first range, both real (7-digit-or-fewer)
    // protocol-scale second counts, but whose STRING order is the opposite
    // of their numeric order: "1209600" < "900000" lexicographically
    // (comparing the leading '1' vs '9'), even though 1209600 > 900000
    // numerically. A `.sort().reverse()[0]` on these picks 900000 as the
    // "max" - the wrong, smaller value.
    const smallTimeout = 900000
    const largeTimeout = 2 * L // 1209600 - the real, larger timeout
    const redeemBlock = 12000
    const retryTxHash = utils.hexZeroPad('0x5678', 32)

    when(providerMock.getLogs(anything())).thenCall(async (filter: any) => {
      const from = Number(filter.fromBlock)
      const to = Number(filter.toBlock)
      const isLifetimeExtended = filter.topics?.[0] === LIFETIME_EXTENDED_TOPIC
      const isRedeemScheduled = filter.topics?.[0] === REDEEM_SCHEDULED_TOPIC

      if (isRedeemScheduled) {
        if (redeemBlock >= from && redeemBlock <= to) {
          return [makeRedeemScheduledLog(ticketId, retryTxHash, redeemBlock)]
        }
        return []
      }
      if (isLifetimeExtended && from === 0) {
        return [
          makeLifetimeExtendedLog(ticketId, smallTimeout, 100),
          makeLifetimeExtendedLog(ticketId, largeTimeout, 200),
        ]
      }
      return []
    })

    when(providerMock.getTransactionReceipt(retryTxHash)).thenResolve({
      status: 1,
      transactionHash: retryTxHash,
    } as any)

    const result = await message.getSuccessfulRedeem()

    // Under the lexicographic-sort bug, timeout would be wrongly set to
    // smallTimeout (900000), which is crossed well before redeemBlock's
    // timestamp (12000 * 86.4 = 1,036,800s) is reached - so the buggy code
    // would report EXPIRED before ever seeing the real redeem. The correct
    // numeric max (1,209,600) is not crossed until after redeemBlock, so
    // the fixed code reaches and finds it.
    expect(result.status).to.equal(ParentToChildMessageStatus.REDEEMED)
    if (result.status === ParentToChildMessageStatus.REDEEMED) {
      expect(result.childTxReceipt.transactionHash).to.equal(retryTxHash)
    }
  })
})
