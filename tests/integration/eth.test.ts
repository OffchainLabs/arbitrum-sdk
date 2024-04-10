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
  fundParentSigner,
  fundChildSigner,
  mineUntilStop,
  prettyLog,
  skipIfMainnet,
} from './testHelpers'
import { ChildToParentMessage } from '../../src/lib/message/L2ToL1Message'
import { ChildToParentMessageStatus as L2ToL1MessageStatus } from '../../src/lib/dataEntities/message'
import { L2TransactionReceipt } from '../../src/lib/message/L2Transaction'
import { ParentToChildMessageStatus } from '../../src/lib/message/L1ToL2Message'
import { testSetup } from '../../scripts/testSetup'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { itOnlyWhenEth } from './custom-fee-token/mochaExtensions'

dotenv.config()

describe('Ether', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('transfers ether on l2', async () => {
    const { childSigner } = await testSetup()

    await fundChildSigner(childSigner)
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    const balanceBefore = await childSigner.provider!.getBalance(
      await childSigner.getAddress()
    )

    const rec = await (
      await childSigner.sendTransaction({
        to: randomAddress,
        value: amountToSend,
        maxFeePerGas: 15000000000,
        maxPriorityFeePerGas: 0,
      })
    ).wait()

    const balanceAfter = await childSigner.provider!.getBalance(
      await childSigner.getAddress()
    )
    const randomBalanceAfter = await childSigner.provider!.getBalance(
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
      const { ethBridger, parentSigner } = await testSetup()

      try {
        await ethBridger.approveGasToken({ parentSigner })
        expect.fail(`"EthBridger.approveGasToken" should have thrown`)
      } catch (error: any) {
        expect(error.message).to.equal('chain uses ETH as its native/gas token')
      }
    }
  )

  it('deposits ether', async () => {
    const { ethBridger, parentSigner, childSigner } = await testSetup()

    await fundParentSigner(parentSigner)
    const inboxAddress = ethBridger.childChain.ethBridge.inbox

    const initialInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      parentSigner: parentSigner,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const waitResult = await rec.waitForChildTx(childSigner.provider!)

    const l1ToL2Messages = await rec.getEthDeposits(childSigner.provider!)
    expect(l1ToL2Messages.length).to.eq(1, 'failed to find 1 l1 to l2 message')
    const l1ToL2Message = l1ToL2Messages[0]

    const walletAddress = await parentSigner.getAddress()
    expect(l1ToL2Message.to).to.eq(walletAddress, 'message inputs value error')
    expect(l1ToL2Message.value.toString(), 'message inputs value error').to.eq(
      ethToDeposit.toString()
    )

    prettyLog('chainTxHash: ' + waitResult.message.chainDepositTxHash)
    prettyLog('chain transaction found!')
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.chainTxReceipt).to.exist
    expect(waitResult.chainTxReceipt).to.not.be.null

    const testWalletL2EthBalance = await childSigner.getBalance()
    expect(testWalletL2EthBalance.toString(), 'final balance').to.eq(
      ethToDeposit.toString()
    )
  })

  it('deposits ether to a specific L2 address', async () => {
    const { ethBridger, parentSigner, childSigner } = await testSetup()

    await fundParentSigner(parentSigner)
    const inboxAddress = ethBridger.childChain.ethBridge.inbox
    const destWallet = Wallet.createRandom()

    const initialInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.depositTo({
      amount: ethToDeposit,
      parentSigner: parentSigner,
      destinationAddress: destWallet.address,
      childProvider: childSigner.provider!,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const l1ToL2Messages = await rec.getParentToChildMessages(
      childSigner.provider!
    )
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
      ParentToChildMessageStatus.REDEEMED,
      'Retryable ticket not redeemed'
    )

    const retryableTxReceipt =
      await childSigner.provider!.getTransactionReceipt(
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

    const testWalletL2EthBalance = await childSigner.provider!.getBalance(
      destWallet.address
    )
    expect(testWalletL2EthBalance.toString(), 'final balance').to.eq(
      ethToDeposit.toString()
    )
  })

  it('withdraw Ether transaction succeeds', async () => {
    const { childSigner, parentSigner, ethBridger } = await testSetup()
    await fundChildSigner(childSigner)
    await fundParentSigner(parentSigner)

    const ethToWithdraw = parseEther('0.00000002')
    const randomAddress = Wallet.createRandom().address

    const request = await ethBridger.getWithdrawalRequest({
      amount: ethToWithdraw,
      destinationAddress: randomAddress,
      from: await childSigner.getAddress(),
    })

    const l1GasEstimate = await request.estimateParentGasLimit(
      parentSigner.provider!
    )

    const withdrawEthRes = await ethBridger.withdraw({
      amount: ethToWithdraw,
      childSigner: childSigner,
      destinationAddress: randomAddress,
      from: await childSigner.getAddress(),
    })

    const withdrawEthRec = await withdrawEthRes.wait()

    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    const withdrawMessage = (
      await withdrawEthRec.getChildToParentMessages(parentSigner)
    )[0]
    expect(
      withdrawMessage,
      'eth withdraw getWithdrawalsInL2Transaction query came back empty'
    ).to.exist

    const withdrawEvents = await ChildToParentMessage.getChildToParentEvents(
      childSigner.provider!,
      { fromBlock: withdrawEthRec.blockNumber, toBlock: 'latest' },
      undefined,
      randomAddress
    )

    expect(withdrawEvents.length).to.equal(
      1,
      'eth withdraw getL2ToL1EventData failed'
    )

    const messageStatus = await withdrawMessage.status(childSigner.provider!)
    expect(
      messageStatus,
      `eth withdraw status returned ${messageStatus}`
    ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

    // CHRIS: TODO: comment this back in when fixed in nitro
    // const actualFinalBalance = await childSigner.getBalance()
    // const expectedFinalBalance = initialBalance
    //   .sub(ethToWithdraw)
    //   .sub(withdrawEthRec.gasUsed.mul(withdrawEthRec.effectiveGasPrice))
    // expect(actualFinalBalance.toString(), 'L2 final balance').to.eq(
    //   expectedFinalBalance.toString()
    // )

    // run a miner whilst withdrawing
    const miner1 = Wallet.createRandom().connect(parentSigner.provider!)
    const miner2 = Wallet.createRandom().connect(childSigner.provider!)
    await fundParentSigner(miner1, parseEther('1'))
    await fundChildSigner(miner2, parseEther('1'))
    const state = { mining: true }
    await Promise.race([
      mineUntilStop(miner1, state),
      mineUntilStop(miner2, state),
      withdrawMessage.waitUntilReadyToExecute(childSigner.provider!),
    ])
    state.mining = false

    expect(
      await withdrawMessage.status(childSigner.provider!),
      'confirmed status'
    ).to.eq(L2ToL1MessageStatus.CONFIRMED)

    const execTx = await withdrawMessage.execute(childSigner.provider!)
    const execRec = await execTx.wait()

    expect(
      execRec.gasUsed.toNumber(),
      'Gas used greater than estimate'
    ).to.be.lessThan(l1GasEstimate.toNumber())

    expect(
      await withdrawMessage.status(childSigner.provider!),
      'executed status'
    ).to.eq(L2ToL1MessageStatus.EXECUTED)

    const finalRandomBalance = isArbitrumNetworkWithCustomFeeToken()
      ? await ERC20__factory.connect(
          ethBridger.nativeToken!,
          parentSigner.provider!
        ).balanceOf(randomAddress)
      : await parentSigner.provider!.getBalance(randomAddress)
    expect(finalRandomBalance.toString(), 'L1 final balance').to.eq(
      ethToWithdraw.toString()
    )
  })
})
