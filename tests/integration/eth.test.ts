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

import {
  fundL1,
  fundL2,
  mineUntilStop,
  prettyLog,
  skipIfMainnet,
} from './testHelpers'
import { L2ToL1Message } from '../../src/lib/message/L2ToL1Message'
import { L2ToL1MessageStatus } from '../../src/lib/dataEntities/message'
import { L2TransactionReceipt } from '../../src/lib/message/L2Transaction'
import { L1ToL2MessageStatus } from '../../src/lib/message/L1ToL2Message'
import { testSetup } from '../../scripts/testSetup'
import { isL2NetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { itOnlyWhenEth } from './custom-fee-token/mochaExtensions'

dotenv.config()

describe('Ether', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('transfers ether on l2', async () => {
    const { l2Signer } = await testSetup()

    await fundL2(l2Signer)
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    const balanceBefore = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )

    const rec = await (
      await l2Signer.sendTransaction({
        to: randomAddress,
        value: amountToSend,
        maxFeePerGas: 15000000000,
        maxPriorityFeePerGas: 0,
      })
    ).wait()

    const balanceAfter = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )
    const randomBalanceAfter = await l2Signer.provider!.getBalance(
      randomAddress
    )
    expect(randomBalanceAfter.toString(), 'random address balance after').to.eq(
      amountToSend.toString()
    )
    expect(balanceAfter.toString(), 'l2 balance after').to.eq(
      balanceBefore
        .sub(rec.gasUsed.mul(rec.effectiveGasPrice))
        .sub(amountToSend)
        .toString()
    )
  })

  itOnlyWhenEth(
    '"EthBridger.approveGasToken" throws when eth is used as native/gas token',
    async () => {
      const { ethBridger, l1Signer } = await testSetup()

      try {
        await ethBridger.approveGasToken({ l1Signer })
        expect.fail(`"EthBridger.approveGasToken" should have thrown`)
      } catch (error: any) {
        expect(error.message).to.equal('chain uses ETH as its native/gas token')
      }
    }
  )

  it('deposits ether', async () => {
    const { ethBridger, l1Signer, l2Signer } = await testSetup()

    await fundL1(l1Signer)
    const inboxAddress = ethBridger.l2Network.ethBridge.inbox

    const initialInboxBalance = await l1Signer.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      l1Signer: l1Signer,
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

  it('deposits ether to a specific L2 address', async () => {
    const { ethBridger, l1Signer, l2Signer } = await testSetup()

    await fundL1(l1Signer)
    const inboxAddress = ethBridger.l2Network.ethBridge.inbox
    const destWallet = Wallet.createRandom()

    const initialInboxBalance = await l1Signer.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.depositTo({
      amount: ethToDeposit,
      l1Signer: l1Signer,
      destinationAddress: destWallet.address,
      l2Provider: l2Signer.provider!,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await l1Signer.provider!.getBalance(inboxAddress)
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const l1ToL2Messages = await rec.getL1ToL2Messages(l2Signer.provider!)
    expect(l1ToL2Messages.length).to.eq(1, 'failed to find 1 l1 to l2 message')
    const l1ToL2Message = l1ToL2Messages[0]

    expect(l1ToL2Message.messageData.destAddress).to.eq(
      destWallet.address,
      'message inputs value error'
    )
    expect(
      l1ToL2Message.messageData.l2CallValue.toString(),
      'message inputs value error'
    ).to.eq(ethToDeposit.toString())

    const retryableTicketResult = await l1ToL2Message.waitForStatus()
    expect(retryableTicketResult.status).to.eq(
      L1ToL2MessageStatus.REDEEMED,
      'Retryable ticket not redeemed'
    )

    const retryableTxReceipt = await l2Signer.provider!.getTransactionReceipt(
      l1ToL2Message.retryableCreationId
    )
    expect(retryableTxReceipt).to.exist
    expect(retryableTxReceipt).to.not.be.null

    const l2RetryableTxReceipt = new L2TransactionReceipt(retryableTxReceipt)
    const ticketRedeemEvents = l2RetryableTxReceipt.getRedeemScheduledEvents()
    expect(ticketRedeemEvents.length).to.eq(
      1,
      'failed finding the redeem event'
    )
    expect(ticketRedeemEvents[0].retryTxHash).to.exist
    expect(ticketRedeemEvents[0].retryTxHash).to.not.be.null

    const testWalletL2EthBalance = await l2Signer.provider!.getBalance(
      destWallet.address
    )
    expect(testWalletL2EthBalance.toString(), 'final balance').to.eq(
      ethToDeposit.toString()
    )
  })

  it('withdraw Ether transaction succeeds', async () => {
    const { l2Signer, l1Signer, ethBridger } = await testSetup()
    await fundL2(l2Signer)
    await fundL1(l1Signer)

    const ethToWithdraw = parseEther('0.00000002')
    const randomAddress = Wallet.createRandom().address

    const request = await ethBridger.getWithdrawalRequest({
      amount: ethToWithdraw,
      destinationAddress: randomAddress,
      from: await l2Signer.getAddress(),
    })

    const l1GasEstimate = await request.estimateL1GasLimit(l1Signer.provider!)

    const withdrawEthRes = await ethBridger.withdraw({
      amount: ethToWithdraw,
      l2Signer: l2Signer,
      destinationAddress: randomAddress,
      from: await l2Signer.getAddress(),
    })

    const withdrawEthRec = await withdrawEthRes.wait()

    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    const withdrawMessage = (
      await withdrawEthRec.getL2ToL1Messages(l1Signer)
    )[0]
    expect(
      withdrawMessage,
      'eth withdraw getWithdrawalsInL2Transaction query came back empty'
    ).to.exist

    const withdrawEvents = await L2ToL1Message.getL2ToL1Events(
      l2Signer.provider!,
      { fromBlock: withdrawEthRec.blockNumber, toBlock: 'latest' },
      undefined,
      randomAddress
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

    // CHRIS: TODO: comment this back in when fixed in nitro
    // const actualFinalBalance = await l2Signer.getBalance()
    // const expectedFinalBalance = initialBalance
    //   .sub(ethToWithdraw)
    //   .sub(withdrawEthRec.gasUsed.mul(withdrawEthRec.effectiveGasPrice))
    // expect(actualFinalBalance.toString(), 'L2 final balance').to.eq(
    //   expectedFinalBalance.toString()
    // )

    // run a miner whilst withdrawing
    const miner1 = Wallet.createRandom().connect(l1Signer.provider!)
    const miner2 = Wallet.createRandom().connect(l2Signer.provider!)
    await fundL1(miner1, parseEther('1'))
    await fundL2(miner2, parseEther('1'))
    const state = { mining: true }
    await Promise.race([
      mineUntilStop(miner1, state),
      mineUntilStop(miner2, state),
      withdrawMessage.waitUntilReadyToExecute(l2Signer.provider!),
    ])
    state.mining = false

    expect(
      await withdrawMessage.status(l2Signer.provider!),
      'confirmed status'
    ).to.eq(L2ToL1MessageStatus.CONFIRMED)

    const execTx = await withdrawMessage.execute(l2Signer.provider!)
    const execRec = await execTx.wait()

    expect(
      execRec.gasUsed.toNumber(),
      'Gas used greater than estimate'
    ).to.be.lessThan(l1GasEstimate.toNumber())

    expect(
      await withdrawMessage.status(l2Signer.provider!),
      'executed status'
    ).to.eq(L2ToL1MessageStatus.EXECUTED)

    const finalRandomBalance = isL2NetworkWithCustomFeeToken()
      ? await ERC20__factory.connect(
          ethBridger.nativeToken!,
          l1Signer.provider!
        ).balanceOf(randomAddress)
      : await l1Signer.provider!.getBalance(randomAddress)
    expect(finalRandomBalance.toString(), 'L1 final balance').to.eq(
      ethToWithdraw.toString()
    )
  })
})
