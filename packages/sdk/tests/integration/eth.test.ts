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
import { loadEnv } from '../../src/lib/utils/env'
import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'
import { constants } from 'ethers'

import {
  fundParentSigner,
  fundChildSigner,
  mineUntilStop,
  skipIfMainnet,
} from './testHelpers'
import { ChildToParentMessage } from '../../src/lib/message/ChildToParentMessage'
import { ChildToParentMessageStatus } from '../../src/lib/dataEntities/message'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { ParentToChildMessageStatus } from '../../src/lib/message/ParentToChildMessage'
import { testSetup } from '../testSetup'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { itOnlyWhenEth } from './custom-fee-token/mochaExtensions'
import { ParentTransactionReceipt } from '../../src'
import {
  getNativeTokenDecimals,
  scaleFrom18DecimalsToNativeTokenDecimals,
} from '../../src/lib/utils/lib'
import { parseUnits } from 'ethers/lib/utils'

loadEnv()

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
    const {
      ethBridger,
      parentSigner,
      parentProvider,
      childChain,
      childSigner,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    await fundParentSigner(parentSigner)
    const inboxAddress = ethBridger.childNetwork.ethBridge.inbox

    const initialInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    const amount = '0.0002'
    const ethToDeposit = parseUnits(amount, decimals)
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      parentSigner: parentSigner,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit parent txn failed')
    const finalInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const waitResult = await rec.waitForChildTransactionReceipt(
      childSigner.provider!
    )

    const walletAddress = await parentSigner.getAddress()

    const parentToChildMessages = await rec.getEthDeposits(
      childSigner.provider!
    )
    const parentToChildMessage = parentToChildMessages[0]

    expect(parentToChildMessages.length).to.eq(
      1,
      'failed to find 1 parent-to-child message'
    )
    expect(parentToChildMessage.to).to.eq(
      walletAddress,
      'message inputs value error'
    )
    expect(
      parentToChildMessage.value.toString(),
      'message inputs value error'
    ).to.eq(parseEther(amount).toString())

    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.childTxReceipt).to.exist
    expect(waitResult.childTxReceipt).to.not.be.null

    const testWalletChildEthBalance = await childSigner.getBalance()
    expect(testWalletChildEthBalance.toString(), 'final balance').to.eq(
      parseEther(amount).toString()
    )
  })

  it('deposits ether to a specific L2 address', async function () {
    const {
      ethBridger,
      parentSigner,
      parentProvider,
      childChain,
      childSigner,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    await fundParentSigner(parentSigner)
    const inboxAddress = ethBridger.childNetwork.ethBridge.inbox
    const destWallet = Wallet.createRandom()

    const initialInboxBalance = await parentSigner.provider!.getBalance(
      inboxAddress
    )
    const amount = '0.0002'
    const ethToDeposit = parseUnits(amount, decimals)
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

    const parentToChildMessages = await rec.getParentToChildMessages(
      childSigner.provider!
    )
    expect(parentToChildMessages.length).to.eq(
      1,
      'failed to find 1 parent-to-child message'
    )
    const parentToChildMessage = parentToChildMessages[0]

    expect(parentToChildMessage.messageData.destAddress).to.eq(
      destWallet.address,
      'message inputs value error'
    )
    expect(
      parentToChildMessage.messageData.l2CallValue.toString(),
      'message inputs value error'
    ).to.eq(parseEther(amount).toString())

    const retryableTicketResult = await parentToChildMessage.waitForStatus()
    expect(retryableTicketResult.status).to.eq(
      ParentToChildMessageStatus.REDEEMED,
      'Retryable ticket not redeemed'
    )

    const retryableTxReceipt =
      await childSigner.provider!.getTransactionReceipt(
        parentToChildMessage.retryableCreationId
      )
    expect(retryableTxReceipt).to.exist
    expect(retryableTxReceipt).to.not.be.null

    const childRetryableTxReceipt = new ChildTransactionReceipt(
      retryableTxReceipt
    )
    const ticketRedeemEvents =
      childRetryableTxReceipt.getRedeemScheduledEvents()
    expect(ticketRedeemEvents.length).to.eq(
      1,
      'failed finding the redeem event'
    )
    expect(ticketRedeemEvents[0].retryTxHash).to.exist
    expect(ticketRedeemEvents[0].retryTxHash).to.not.be.null

    const testWalletChildEthBalance = await childSigner.provider!.getBalance(
      destWallet.address
    )
    expect(testWalletChildEthBalance.toString(), 'final balance').to.eq(
      parseEther(amount).toString()
    )
  })

  it('deposit ether to a specific L2 address with manual redeem', async function () {
    const {
      ethBridger,
      parentSigner,
      parentProvider,
      childChain,
      childSigner,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    await fundParentSigner(parentSigner)
    const destWallet = Wallet.createRandom()

    const amount = '0.0002'
    const ethToDeposit = parseUnits(amount, decimals)
    const res = await ethBridger.depositTo({
      amount: ethToDeposit,
      parentSigner: parentSigner,
      destinationAddress: destWallet.address,
      childProvider: childSigner.provider!,
      retryableGasOverrides: {
        gasLimit: {
          // causes auto-redeem to fail which allows us to check balances before it happens
          base: constants.Zero,
        },
      },
    })
    const rec = await res.wait()
    const parentToChildMessages = await rec.getParentToChildMessages(
      childSigner.provider!
    )
    expect(parentToChildMessages.length).to.eq(
      1,
      'failed to find 1 parent-to-child message'
    )
    const parentToChildMessageReader = parentToChildMessages[0]

    const retryableTicketResult =
      await parentToChildMessageReader.waitForStatus()

    expect(retryableTicketResult.status).to.eq(
      ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      'unexpected status, expected auto-redeem to fail'
    )

    let testWalletChildEthBalance = await childSigner.provider!.getBalance(
      destWallet.address
    )

    expect(
      testWalletChildEthBalance.eq(constants.Zero),
      'balance before auto-redeem'
    ).to.be.true

    await fundChildSigner(childSigner)

    const parentTxHash = await parentSigner.provider!.getTransactionReceipt(
      res.hash
    )
    const parentTxReceipt = new ParentTransactionReceipt(parentTxHash)

    const parentToChildMessageWriter = (
      await parentTxReceipt.getParentToChildMessages(childSigner)
    )[0]

    await (await parentToChildMessageWriter.redeem()).wait()

    testWalletChildEthBalance = await childSigner.provider!.getBalance(
      destWallet.address
    )

    expect(
      testWalletChildEthBalance.toString(),
      'balance after manual redeem'
    ).to.eq(parseEther(amount).toString())
  })

  it('withdraw Ether transaction succeeds', async () => {
    const {
      childSigner,
      childChain,
      parentSigner,
      parentProvider,
      ethBridger,
    } = await testSetup()
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
    ).to.be.eq(ChildToParentMessageStatus.UNCONFIRMED)

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
    ).to.eq(ChildToParentMessageStatus.CONFIRMED)

    const execTx = await withdrawMessage.execute(childSigner.provider!)
    const execRec = await execTx.wait()

    expect(
      execRec.gasUsed.toNumber(),
      'Gas used greater than estimate'
    ).to.be.lessThan(l1GasEstimate.toNumber())

    expect(
      await withdrawMessage.status(childSigner.provider!),
      'executed status'
    ).to.eq(ChildToParentMessageStatus.EXECUTED)

    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    const finalRandomBalance = isArbitrumNetworkWithCustomFeeToken()
      ? await ERC20__factory.connect(
          ethBridger.nativeToken!,
          parentSigner.provider!
        ).balanceOf(randomAddress)
      : await parentSigner.provider!.getBalance(randomAddress)
    expect(finalRandomBalance.toString(), 'L1 final balance').to.eq(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: ethToWithdraw,
        decimals,
      }).toString()
    )
  })
})
