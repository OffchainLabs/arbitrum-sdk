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
import { ethers, providers, constants } from 'ethers'
import dotenv from 'dotenv'

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'

import { skipIfMainnet, wait } from './testHelpers'

import { testSetup } from '../../scripts/testSetup'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { ERC20 } from '../../src/lib/abi/ERC20'

dotenv.config()

const l1Provider = new providers.StaticJsonRpcProvider(process.env.ETH_URL)
const l2Provider = new providers.StaticJsonRpcProvider(process.env.ARB_URL)

// create a fresh random wallet for a clean slate
const wallet = Wallet.createRandom()
const l1Signer = wallet.connect(l1Provider)
const l2Signer = wallet.connect(l2Provider)

const l1DeployerWallet = new ethers.Wallet(
  ethers.utils.sha256(ethers.utils.toUtf8Bytes('user_l1user')),
  l1Provider
)

let nativeToken: ERC20

async function fundL1(account: string) {
  const { ethBridger } = await testSetup(true)

  const nativeTokenAddress = ethBridger.l2Network.nativeToken!
  nativeToken = ERC20__factory.connect(nativeTokenAddress, l1Provider)

  const fundEthTx = await l1DeployerWallet.sendTransaction({
    to: account,
    value: parseEther('10'),
  })
  await fundEthTx.wait()

  const fundTokenTx = await nativeToken
    .connect(l1DeployerWallet)
    .transfer(account, parseEther('10'))
  await fundTokenTx.wait()
}

describe('NativeErc20Bridger', async () => {
  before(async function () {
    await fundL1(await l1Signer.getAddress())
  })

  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('approves the erc-20 token on the parent chain for an arbitrary amount', async function () {
    // using a random wallet for non-max amount approval
    // the rest of the test suite will use the account with the max approval
    const randomL1Signer = Wallet.createRandom().connect(l1Provider)
    await fundL1(await randomL1Signer.getAddress())

    const { ethBridger } = await testSetup(true)

    const inbox = ethBridger.l2Network.ethBridge.inbox
    const amount = ethers.utils.parseEther('1')

    const approvalTx = await ethBridger.approve({
      amount,
      l1Signer: randomL1Signer,
    })
    await approvalTx.wait()

    const allowance = await nativeToken.allowance(
      await randomL1Signer.getAddress(),
      inbox
    )

    expect(allowance.toString()).to.equal(
      amount.toString(),
      'allowance incorrect'
    )
  })

  it('approves the erc-20 token on the parent chain for the max amount', async function () {
    const { ethBridger } = await testSetup(true)

    const inbox = ethBridger.l2Network.ethBridge.inbox

    const approvalTx = await ethBridger.approve({ l1Signer })
    await approvalTx.wait()

    const allowance = await nativeToken.allowance(
      await l1Signer.getAddress(),
      inbox
    )

    expect(allowance.toString()).to.equal(
      constants.MaxUint256.toString(),
      'allowance incorrect'
    )
  })

  it('deposits erc-20 token via params', async function () {
    const { ethBridger } = await testSetup(true)
    const bridge = ethBridger.l2Network.ethBridge.bridge

    const amount = parseEther('2')

    const initialBalanceBridge = await nativeToken.balanceOf(bridge)
    const initialBalanceDepositor = await l2Signer.getBalance()

    // perform the deposit
    const depositTx = await ethBridger.deposit({
      amount,
      l1Signer,
    })
    await depositTx.wait()

    expect(
      // balance in the bridge after the deposit
      (await nativeToken.balanceOf(bridge)).toString()
    ).to.equal(
      // balance in the bridge after the deposit should equal to the initial balance in the bridge + the amount deposited
      initialBalanceBridge.add(amount).toString(),
      'incorrect balance in bridge after deposit'
    )

    // wait for minting on L2
    await wait(30 * 1000)

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
