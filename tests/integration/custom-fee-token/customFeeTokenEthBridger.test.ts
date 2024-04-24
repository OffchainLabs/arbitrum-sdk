/*
 * Copyright 2023, Offchain Labs, Inc.
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
import { ethers, constants, Wallet } from 'ethers'
import dotenv from 'dotenv'

import { parseEther } from '@ethersproject/units'

import {
  fundL1 as fundL1Ether,
  mineUntilStop,
  skipIfMainnet,
  wait,
} from '../testHelpers'
import { L2ToL1Message, L2ToL1MessageStatus } from '../../../src'
import { describeOnlyWhenCustomGasToken } from './mochaExtensions'

dotenv.config()

describeOnlyWhenCustomGasToken(
  'EthBridger (with custom fee token)',
  async () => {
    const {
      testSetup,
      fundL1CustomFeeToken,
      fundL2CustomFeeToken,
      approveL1CustomFeeToken,
    } = await import('./customFeeTokenTestHelpers')

    beforeEach('skipIfMainnet', async function () {
      await skipIfMainnet(this)
    })

    it('approves the custom fee token to be spent by the Inbox on the parent chain (arbitrary amount, using params)', async function () {
      const { ethBridger, nativeTokenContract, l1Signer } = await testSetup()
      const amount = ethers.utils.parseEther('1')

      await fundL1Ether(l1Signer)
      await fundL1CustomFeeToken(l1Signer)

      const approvalTx = await ethBridger.approveGasToken({
        amount,
        l1Signer,
      })
      await approvalTx.wait()

      const allowance = await nativeTokenContract.allowance(
        await l1Signer.getAddress(),
        ethBridger.l2Network.ethBridge.inbox
      )

      expect(allowance.toString()).to.equal(
        amount.toString(),
        'allowance incorrect'
      )
    })

    it('approves the custom fee token to be spent by the Inbox on the parent chain (max amount, using tx request)', async function () {
      const { ethBridger, nativeTokenContract, l1Signer } = await testSetup()

      await fundL1Ether(l1Signer)
      await fundL1CustomFeeToken(l1Signer)

      const approvalTx = await ethBridger.approveGasToken({
        txRequest: ethBridger.getApproveGasTokenRequest(),
        l1Signer,
      })
      await approvalTx.wait()

      const allowance = await nativeTokenContract.allowance(
        await l1Signer.getAddress(),
        ethBridger.l2Network.ethBridge.inbox
      )

      expect(allowance.toString()).to.equal(
        constants.MaxUint256.toString(),
        'allowance incorrect'
      )
    })

    it('deposits custom fee token (using params)', async function () {
      const {
        ethBridger,
        nativeTokenContract,
        l1Signer,
        l2Signer,
        l2Provider,
      } = await testSetup()
      const bridge = ethBridger.l2Network.ethBridge.bridge
      const amount = parseEther('2')

      await fundL1Ether(l1Signer)
      await fundL1CustomFeeToken(l1Signer)
      await approveL1CustomFeeToken(l1Signer)

      const initialBalanceBridge = await nativeTokenContract.balanceOf(bridge)
      const initialBalanceDepositor = await l2Signer.getBalance()

      // perform the deposit
      const depositTx = await ethBridger.deposit({
        amount,
        l1Signer,
      })
      const depositTxReceipt = await depositTx.wait()
      expect(depositTxReceipt.status).to.equal(1, 'deposit tx failed')

      expect(
        // balance in the bridge after the deposit
        (await nativeTokenContract.balanceOf(bridge)).toString()
      ).to.equal(
        // balance in the bridge after the deposit should equal to the initial balance in the bridge + the amount deposited
        initialBalanceBridge.add(amount).toString(),
        'incorrect balance in bridge after deposit'
      )

      // wait for minting on L2
      await wait(30 * 1000)

      // check for cross-chain messages
      const depositMessages = await depositTxReceipt.getEthDeposits(l2Provider)
      expect(depositMessages.length).to.equal(
        1,
        'failed to find deposit message'
      )
      const [depositMessage] = depositMessages
      expect(depositMessage.value.toString()).to.equal(amount.toString())
      expect(depositMessage.to).to.equal(await l2Signer.getAddress())

      expect(
        // balance in the depositor account after the deposit
        (await l2Signer.getBalance()).toString()
      ).to.equal(
        // balance in the depositor account after the deposit should equal to the initial balance in th depositor account + the amount deposited
        initialBalanceDepositor.add(amount).toString(),
        'incorrect balance in depositor account after deposit'
      )
    })

    it('withdraws custom fee token', async () => {
      const {
        l1Signer,
        l1Provider,
        l2Signer,
        l2Provider,
        ethBridger,
        nativeTokenContract,
      } = await testSetup()
      const bridge = ethBridger.l2Network.ethBridge.bridge
      const amount = parseEther('0.2')

      await fundL1Ether(l1Signer)
      await fundL2CustomFeeToken(l2Signer)

      const from = await l2Signer.getAddress()
      const destinationAddress = await l1Signer.getAddress()

      const initialBalanceBridge = await nativeTokenContract.balanceOf(bridge)
      const initialBalanceDestination = await nativeTokenContract.balanceOf(
        destinationAddress
      )

      const withdrawalTxRequest = await ethBridger.getWithdrawalRequest({
        amount,
        destinationAddress,
        from,
      })

      const l1GasEstimate = await withdrawalTxRequest.estimateL1GasLimit(
        l1Provider
      )

      const withdrawalTx = await ethBridger.withdraw({
        amount,
        l2Signer: l2Signer,
        destinationAddress,
        from,
      })
      const withdrawalTxReceipt = await withdrawalTx.wait()

      expect(withdrawalTxReceipt.status).to.equal(
        1,
        'initiate withdrawal tx failed'
      )

      const messages = await withdrawalTxReceipt.getL2ToL1Messages(l1Signer)
      expect(messages.length).to.equal(
        1,
        'custom fee token withdraw getWithdrawalsInL2Transaction query came back empty'
      )

      const withdrawalEvents = await L2ToL1Message.getL2ToL1Events(
        l2Provider,
        { fromBlock: withdrawalTxReceipt.blockNumber, toBlock: 'latest' },
        undefined,
        destinationAddress
      )

      expect(withdrawalEvents.length).to.equal(
        1,
        'custom fee token withdraw getL2ToL1EventData failed'
      )

      const [message] = messages
      const messageStatus = await message.status(l2Provider)
      expect(
        messageStatus,
        `custom fee token withdraw status returned ${messageStatus}`
      ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

      // run a miner whilst withdrawing
      const miner1 = Wallet.createRandom().connect(l1Provider)
      const miner2 = Wallet.createRandom().connect(l2Provider)
      await fundL1Ether(miner1, parseEther('1'))
      await fundL2CustomFeeToken(miner2)
      const state = { mining: true }
      await Promise.race([
        mineUntilStop(miner1, state),
        mineUntilStop(miner2, state),
        message.waitUntilReadyToExecute(l2Provider),
      ])
      state.mining = false

      expect(await message.status(l2Provider), 'confirmed status')
        //
        .to.eq(L2ToL1MessageStatus.CONFIRMED)

      const execTx = await message.execute(l2Provider)
      const execTxReceipt = await execTx.wait()

      expect(
        execTxReceipt.gasUsed.toNumber(),
        'gas used greater than estimate'
      ).to.be.lessThan(l1GasEstimate.toNumber())

      expect(await message.status(l2Provider), 'executed status')
        //
        .to.eq(L2ToL1MessageStatus.EXECUTED)

      expect(
        // balance in the bridge after the withdrawal
        (await nativeTokenContract.balanceOf(bridge)).toString()
      ).to.equal(
        // balance in the bridge after the withdrawal should equal to the initial balance in the bridge - the amount withdrawn
        initialBalanceBridge.sub(amount).toString(),
        'incorrect balance in bridge after withdrawal'
      )

      expect(
        // balance in the destination after the withdrawal
        (await nativeTokenContract.balanceOf(destinationAddress)).toString()
      ).to.equal(
        // balance in the destination after the withdrawal should equal to the initial balance in the destination + the amount withdrawn
        initialBalanceDestination.add(amount).toString(),
        'incorrect balance in destination after withdrawal'
      )
    })
  }
)
