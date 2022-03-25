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

import { BigNumber } from '@ethersproject/bignumber'
import { TestERC20__factory } from '../src/lib/abi/factories/TestERC20__factory'

import { L2ToL1MessageStatus } from '../src/lib/message/L2ToL1Message'

import {
  fundL1,
  fundL2,
  testRetryableTicket,
  instantiateBridgeWithRandomWallet,
  skipIfMainnet,
} from './testHelpers'
import { Erc20Bridger, L1ToL2MessageReader, L1ToL2MessageStatus } from '../src'
import { ethers, Signer, Wallet } from 'ethers'
import { GasOverrides } from '../src/lib/message/L1ToL2MessageGasEstimator'
import { wait } from '../src/lib/utils/lib'
import { JsonRpcProvider } from '@ethersproject/providers'
const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('standard ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // CHRIS: TODO: why skip these?
  it.skip('deposits erc20 (no L2 Eth funding)', async () => {
    // CHRIS: TODO: another ticket, but refactor these tests

    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await depositTokenTest(erc20Bridger, l1Signer, l2Signer)
  })

  it('deposits erc20 (with L2 Eth funding)', async () => {
    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await fundL2(l2Signer)
    await depositTokenTest(erc20Bridger, l1Signer, l2Signer)
  })

  it('deposit with no funds, manual redeem', async () => {
    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
      l2Network,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const { waitRes } = await depositTokenTest(
      erc20Bridger,
      l1Signer,
      l2Signer,
      {
        maxGas: {
          base: BigNumber.from(0),
        },
        maxGasPrice: {
          base: BigNumber.from(0),
        },
      }
    )

    // we expect the status to be funds deposited
    expect(waitRes.status, 'Funds not deposited').to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
    )

    // do a manual redeem
    const manualRedeem = await waitRes.message.redeem()
    const rec = await manualRedeem.wait()
    const retryRec = await L1ToL2MessageReader.getRedeemReceipt(
      rec,
      l2Signer.provider!
    )
    expect(retryRec).to.not.be.null
    expect(retryRec!.blockHash, 'redeemed in same block').to.eq(rec.blockHash)
    expect(retryRec!.to!, 'redeemed in same block').to.eq(
      l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec!.status!, 'tx didnt succeed').to.eq(1)
  })

  it('deposit with low funds, manual redeem', async () => {
    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
      l2Network,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const { testToken, waitRes } = await depositTokenTest(
      erc20Bridger,
      l1Signer,
      l2Signer,
      {
        maxGas: {
          base: BigNumber.from(5),
        },
        maxGasPrice: {
          base: BigNumber.from(5),
        },
      }
    )

    // we expect the status to be funds deposited
    expect(waitRes.status, 'Funds not deposited').to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
    )

    // do a manual redeem
    const manualRedeem = await waitRes.message.redeem()
    const rec = await manualRedeem.wait()
    const retryRec = await L1ToL2MessageReader.getRedeemReceipt(
      rec,
      l2Signer.provider!
    )
    expect(retryRec).to.not.be.null
    expect(retryRec!.blockHash, 'redeemed in same block').to.eq(rec.blockHash)
    expect(retryRec!.to!, 'redeemed in same block').to.eq(
      l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec!.status!, 'tx didnt succeed').to.eq(1)
  })

  // CHRIS: TODO: add back in
  it('deposit with low funds, fails first redeem, succeeds seconds', async () => {
    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
      l2Network,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const { testToken, waitRes } = await depositTokenTest(
      erc20Bridger,
      l1Signer,
      l2Signer,
      {
        maxGas: {
          base: BigNumber.from(5),
        },
        maxGasPrice: {
          base: BigNumber.from(5),
        },
      }
    )

    // we expect the status to be funds deposited
    expect(waitRes.status, 'Funds not deposited').to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
    )

    // do a manual redeem - supply enough gas so that the redeem tx succeeds but l2 tx doesnt
    const manualRedeem = await waitRes.message.redeem(BigNumber.from(120000))
    const rec = await manualRedeem.wait()
    const retryRec = await L1ToL2MessageReader.getRedeemReceipt(
      rec,
      l2Signer.provider!
    )
    expect(retryRec, 'null retry').to.not.be.null
    expect(retryRec!.blockHash, 'redeemed in same block').to.eq(rec.blockHash)
    expect(retryRec!.to!, 'redeemed in same block').to.eq(
      l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec!.status!, 'tx didnt fail').to.eq(0)

    // do a manual redeem - supply enough gas so that the redeem tx succeeds but l2 tx doesnt
    const manualRedeem2 = await waitRes.message.redeem(BigNumber.from(1000000))
    const rec2 = await manualRedeem2.wait()
    const retryRec2 = await L1ToL2MessageReader.getRedeemReceipt(
      rec2,
      l2Signer.provider!
    )
    expect(retryRec2, 'null second retry').to.not.be.null
    expect(retryRec2!.blockHash, 'redeemed in same block').to.eq(rec2.blockHash)
    expect(retryRec2!.to!, 'redeemed in same block').to.eq(
      l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec2!.status!, 'tx didnt succeed').to.eq(1)
  })

  // CHRIS: TODO: why do we have this?
  it('deposits erc20 and transfer to funding wallet', async () => {
    const {
      l1Signer,
      erc20Bridger,
      l2Signer,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const { testToken } = await depositTokenTest(
      erc20Bridger,
      l1Signer,
      l2Signer
    )
    const l2Token = erc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      await erc20Bridger.getL2ERC20Address(
        testToken.address,
        l1Signer.provider!
      )
    )
    const testWalletL2Balance = (
      await l2Token.functions.balanceOf(await l2Signer.getAddress())
    )[0]
    const _preFundedL2Wallet = new Wallet(process.env.DEVNET_PRIVKEY as string)
    await l2Token
      .connect(l2Signer)
      .transfer(_preFundedL2Wallet.address, testWalletL2Balance)
  })

  it('withdraws erc20', async function () {
    const {
      l1Signer,
      l2Signer,
      l2Network,
      erc20Bridger,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    // deposit some tokens so we have enough to withdraw
    const { testToken } = await depositTokenTest(
      erc20Bridger,
      l1Signer,
      l2Signer
    )

    const l2TokenAddr = await erc20Bridger.getL2ERC20Address(
      testToken.address,
      l1Signer.provider!
    )
    const l2TokenContract = await erc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      l2TokenAddr
    )
    const l2BalanceStart = await l2TokenContract.balanceOf(
      await l2Signer.getAddress()
    )
    expect(l2BalanceStart.toNumber(), 'start balance').to.eq(
      depositAmount.toNumber()
    )

    const l2GatewayAddr = await erc20Bridger.getL2GatewayAddress(
      testToken.address,
      l2Signer.provider!
    )
    expect(l2GatewayAddr, 'standard gateway').to.eq(
      l2Network.tokenBridge.l2ERC20Gateway
    )
    await (
      await l2TokenContract
        .connect(l2Signer)
        .approve(l2GatewayAddr, withdrawalAmount)
    ).wait()

    const withdrawRes = await erc20Bridger.withdraw({
      amount: withdrawalAmount,
      erc20l1Address: testToken.address,
      l2Signer: l2Signer,
    })
    const withdrawRec = await withdrawRes.wait()

    expect(withdrawRec.status).to.equal(
      1,
      'token withdraw initiation txn failed'
    )

    const outgoingMessages = await withdrawRec.getL2ToL1Messages(
      l1Signer.provider!,
      l2Network
    )
    const firstMessage = outgoingMessages[0]
    expect(firstMessage, 'getWithdrawalsInL2Transaction came back empty').to
      .exist

    const messageStatus = await firstMessage.status(null, withdrawRec.blockHash)

    expect(
      messageStatus,
      `standard token withdraw status returned ${messageStatus}`
    ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

    const l2Token = erc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      await erc20Bridger.getL2ERC20Address(
        testToken.address,
        l1Signer.provider!
      )
    )
    const testWalletL2Balance = (
      await l2Token.functions.balanceOf(await l2Signer.getAddress())
    )[0]

    expect(
      testWalletL2Balance.toNumber(),
      'token withdraw balance not deducted'
    ).to.eq(depositAmount.sub(withdrawalAmount).toNumber())
    const walletAddress = await l1Signer.getAddress()

    const gatewayAddress = await erc20Bridger.getL2GatewayAddress(
      testToken.address,
      l2Signer.provider!
    )
    const tokenWithdrawEvents = await erc20Bridger.getL2WithdrawalEvents(
      l2Signer.provider!,
      gatewayAddress,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      testToken.address,
      walletAddress
    )
    expect(tokenWithdrawEvents.length).to.equal(
      1,
      'token filtered query failed'
    )
  })
  it('getERC20L1Address/getERC20L2Address work as expected', async () => {
    const {
      l1Signer,
      l2Signer,
      erc20Bridger,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    const deployErc20 = new TestERC20__factory().connect(l1Signer)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    // CHRIS: TODO: we should have an approve for deposit, and an approve for withdraw
    // CHRIS: TODO: but do we need that for withdraw? if not include it in the docs

    await (await testToken.mint()).wait()
    await (
      await erc20Bridger.approveToken({
        erc20L1Address: testToken.address,
        l1Signer: l1Signer,
      })
    ).wait()
    const depositRes = await erc20Bridger.deposit({
      l1Signer: l1Signer,
      l2Provider: l2Signer.provider!,
      erc20L1Address: testToken.address,
      amount: depositAmount,
    })
    const depositRec = await depositRes.wait()
    const waitRes = await depositRec.waitForL2(l2Signer)
    expect(waitRes.complete, 'wait res complete').to.eq(true)
    const queriedL2Address = await erc20Bridger.getL2ERC20Address(
      testToken.address,
      l1Signer.provider!
    )
    const queriedL1Address = await erc20Bridger.getL1ERC20Address(
      queriedL2Address,
      l2Signer.provider!
    )
    expect(queriedL1Address).to.equal(
      testToken.address,
      'getERC20L1Address/getERC20L2Address failed with proper token address'
    )

    const randomAddress = await l1Signer.getAddress()
    try {
      await erc20Bridger.getL1ERC20Address(randomAddress, l2Signer.provider!)
      expect(true, 'expected getERC20L1Address to throw for random address').to
        .be.false
    } catch (err) {
      // expected result
    }
  })
})

