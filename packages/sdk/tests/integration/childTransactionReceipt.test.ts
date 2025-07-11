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

import { expect } from 'chai'

import {
  fundParentSigner,
  fundChildSigner,
  mineUntilStop,
  skipIfMainnet,
  wait,
} from './testHelpers'
import { ChildTransactionReceipt } from '../../src'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { testSetup } from '../testSetup'

async function waitForL1BatchConfirmations(
  arbTxReceipt: ChildTransactionReceipt,
  l2Provider: JsonRpcProvider,
  timeoutMs: number
) {
  let polls = 0
  let l1BatchConfirmations = 0

  const MAX_POLLS = 10

  while (polls < MAX_POLLS) {
    l1BatchConfirmations = (
      await arbTxReceipt.getBatchConfirmations(l2Provider)
    ).toNumber()

    // exit out of the while loop after fetching a non-zero number of batch confirmations
    if (l1BatchConfirmations !== 0) {
      break
    }

    // otherwise, increment the number of polls and wait
    polls += 1
    await wait(timeoutMs / MAX_POLLS)
  }

  return l1BatchConfirmations
}

describe('ArbProvider', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('does find l1 batch info', async () => {
    const { childSigner, parentSigner } = await testSetup()
    const l2Provider = childSigner.provider! as JsonRpcProvider

    // set up miners
    const miner1 = Wallet.createRandom().connect(parentSigner.provider!)
    const miner2 = Wallet.createRandom().connect(childSigner.provider!)
    await fundParentSigner(miner1, parseEther('0.1'))
    await fundChildSigner(miner2, parseEther('0.1'))
    const state = { mining: true }
    mineUntilStop(miner1, state)
    mineUntilStop(miner2, state)

    await fundChildSigner(childSigner)
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    // send an l2 transaction, and get the receipt
    const tx = await childSigner.sendTransaction({
      to: randomAddress,
      value: amountToSend,
    })
    const rec = await tx.wait()

    // wait for the batch data
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await wait(300)
      const arbTxReceipt = new ChildTransactionReceipt(rec)

      const l1BatchNumber = (
        await arbTxReceipt.getBatchNumber(l2Provider).catch(() => {
          // findBatchContainingBlock errors if block number does not exist
          return BigNumber.from(0)
        })
      ).toNumber()

      if (l1BatchNumber && l1BatchNumber > 0) {
        const l1BatchConfirmations = await waitForL1BatchConfirmations(
          arbTxReceipt,
          l2Provider,
          // for L3s, we also have to wait for the batch to land on L1, so we poll for max 60s until that happens
          60_000
        )

        expect(l1BatchConfirmations, 'missing confirmations').to.be.gt(0)

        if (l1BatchConfirmations > 8) {
          break
        }
      }
    }

    state.mining = false
  })
})
