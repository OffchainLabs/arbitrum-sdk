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
import dotenv from 'dotenv'

import { parseEther } from '@ethersproject/units'

import { testSetup } from '../../scripts/testSetup'
import { skipIfMainnet, fundL1, prettyLog } from './testHelpers'

dotenv.config()

describe('useViemSigner', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // This is just a copy of the test from tests/integration/eth.test.ts
  // with the addition of the use of WalletClient for signing

  it('deposits ether', async () => {
    const { ethBridger, l1Signer, l2Signer, ethWalletClient } =
      await testSetup()

    await fundL1(l1Signer)
    const inboxAddress = ethBridger.l2Network.ethBridge.inbox

    const initialInboxBalance = await l1Signer.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      l1Signer: ethWalletClient, // uses WalletClient from viem to create a ViemSigner in the decorator
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await l1Signer.provider!.getBalance(inboxAddress)
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const waitResult = await rec.waitForL2(l2Signer.provider!)

    const l1ToL2Messages = await rec.getEthDeposits(l2Signer.provider!)
    expect(l1ToL2Messages.length).to.eq(1, 'failed to find 1 l1 to l2 message')
    const l1ToL2Message = l1ToL2Messages[0]

    const walletAddress = await l1Signer.getAddress()
    expect(l1ToL2Message.to).to.eq(walletAddress, 'message inputs value error')
    expect(l1ToL2Message.value.toString(), 'message inputs value error').to.eq(
      ethToDeposit.toString()
    )

    prettyLog('l2TxHash: ' + waitResult.message.l2DepositTxHash)
    prettyLog('l2 transaction found!')
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.l2TxReceipt).to.exist
    expect(waitResult.l2TxReceipt).to.not.be.null

    const testWalletL2EthBalance = await l2Signer.getBalance()
    expect(testWalletL2EthBalance.toString(), 'final balance').to.eq(
      ethToDeposit.toString()
    )
  })
})