const depositTokenTest = async (
  erc20Bridger: Erc20Bridger,
  l1Signer: Signer,
  l2Signer: Signer,
  retryableOverrides?: Omit<GasOverrides, 'sendL2CallValueFromL1'>
) => {
  console.log('a')
  const deployErc20 = new TestERC20__factory().connect(l1Signer)
  const testToken = await deployErc20.deploy()
  await testToken.deployed()

  console.log('b')

  await (await testToken.mint()).wait()
  await (
    await erc20Bridger.approveToken({
      erc20L1Address: testToken.address,
      l1Signer: l1Signer,
    })
  ).wait()

  console.log('c')

  const expectedL1GatewayAddress = await erc20Bridger.getL1GatewayAddress(
    testToken.address,
    l1Signer.provider!
  )
  const l1Token = erc20Bridger.getL1TokenContract(
    l1Signer.provider!,
    testToken.address
  )
  const allowance = await l1Token.allowance(
    await l1Signer.getAddress(),
    expectedL1GatewayAddress
  )
  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  console.log('d')

  const initialBridgeTokenBalance = await testToken.balanceOf(
    expectedL1GatewayAddress
  )

  console.log('e')
  const depositRes = await erc20Bridger.deposit({
    l1Signer: l1Signer,
    l2Provider: l2Signer.provider!,
    erc20L1Address: testToken.address,
    amount: depositAmount,
    retryableGasOverrides: retryableOverrides,
  })

  console.log('f')

  const depositRec = await depositRes.wait()

  console.log('g')

  const finalBridgeTokenBalance = await testToken.balanceOf(
    expectedL1GatewayAddress
  )

  console.log('h')

  expect(
    initialBridgeTokenBalance.add(depositAmount).toNumber(),
    'bridge balance not updated after L1 token deposit txn'
  ).to.eq(finalBridgeTokenBalance.toNumber())

  const waitRes = await depositRec.waitForL2(l2Signer)
  if (!!retryableOverrides)
    return {
      testToken,
      waitRes,
    }

  await testRetryableTicket(l2Signer.provider!, depositRec)

  const l2Token = erc20Bridger.getL2TokenContract(
    l2Signer.provider!,
    await erc20Bridger.getL2ERC20Address(testToken.address, l1Signer.provider!)
  )
  const testWalletL2Balance = await l2Token.balanceOf(
    await l2Signer.getAddress()
  )
  expect(
    testWalletL2Balance.eq(depositAmount),
    'l2 wallet not updated after deposit'
  ).to.be.true

  return { testToken, waitRes, l2Token }
}
