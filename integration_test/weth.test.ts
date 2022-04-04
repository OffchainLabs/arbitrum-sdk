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

import { parseEther } from '@ethersproject/units'

import { AeWETH__factory } from '../src/lib/abi/factories/AeWETH__factory'

import {
  fundL1,
  fundL2,
  skipIfMainnet,
  prettyLog,
} from './testHelpers'
import { L2ToL1MessageStatus } from '../src/lib/message/L2ToL1Message'
import { Erc20Bridger, L1ToL2MessageStatus } from '../src'
import { Wallet } from 'ethers'
import { testSetup } from '../scripts/testSetup'

describe('WETH', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('withdraws WETH', async () => {
    const wethToWrap = parseEther('0.00001')
    const wethToWithdraw = parseEther('0.00000001')

    const {
      l2Network,
      l1Signer,
      l2Signer,
      erc20Bridger,
    } = await testSetup()
    await fundL2(l2Signer)

    const l2Weth = AeWETH__factory.connect(
      l2Network.tokenBridge.l2Weth,
      l2Signer
    )
    const res = await l2Weth.deposit({
      value: wethToWrap,
    })
    const rec = await res.wait()
    expect(rec.status).to.equal(1, 'deposit txn failed')

    const withdrawRes = await erc20Bridger.withdraw({
      amount: wethToWithdraw,
      erc20l1Address: l2Network.tokenBridge.l1Weth,
      l2Signer: l2Signer,
    })
    const withdrawRec = await withdrawRes.wait()
    expect(withdrawRec.status).to.equal(1, 'withdraw txn failed')

    const outgoingMessages = await withdrawRec.getL2ToL1Messages(
      l1Signer.provider!,
      l2Signer.provider!
    )
    const firstMessage = outgoingMessages[0]
    expect(firstMessage, 'getWithdrawalsInL2Transaction came back empty').to
      .exist

    const messageStatus = await firstMessage.status()
    expect(
      messageStatus === L2ToL1MessageStatus.UNCONFIRMED,
      `weth withdraw status returned ${messageStatus}`
    )

    const l2Token = await erc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      l2Network.tokenBridge.l2Weth
    )
    const l2WethBalance = (
      await l2Token.functions.balanceOf(await l2Signer.getAddress())
    )[0]

    expect(
      l2WethBalance.add(wethToWithdraw).eq(wethToWrap),
      'balance not properly updated after weth withdraw'
    ).to.be.true

    const walletAddress = await l1Signer.getAddress()
    const gatewayWithdrawEvents = await erc20Bridger.getL2WithdrawalEvents(
      l2Signer.provider!,
      l2Network.tokenBridge.l2WethGateway,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      undefined,
      walletAddress
    )
    expect(gatewayWithdrawEvents.length).to.equal(
      1,
      'weth token gateway query failed'
    )

    const gatewayAddress = await erc20Bridger.getL2GatewayAddress(
      l2Network.tokenBridge.l1Weth,
      l2Signer.provider!
    )
    const tokenWithdrawEvents = await erc20Bridger.getL2WithdrawalEvents(
      l2Signer.provider!,
      gatewayAddress,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      l2Network.tokenBridge.l1Weth,
      walletAddress
    )
    expect(tokenWithdrawEvents.length).to.equal(
      1,
      'token filtered query failed'
    )
  })

  it('deposits WETH', async () => {
    const {
      l2Network,
      l1Signer,
      l2Signer,
      erc20Bridger,
    } = await testSetup()

    const l1WethAddress = l2Network.tokenBridge.l1Weth

    const wethToWrap = parseEther('0.00001')
    const wethToDeposit = parseEther('0.0000001')

    await fundL1(l1Signer)

    const l1WETH = AeWETH__factory.connect(
      l2Network.tokenBridge.l1Weth,
      l1Signer
    )
    const res = await l1WETH.deposit({
      value: wethToWrap,
    })
    await res.wait()
    prettyLog('wrapped some ether')

    const approveRes = await erc20Bridger.approveToken({
      erc20L1Address: l1WethAddress,
      l1Signer: l1Signer,
    })
    const approveRec = await approveRes.wait()
    expect(approveRec.status).to.equal(1, 'allowance txn failed')

    const l1Token = erc20Bridger.getL1TokenContract(
      l1Signer.provider!,
      l1WethAddress
    )

    const allowance = await l1Token.allowance(
      await l1Signer.getAddress(),
      l2Network.tokenBridge.l1WethGateway
    )

    expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'failed to set allowance')
      .to.be.true

    const depositRes = await erc20Bridger.deposit({
      amount: wethToDeposit,
      erc20L1Address: l1WethAddress,
      l1Signer: l1Signer,
      l2Provider: l2Signer.provider!,
    })
    const depositRec = await depositRes.wait()
    const waitRes = await depositRec.waitForL2(l2Signer)
    expect(waitRes.status, 'Unexpected status').to.eq(
      L1ToL2MessageStatus.REDEEMED
    )

    const l2WethGateway = await erc20Bridger.getL2GatewayAddress(
      l1WethAddress,
      l2Signer.provider!
    )
    expect(l2WethGateway, 'l2 weth gateway').to.eq(
      l2Network.tokenBridge.l2WethGateway
    )

    const l2Token = erc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      l2Network.tokenBridge.l2Weth
    )

    expect(l2Token.address, 'l2 weth').to.eq(l2Network.tokenBridge.l2Weth)

    const testWalletL2Balance = await l2Token.balanceOf(
      await l2Signer.getAddress()
    )

    expect(
      testWalletL2Balance.eq(wethToDeposit),
      'ether balance not updated after deposit'
    ).to.be.true 
    
    await fundL2(l2Signer)
    const l2Weth = AeWETH__factory.connect(l2Token.address, l2Signer)
    const randomAddr = Wallet.createRandom().address
    await (
      await l2Weth
        .connect(l2Signer)
        .withdrawTo(randomAddr, testWalletL2Balance)
    ).wait()
    const afterBalance = await l2Signer.provider!.getBalance(randomAddr)
    
    expect(afterBalance.toString(), 'balance after').to.eq(
      wethToDeposit.toString()
    )
  })
})
