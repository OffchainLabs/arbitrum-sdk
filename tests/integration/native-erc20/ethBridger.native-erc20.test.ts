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
import { ethers, constants } from 'ethers'
import dotenv from 'dotenv'

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'

import {
  testSetup as _testSetup,
  fundL1WithCustomFeeToken,
} from './testHelpers.native-erc20'
import {
  fundL1 as fundL1WithEth,
  prettyLog,
  skipIfMainnet,
  wait,
} from '../testHelpers'

dotenv.config()

// random wallet for the test
const wallet = Wallet.createRandom()

async function testSetup() {
  const result = await _testSetup()

  const l1Signer = wallet.connect(result.l1Provider)
  const l2Signer = wallet.connect(result.l2Provider)

  return { ...result, l1Signer, l2Signer }
}

describe('EthBridger (with erc-20 as native token)', async () => {
  before(async function () {
    const { l1Signer } = await testSetup()
    const address = await l1Signer.getAddress()
    prettyLog(`testing with account: ${address}`)
    await fundL1WithEth(l1Signer)
    await fundL1WithCustomFeeToken(l1Signer)
  })

  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('approves the erc-20 token on the parent chain for an arbitrary amount', async function () {
    const { ethBridger, nativeTokenContract, l1Provider } = await testSetup()

    // using a random wallet for non-max amount approval
    // the rest of the test suite will use the account with the max approval
    const randomL1Signer = Wallet.createRandom().connect(l1Provider)
    await fundL1WithEth(randomL1Signer)
    await fundL1WithCustomFeeToken(randomL1Signer)

    const inbox = ethBridger.l2Network.ethBridge.inbox
    const amount = ethers.utils.parseEther('1')

    const approvalTx = await ethBridger.approve({
      amount,
      l1Signer: randomL1Signer,
    })
    await approvalTx.wait()

    const allowance = await nativeTokenContract.allowance(
      await randomL1Signer.getAddress(),
      inbox
    )

    expect(allowance.toString()).to.equal(
      amount.toString(),
      'allowance incorrect'
    )
  })

  it('approves the erc-20 token on the parent chain for the max amount', async function () {
    const { ethBridger, nativeTokenContract, l1Signer } = await testSetup()
    const inbox = ethBridger.l2Network.ethBridge.inbox

    const approvalTx = await ethBridger.approve({ l1Signer })
    await approvalTx.wait()

    const allowance = await nativeTokenContract.allowance(
      await l1Signer.getAddress(),
      inbox
    )

    expect(allowance.toString()).to.equal(
      constants.MaxUint256.toString(),
      'allowance incorrect'
    )
  })

  it('deposits erc-20 token via params', async function () {
    const result = await testSetup()
    const { ethBridger, nativeTokenContract, l1Signer, l2Signer, l2Provider } =
      result
    const bridge = ethBridger.l2Network.ethBridge.bridge

    const amount = parseEther('2')

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
    expect(depositMessages.length).to.equal(1, 'failed to find deposit message')
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
})
