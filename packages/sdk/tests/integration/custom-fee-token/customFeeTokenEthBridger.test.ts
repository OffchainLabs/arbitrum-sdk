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

import { it, expect, beforeEach } from 'vitest'
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

      expect(allowance.toString(), 'allowance incorrect').toBe(
        amount.toString()
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

      expect(allowance.toString(), 'allowance incorrect').toBe(
        constants.MaxUint256.toString()
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
      expect(depositTxReceipt.status, 'deposit tx failed').toBe(1)

      expect(
        // balance in the bridge after the deposit
        (await nativeTokenContract.balanceOf(bridge)).toString(),
        'incorrect balance in bridge after deposit'
      ).toBe(
        // balance in the bridge after the deposit should equal to the initial balance in the bridge + the amount deposited
        initialBalanceBridge.add(amount).toString()
      )

      // wait for minting on L2
      await wait(30 * 1000)

      // check for cross-chain messages
      const depositMessages = await depositTxReceipt.getEthDeposits(
        childProvider
      )
      expect(depositMessages.length, 'failed to find deposit message').toBe(
        1
      )
      const [depositMessage] = depositMessages
      expect(depositMessage.value.toString()).toBe(amount.toString())
      expect(depositMessage.to).toBe(await childSigner.getAddress())

      expect(
        // balance in the depositor account after the deposit
        (await childSigner.getBalance()).toString(),
        'incorrect balance in depositor account after deposit'
      ).toBe(
        // balance in the depositor account after the deposit should equal to the initial balance in the depositor account + the amount deposited
        initialBalanceDepositor.add(amount).toString()
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

      expect(withdrawalTxReceipt.status, 'initiate withdrawal tx failed').toBe(
        1
      )

      const messages = await withdrawalTxReceipt.getChildToParentMessages(
        parentSigner
      )
      expect(
        messages.length,
        'custom fee token withdraw getWithdrawalsInL2Transaction query came back empty'
      ).toBe(1)

      const withdrawalEvents =
        await ChildToParentMessage.getChildToParentEvents(
          childProvider,
          { fromBlock: withdrawalTxReceipt.blockNumber, toBlock: 'latest' },
          undefined,
          destinationAddress
        )

      expect(
        withdrawalEvents.length,
        'custom fee token withdraw getL2ToL1EventData failed'
      ).toBe(1)

      const [message] = messages
      const messageStatus = await message.status(childProvider)
      expect(
        messageStatus,
        `custom fee token withdraw status returned ${messageStatus}`
      ).toBe(ChildToParentMessageStatus.UNCONFIRMED)

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
        .toBe(ChildToParentMessageStatus.CONFIRMED)

      const execTx = await message.execute(childProvider)
      const execTxReceipt = await execTx.wait()

      expect(
        execTxReceipt.gasUsed.toNumber(),
        'gas used greater than estimate'
      ).toBeLessThan(l1GasEstimate.toNumber())

      expect(await message.status(childProvider), 'executed status')
        //
        .toBe(ChildToParentMessageStatus.EXECUTED)

      expect(
        // balance in the bridge after the withdrawal
        (await nativeTokenContract.balanceOf(bridge)).toString(),
        'incorrect balance in bridge after withdrawal'
      ).toBe(
        // balance in the bridge after the withdrawal should equal to the initial balance in the bridge - the amount withdrawn
        initialBalanceBridge.sub(amount).toString()
      )

      expect(
        // balance in the destination after the withdrawal
        (await nativeTokenContract.balanceOf(destinationAddress)).toString(),
        'incorrect balance in destination after withdrawal'
      ).toBe(
        // balance in the destination after the withdrawal should equal to the initial balance in the destination + the amount withdrawn
        initialBalanceDestination.add(amount).toString()
      )
    })
  }
)
