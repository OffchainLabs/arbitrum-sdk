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
  skipIfMainnet,
  depositToken,
  ExpectedGatewayType,
} from './testHelpers'
import {
  Erc20Bridger,
  L1ToL2MessageStatus,
  L1ToL2MessageWriter,
  L2Network,
  L2TransactionReceipt,
} from '../src'
import { Signer } from 'ethers'
import { TestERC20 } from '../src/lib/abi/TestERC20'
import { JsonRpcProvider } from '@ethersproject/providers'
import { testSetup } from '../scripts/testSetup'
const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('standard ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // test globals
  let testState: {
    l1Signer: Signer
    l2Signer: Signer
    erc20Bridger: Erc20Bridger
    l2Network: L2Network
    l1Token: TestERC20
  }

  before('init', async () => {
    const setup = await testSetup()

    await fundL1(setup.l1Signer)
    await fundL2(setup.l2Signer)
    // CHRIS: TODO: remove second fund
    // await fundL2(setup.l2Signer)

    const deployErc20 = new TestERC20__factory().connect(setup.l1Signer)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()

    testState = { ...setup, l1Token: testToken }
  })

  it('deposits erc20 (with L2 Eth funding)', async () => {
    await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.REDEEMED,
      ExpectedGatewayType.STANDARD
    )
  })

  const redeemAndTest = async (
    message: L1ToL2MessageWriter,
    expectedStatus: 0 | 1,
    gasLimit?: BigNumber
  ) => {
    // CHRIS: TODO: clean up this method

    // do a manual redeem - supply enough gas so that the redeem tx succeeds but l2 tx doesnt
    // CHRIS: TODO: this below should be batched up into a `waitForRedeem`
    const manualRedeem = await message.redeem({ gasLimit })
    const rec = new L2TransactionReceipt(await manualRedeem.wait())
    const redeemScheduledEvents = await rec.getRedeemScheduledEvents()
    const retryRec = await message.l2Provider.getTransactionReceipt(
      redeemScheduledEvents[0].retryTxHash
    )

    const rec1 = await (testState.l2Signer
      .provider as JsonRpcProvider)?.send('eth_getTransactionReceipt', [
      rec?.transactionHash,
    ])
    const rec2 = await (testState.l2Signer
      .provider as JsonRpcProvider)?.send('eth_getTransactionReceipt', [
      retryRec?.transactionHash,
    ])

    console.log(rec2)
    throw new Error("hello")

    // const eg1 = BigNumber.from(rec1.effectiveGasPrice)
    // const l1GasUsed1 = BigNumber.from(rec1.l1GasUsed)
    // const totalGasUsed1 = BigNumber.from(rec1.gasUsed)
    // const eg2 = BigNumber.from(rec2.effectiveGasPrice)
    // const l1GasUsed2 = BigNumber.from(rec2.l1GasUsed)
    // const totalGasUsed2 = BigNumber.from(rec2.gasUsed)

    // const feeData1 = await testState.l1Signer.provider!.getFeeData()
    // const feeData2 = await testState.l2Signer.provider!.getFeeData()

    // console.log(
    //   'base fee l1',
    //   (
    //     await testState.l1Signer.provider!.getBlock('latest')
    //   )?.baseFeePerGas?.toNumber()
    // )
    // console.log(
    //   'base fee l2',
    //   (
    //     await testState.l2Signer.provider!.getBlock('latest')
    //   )?.baseFeePerGas?.toNumber()
    // )
    // console.log(
    //   'feedata 1',
    //   feeData1.maxFeePerGas!.toString(),
    //   feeData1.maxPriorityFeePerGas!.toString()
    // )
    // console.log(
    //   'feedata 2',
    //   feeData2.maxFeePerGas!.toString(),
    //   feeData2.maxPriorityFeePerGas!.toString()
    // )
    // console.log(
    //   eg1.toString(),
    //   l1GasUsed1.toString(),
    //   totalGasUsed1.sub(l1GasUsed1).toString(),
    //   totalGasUsed1.mul(eg1).toString(),
    //   eg2.toString(),
    //   l1GasUsed2.toString(),
    //   totalGasUsed2.sub(l1GasUsed2).toString(),
    //   totalGasUsed2.mul(eg2).toString()
    // )

    expect(retryRec!.blockHash, 'redeemed in same block').to.eq(rec.blockHash)
    expect(retryRec!.to, 'redeemed in same block').to.eq(
      testState.l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec!.status, 'tx didnt fail').to.eq(expectedStatus)
  }

  it('deposit with no funds, manual redeem', async () => {
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      ExpectedGatewayType.STANDARD,
      {
        maxGas: { base: BigNumber.from(0) },
        maxGasPrice: { base: BigNumber.from(0) },
      }
    )

    await redeemAndTest(waitRes.message, 1)
  })

  it('deposit with low funds, manual redeem', async () => {
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      ExpectedGatewayType.STANDARD,
      {
        maxGas: { base: BigNumber.from(5) },
        maxGasPrice: { base: BigNumber.from(5) },
      }
    )

    await redeemAndTest(waitRes.message, 1)
  })

  // CHRIS: TODO: add this back in
  it('deposit with low funds, fails first redeem, succeeds seconds', async () => {
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      ExpectedGatewayType.STANDARD,
      {
        maxGas: { base: BigNumber.from(5) },
        maxGasPrice: { base: BigNumber.from(5) },
      }
    )

    // not enough gas
    // CHRIS:TODO: remvoe console.logs
    await redeemAndTest(waitRes.message, 0, BigNumber.from(1250000))
    console.log('a')
    await redeemAndTest(waitRes.message, 1)
  })

  it('withdraws erc20', async function () {
    const l2TokenAddr = await testState.erc20Bridger.getL2ERC20Address(
      testState.l1Token.address,
      testState.l1Signer.provider!
    )
    const l2TokenContract = await testState.erc20Bridger.getL2TokenContract(
      testState.l2Signer.provider!,
      l2TokenAddr
    )
    const l2BalanceStart = await l2TokenContract.balanceOf(
      await testState.l2Signer.getAddress()
    )
    // 4 deposits above - increase this number if more deposit tests added
    const startBalance = depositAmount.mul(3)
    expect(
      l2BalanceStart.toNumber(),
      'start balance not correct, if deposit tests have been added/removed above then they start balance here needs to be adjusted.'
    ).to.eq(startBalance.toNumber())

    const l2GatewayAddr = await testState.erc20Bridger.getL2GatewayAddress(
      testState.l1Token.address,
      testState.l2Signer.provider!
    )
    expect(l2GatewayAddr, 'standard gateway').to.eq(
      testState.l2Network.tokenBridge.l2ERC20Gateway
    )
    await (
      await l2TokenContract
        .connect(testState.l2Signer)
        .approve(l2GatewayAddr, withdrawalAmount)
    ).wait()

    const withdrawRes = await testState.erc20Bridger.withdraw({
      amount: withdrawalAmount,
      erc20l1Address: testState.l1Token.address,
      l2Signer: testState.l2Signer,
    })
    const withdrawRec = await withdrawRes.wait()

    expect(withdrawRec.status).to.equal(
      1,
      'token withdraw initiation txn failed'
    )

    const outgoingMessages = await withdrawRec.getL2ToL1Messages(
      testState.l1Signer.provider!,
      testState.l2Signer.provider!
    )
    const firstMessage = outgoingMessages[0]
    expect(firstMessage, 'getWithdrawalsInL2Transaction came back empty').to
      .exist

    const messageStatus = await firstMessage.status()

    expect(
      messageStatus,
      `standard token withdraw status returned ${messageStatus}`
    ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

    const l2Token = testState.erc20Bridger.getL2TokenContract(
      testState.l2Signer.provider!,
      await testState.erc20Bridger.getL2ERC20Address(
        testState.l1Token.address,
        testState.l1Signer.provider!
      )
    )
    const testWalletL2Balance = (
      await l2Token.functions.balanceOf(await testState.l2Signer.getAddress())
    )[0]

    expect(
      testWalletL2Balance.toNumber(),
      'token withdraw balance not deducted'
    ).to.eq(startBalance.sub(withdrawalAmount).toNumber())
    const walletAddress = await testState.l1Signer.getAddress()

    const gatewayAddress = await testState.erc20Bridger.getL2GatewayAddress(
      testState.l1Token.address,
      testState.l2Signer.provider!
    )
    const tokenWithdrawEvents = await testState.erc20Bridger.getL2WithdrawalEvents(
      testState.l2Signer.provider!,
      gatewayAddress,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      testState.l1Token.address,
      walletAddress
    )
    expect(tokenWithdrawEvents.length).to.equal(
      1,
      'token filtered query failed'
    )
  })
})
