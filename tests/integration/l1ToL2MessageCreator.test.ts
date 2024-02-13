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
import { providers, utils } from 'ethers'
import { fundL1, skipIfMainnet } from './testHelpers'
import { testSetup } from '../../scripts/testSetup'
import { L1ToL2MessageCreator } from '../../src/lib/message/L1ToL2MessageCreator'
import { L1ToL2MessageStatus } from '../../src'

import {
  fundL1CustomFeeToken,
  approveL1CustomFeeToken,
  isL2NetworkWithCustomFeeToken,
} from './custom-fee-token/customFeeTokenTestHelpers'

describe('L1ToL2MessageCreator', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // Testing amount
  const testAmount = utils.parseEther('0.01')

  it('allows the creation of Retryable Tickets sending parameters', async () => {
    const { l1Signer, l2Signer } = await testSetup()
    const signerAddress = await l1Signer.getAddress()
    const arbProvider = l2Signer.provider as providers.Provider

    // Funding L1 wallet
    await fundL1(l1Signer)

    if (isL2NetworkWithCustomFeeToken()) {
      await fundL1CustomFeeToken(l1Signer)
      await approveL1CustomFeeToken(l1Signer)
    }

    // Instantiate the object
    const l1ToL2MessageCreator = new L1ToL2MessageCreator(l1Signer)

    // Getting balances
    const initialL2Balance = await l2Signer.getBalance()

    // Define parameters for Retryable
    const retryableTicketParams = {
      from: signerAddress,
      to: signerAddress,
      l2CallValue: testAmount,
      callValueRefundAddress: signerAddress,
      data: '0x',
    }

    // And submitting the ticket
    const l1SubmissionTx = await l1ToL2MessageCreator.createRetryableTicket(
      retryableTicketParams,
      arbProvider
    )
    const l1SubmissionTxReceipt = await l1SubmissionTx.wait()

    // Getting the L1ToL2Message
    const l1ToL2messages = await l1SubmissionTxReceipt.getL1ToL2Messages(
      arbProvider
    )
    expect(l1ToL2messages.length).to.eq(1)
    const l1ToL2message = l1ToL2messages[0]

    // And waiting for it to be redeemed
    const retryableTicketResult = await l1ToL2message.waitForStatus()
    expect(retryableTicketResult.status).to.eq(L1ToL2MessageStatus.REDEEMED)

    // Getting and checking updated balances
    const finalL2Balance = await l2Signer.getBalance()

    // When sending ETH through retryables, the same address will receive the ETH sent through the callvalue
    // plus any gas that was not used in the operation.
    expect(
      initialL2Balance.add(testAmount).lt(finalL2Balance),
      'L2 balance not updated'
    ).to.be.true
  })

  it('allows the creation of Retryable Tickets sending a request', async () => {
    const { l1Signer, l2Signer } = await testSetup()
    const signerAddress = await l1Signer.getAddress()
    const ethProvider = l1Signer.provider as providers.Provider
    const arbProvider = l2Signer.provider as providers.Provider

    // Funding L1 wallet
    await fundL1(l1Signer)

    if (isL2NetworkWithCustomFeeToken()) {
      await fundL1CustomFeeToken(l1Signer)
      await approveL1CustomFeeToken(l1Signer)
    }

    // Instantiate the object
    const l1ToL2MessageCreator = new L1ToL2MessageCreator(l1Signer)

    // Getting balances
    const initialL2Balance = await l2Signer.getBalance()

    // In this case, we will try to send directly an L1ToL2TransactionRequest
    const l1ToL2TransactionRequestParams = {
      from: signerAddress,
      to: signerAddress,
      l2CallValue: testAmount,
      callValueRefundAddress: signerAddress,
      data: '0x',
    }

    const l1ToL2TransactionRequest =
      await L1ToL2MessageCreator.getTicketCreationRequest(
        l1ToL2TransactionRequestParams,
        ethProvider,
        arbProvider
      )

    // And create the retryable ticket
    const l1SubmissionTx = await l1ToL2MessageCreator.createRetryableTicket(
      l1ToL2TransactionRequest,
      arbProvider
    )
    const l1SubmissionTxReceipt = await l1SubmissionTx.wait()

    // Getting the L1ToL2Message
    const l1ToL2messages = await l1SubmissionTxReceipt.getL1ToL2Messages(
      arbProvider
    )
    expect(l1ToL2messages.length).to.eq(1)
    const l1ToL2message = l1ToL2messages[0]

    // And waiting for it to be redeemed
    const retryableTicketResult = await l1ToL2message.waitForStatus()
    expect(retryableTicketResult.status).to.eq(L1ToL2MessageStatus.REDEEMED)

    // Getting and checking updated balances
    const finalL2Balance = await l2Signer.getBalance()

    // When sending ETH through retryables, the same address will receive the ETH sent through the callvalue
    // plus any gas that was not used in the operation.
    expect(
      initialL2Balance.add(testAmount).lt(finalL2Balance),
      'L2 balance not updated'
    ).to.be.true
  })
})
