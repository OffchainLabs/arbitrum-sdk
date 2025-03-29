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
import { fundParentSigner, skipIfMainnet } from './testHelpers'
import { testSetup } from '../testSetup'
import { ParentToChildMessageCreator } from '../../src/lib/message/ParentToChildMessageCreator'
import { ParentToChildMessageStatus } from '../../src/lib/message/ParentToChildMessage'

import {
  fundParentCustomFeeToken,
  approveParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
} from './custom-fee-token/customFeeTokenTestHelpers'

describe('ParentToChildMessageCreator', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // Testing amount
  const testAmount = utils.parseEther('0.01')

  it('allows the creation of Retryable Tickets sending parameters', async () => {
    const { parentSigner, childSigner } = await testSetup()
    const signerAddress = await parentSigner.getAddress()
    const arbProvider = childSigner.provider as providers.Provider

    // Funding parent chain wallet
    await fundParentSigner(parentSigner)

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentSigner)
      await approveParentCustomFeeToken(parentSigner)
    }

    // Instantiate the object
    const parentToChildMessageCreator = new ParentToChildMessageCreator(
      parentSigner
    )

    // Getting balances
    const initialChildChainBalance = await childSigner.getBalance()

    // Define parameters for Retryable
    const retryableTicketParams = {
      from: signerAddress,
      to: signerAddress,
      l2CallValue: testAmount,
      callValueRefundAddress: signerAddress,
      data: '0x',
    }

    // And submitting the ticket
    const parentSubmissionTx =
      await parentToChildMessageCreator.createRetryableTicket(
        retryableTicketParams,
        arbProvider
      )
    const parentSubmissionTxReceipt = await parentSubmissionTx.wait()

    // Getting the ParentToChildMessage
    const parentToChildMessages =
      await parentSubmissionTxReceipt.getParentToChildMessages(arbProvider)
    expect(parentToChildMessages.length).to.eq(1)
    const parentToChildMessage = parentToChildMessages[0]

    // And waiting for it to be redeemed
    const retryableTicketResult = await parentToChildMessage.waitForStatus()
    expect(retryableTicketResult.status).to.eq(
      ParentToChildMessageStatus.REDEEMED
    )

    // Getting and checking updated balances
    const finalChildChainBalance = await childSigner.getBalance()

    // When sending ETH through retryables, the same address will receive the ETH sent through the callvalue
    // plus any gas that was not used in the operation.
    expect(
      initialChildChainBalance.add(testAmount).lt(finalChildChainBalance),
      'Child chain balance not updated'
    ).to.be.true
  })

  it('allows the creation of Retryable Tickets sending a request', async () => {
    const { parentSigner, childSigner } = await testSetup()
    const signerAddress = await parentSigner.getAddress()
    const ethProvider = parentSigner.provider as providers.Provider
    const arbProvider = childSigner.provider as providers.Provider

    // Funding parent chain wallet
    await fundParentSigner(parentSigner)

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentSigner)
      await approveParentCustomFeeToken(parentSigner)
    }

    // Instantiate the object
    const parentToChildMessageCreator = new ParentToChildMessageCreator(
      parentSigner
    )

    // Getting balances
    const initialChildChainBalance = await childSigner.getBalance()

    // In this case, we will try to send directly a ParentToChildTransactionRequest
    const parentToChildTransactionRequestParams = {
      from: signerAddress,
      to: signerAddress,
      l2CallValue: testAmount,
      callValueRefundAddress: signerAddress,
      data: '0x',
    }

    const parentToChildTransactionRequest =
      await ParentToChildMessageCreator.getTicketCreationRequest(
        parentToChildTransactionRequestParams,
        ethProvider,
        arbProvider
      )

    // And create the retryable ticket
    const parentSubmissionTx =
      await parentToChildMessageCreator.createRetryableTicket(
        parentToChildTransactionRequest,
        arbProvider
      )
    const parentSubmissionTxReceipt = await parentSubmissionTx.wait()

    // Getting the ParentToChildMessage
    const parentToChildMessages =
      await parentSubmissionTxReceipt.getParentToChildMessages(arbProvider)
    expect(parentToChildMessages.length).to.eq(1)
    const parentToChildMessage = parentToChildMessages[0]

    // And waiting for it to be redeemed
    const retryableTicketResult = await parentToChildMessage.waitForStatus()
    expect(retryableTicketResult.status).to.eq(
      ParentToChildMessageStatus.REDEEMED
    )

    // Getting and checking updated balances
    const finalChildChainBalance = await childSigner.getBalance()

    // When sending ETH through retryables, the same address will receive the ETH sent through the callvalue
    // plus any gas that was not used in the operation.
    expect(
      initialChildChainBalance.add(testAmount).lt(finalChildChainBalance),
      'Child chain balance not updated'
    ).to.be.true
  })
})
