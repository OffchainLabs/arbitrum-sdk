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

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'

import { ArbGasInfo__factory } from '../src/lib/abi/factories/ArbGasInfo__factory'
import {
  fundL1,
  fundL2,
  prettyLog,
  shouldFinaliseWithdrawal,
  skipIfMainnet,
} from './testHelpers'
import { ARB_GAS_INFO } from '../src/lib/dataEntities/constants'
import {
  L2ToL1Message,
  L2ToL1MessageStatus,
} from '../src/lib/message/L2ToL1Message'
import { testSetup } from '../scripts/testSetup'
import { isNitroL2, isNitroL1 } from '../src/lib/utils/migration_types'
dotenv.config()

describe('Ether', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('transfers ether on l2', async () => {
    const { l2Signer, l1Signer } = await testSetup()
    const l2ChainId = await l2Signer.getChainId()
    if (await isNitroL1(l2ChainId, l1Signer)) {
      await fundL2(l2Signer, parseEther('0.5'))
    } else {
      await fundL2(l2Signer, parseEther('0.001'))
    }

    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    await (
      await l2Signer.sendTransaction({
        to: randomAddress,
        value: amountToSend,
      })
    ).wait()

    const randomBalanceAfter = await l2Signer.provider!.getBalance(
      randomAddress
    )
    expect(randomBalanceAfter.toString(), 'random address balance after').to.eq(
      amountToSend.toString()
    )
  })

  it('deposits ether', async () => {
    const { ethBridger, l1Signer, l2Signer } = await testSetup()

    await fundL1(l1Signer, parseEther('0.01'))
    const inboxAddress = ethBridger.l2Network.ethBridge.inbox

    const initialInboxBalance = await l1Signer.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0001')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      l1Signer: l1Signer,
      l2Provider: l2Signer.provider!,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await l1Signer.provider!.getBalance(inboxAddress)
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const waitResult = await rec.waitForL2(l2Signer.provider!)

    const l1ToL2Messages = await rec.getEthDepositMessages(l2Signer)
    expect(l1ToL2Messages.length).to.eq(1, 'failed to find 1 l1 to l2 message')

    prettyLog('l2 transaction found!')
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')

    const testWalletL2EthBalance = await l2Signer.getBalance()
    if (await isNitroL2(l2Signer)) {
      expect(
        testWalletL2EthBalance.gte(
          initialInboxBalance.add(ethToDeposit).sub(10000)
        ),
        `final balance: ${testWalletL2EthBalance.toString()}, ${ethToDeposit.toString()}`
      ).to.be.true
    } else {
      expect(
        testWalletL2EthBalance.gte(
          initialInboxBalance.add(ethToDeposit).sub(10000000000000)
        ),
        'eth balance still 0 after deposit'
      ).to.be.true
    }
  })

  it('withdraw Ether transaction succeeds', async () => {
    const { l2Signer, l1Signer, ethBridger } = await testSetup()
    await fundL2(l2Signer)
    await fundL1(l1Signer)
    const ethToWithdraw = parseEther('0.00000002')
    const initialBalance = await l2Signer.getBalance()

    const withdrawEthRes = await ethBridger.withdraw({
      amount: ethToWithdraw,
      l2Signer: l2Signer,
    })
    const withdrawEthRec = await withdrawEthRes.wait()

    const arbGasInfo = ArbGasInfo__factory.connect(
      ARB_GAS_INFO,
      l2Signer.provider!
    )
    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    const inWei = await arbGasInfo.getPricesInWei({
      blockTag: withdrawEthRec.blockNumber,
    })

    const withdrawMessage = (
      await withdrawEthRec.getL2ToL1Messages(l1Signer, l2Signer.provider!)
    )[0]
    expect(
      withdrawMessage,
      'eth withdraw getWithdrawalsInL2Transaction query came back empty'
    ).to.exist

    const myAddress = await l1Signer.getAddress()

    const withdrawEvents = await L2ToL1Message.getEventLogs(
      l2Signer.provider!,
      { fromBlock: withdrawEthRec.blockNumber, toBlock: 'latest' },
      undefined,
      myAddress
    )

    expect(withdrawEvents.length).to.equal(
      1,
      'eth withdraw getL2ToL1EventData failed'
    )

    const messageStatus = await withdrawMessage.status(l2Signer.provider!)
    expect(
      messageStatus,
      `eth withdraw status returned ${messageStatus}`
    ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

    const etherBalance = await l2Signer.getBalance()
    const totalEth = etherBalance
      .add(ethToWithdraw)
      .add(withdrawEthRec.gasUsed.mul(inWei[5]))

    if ((await isNitroL2(l2Signer)) && shouldFinaliseWithdrawal()) {
      await withdrawMessage.waitUntilReadyToExecute(l2Signer.provider!)

      expect(
        await withdrawMessage.status(l2Signer.provider!),
        'confirmed status'
      ).to.eq(L2ToL1MessageStatus.CONFIRMED)

      const execTx = await withdrawMessage.execute(l2Signer.provider!)
      await execTx.wait()
      expect(
        await withdrawMessage.status(l2Signer.provider!),
        'executed status'
      ).to.eq(L2ToL1MessageStatus.EXECUTED)

      console.log(
        `This number should be zero...? ${initialBalance
          .sub(totalEth)
          .toString()}`
      )
    }
  })
})
