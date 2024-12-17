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
import { loadEnv } from '../../../src/lib/utils/env'

import { parseEther, parseUnits } from '@ethersproject/units'

import {
  fundParentSigner as fundParentSignerEther,
  mineUntilStop,
  skipIfMainnet,
  wait,
} from '../testHelpers'

import { describeOnlyWhenCustomGasToken } from './mochaExtensions'
import { ChildToParentMessageStatus } from '../../../src'
import { ChildToParentMessage } from '../../../src/lib/message/ChildToParentMessage'
import { getNativeTokenDecimals } from '../../../src/lib/utils/lib'

loadEnv()

describeOnlyWhenCustomGasToken(
  'EthBridger (with custom fee token)',
  async () => {
    const {
      testSetup,
      fundParentCustomFeeToken,
      fundChildCustomFeeToken,
      approveParentCustomFeeToken,
    } = await import('./customFeeTokenTestHelpers')

    beforeEach('skipIfMainnet', async function () {
      await skipIfMainnet(this)
    })

    it('approves the custom fee token to be spent by the Inbox on the parent chain (arbitrary amount, using params)', async function () {
      const {
        ethBridger,
        nativeTokenContract,
        parentSigner,
        parentProvider,
        childChain,
      } = await testSetup()
      const decimals = await getNativeTokenDecimals({
        parentProvider,
        childNetwork: childChain,
      })
      const amount = ethers.utils.parseUnits('1', decimals)

      await fundParentSignerEther(parentSigner)
      await fundParentCustomFeeToken(parentSigner)

      const approvalTx = await ethBridger.approveGasToken({
        amount,
        parentSigner,
      })
      await approvalTx.wait()

      const allowance = await nativeTokenContract.allowance(
        await parentSigner.getAddress(),
        ethBridger.childNetwork.ethBridge.inbox
      )

      expect(allowance.toString()).to.equal(
        amount.toString(),
        'allowance incorrect'
      )
    })

    it('approves the custom fee token to be spent by the Inbox on the parent chain (max amount, using tx request)', async function () {
      const { ethBridger, nativeTokenContract, parentSigner } =
        await testSetup()

      await fundParentSignerEther(parentSigner)
      await fundParentCustomFeeToken(parentSigner)

      const approvalTx = await ethBridger.approveGasToken({
        txRequest: ethBridger.getApproveGasTokenRequest(),
        parentSigner,
      })
      await approvalTx.wait()

      const allowance = await nativeTokenContract.allowance(
        await parentSigner.getAddress(),
        ethBridger.childNetwork.ethBridge.inbox
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
        parentSigner,
        childSigner,
        childProvider,
      } = await testSetup()
      const bridge = ethBridger.childNetwork.ethBridge.bridge
      const amount = parseEther('2')

      await fundParentSignerEther(parentSigner)
      await fundParentCustomFeeToken(parentSigner)
      await approveParentCustomFeeToken(parentSigner)

      const initialBalanceBridge = await nativeTokenContract.balanceOf(bridge)
      const initialBalanceDepositor = await childSigner.getBalance()

      // perform the deposit
      const depositTx = await ethBridger.deposit({
        amount,
        parentSigner,
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
      const depositMessages = await depositTxReceipt.getEthDeposits(
        childProvider
      )
      expect(depositMessages.length).to.equal(
        1,
        'failed to find deposit message'
      )
      const [depositMessage] = depositMessages
      expect(depositMessage.value.toString()).to.equal(amount.toString())
      expect(depositMessage.to).to.equal(await childSigner.getAddress())

      expect(
        // balance in the depositor account after the deposit
        (await childSigner.getBalance()).toString()
      ).to.equal(
        // balance in the depositor account after the deposit should equal to the initial balance in the depositor account + the amount deposited
        initialBalanceDepositor.add(amount).toString(),
        'incorrect balance in depositor account after deposit'
      )
    })

    it('withdraws custom fee token', async () => {
      const {
        parentSigner,
        parentProvider,
        childSigner,
        childProvider,
        childChain,
        ethBridger,
        nativeTokenContract,
      } = await testSetup()
      const decimals = await getNativeTokenDecimals({
        parentProvider,
        childNetwork: childChain,
      })

      const bridge = ethBridger.childNetwork.ethBridge.bridge
      const amount = parseUnits('0.2', decimals)

      await fundParentSignerEther(parentSigner)
      await fundChildCustomFeeToken(childSigner)

      const from = await childSigner.getAddress()
      const destinationAddress = await parentSigner.getAddress()

      const initialBalanceBridge = await nativeTokenContract.balanceOf(bridge)
      const initialBalanceDestination = await nativeTokenContract.balanceOf(
        destinationAddress
      )

      const withdrawalTxRequest = await ethBridger.getWithdrawalRequest({
        amount,
        destinationAddress,
        from,
      })

      const l1GasEstimate = await withdrawalTxRequest.estimateParentGasLimit(
        parentProvider
      )

      const withdrawalTx = await ethBridger.withdraw({
        amount,
        childSigner,
        destinationAddress,
        from,
      })
      const withdrawalTxReceipt = await withdrawalTx.wait()

      expect(withdrawalTxReceipt.status).to.equal(
        1,
        'initiate withdrawal tx failed'
      )

      const messages = await withdrawalTxReceipt.getChildToParentMessages(
        parentSigner
      )
      expect(messages.length).to.equal(
        1,
        'custom fee token withdraw getWithdrawalsInL2Transaction query came back empty'
      )

      const withdrawalEvents =
        await ChildToParentMessage.getChildToParentEvents(
          childProvider,
          { fromBlock: withdrawalTxReceipt.blockNumber, toBlock: 'latest' },
          undefined,
          destinationAddress
        )

      expect(withdrawalEvents.length).to.equal(
        1,
        'custom fee token withdraw getL2ToL1EventData failed'
      )

      const [message] = messages
      const messageStatus = await message.status(childProvider)
      expect(
        messageStatus,
        `custom fee token withdraw status returned ${messageStatus}`
      ).to.be.eq(ChildToParentMessageStatus.UNCONFIRMED)

      // run a miner whilst withdrawing
      const miner1 = Wallet.createRandom().connect(parentProvider)
      const miner2 = Wallet.createRandom().connect(childProvider)
      await fundParentSignerEther(miner1, parseEther('1'))
      await fundChildCustomFeeToken(miner2)
      const state = { mining: true }
      await Promise.race([
        mineUntilStop(miner1, state),
        mineUntilStop(miner2, state),
        message.waitUntilReadyToExecute(childProvider),
      ])
      state.mining = false

      expect(await message.status(childProvider), 'confirmed status')
        //
        .to.eq(ChildToParentMessageStatus.CONFIRMED)

      const execTx = await message.execute(childProvider)
      const execTxReceipt = await execTx.wait()

      expect(
        execTxReceipt.gasUsed.toNumber(),
        'gas used greater than estimate'
      ).to.be.lessThan(l1GasEstimate.toNumber())

      expect(await message.status(childProvider), 'executed status')
        //
        .to.eq(ChildToParentMessageStatus.EXECUTED)

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
