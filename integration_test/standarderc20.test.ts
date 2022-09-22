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
import {
  fundL1,
  fundL2,
  skipIfMainnet,
  depositToken,
  GatewayType,
  withdrawToken,
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
import { testSetup } from '../scripts/testSetup'
import { ERC20__factory } from '../src/lib/abi/factories/ERC20__factory'
import { isDefined } from '../src/lib/utils/lib'
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

    const deployErc20 = new TestERC20__factory().connect(setup.l1Signer)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()

    testState = { ...setup, l1Token: testToken }
  })

  it('deposits erc20', async () => {
    await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.REDEEMED,
      GatewayType.STANDARD
    )
  })

  const redeemAndTest = async (
    message: L1ToL2MessageWriter,
    expectedStatus: 0 | 1,
    gasLimit?: BigNumber
  ) => {
    const manualRedeem = await message.redeem({ gasLimit })
    const retryRec = await manualRedeem.waitForRedeem()
    const blockHash = (await manualRedeem.wait()).blockHash

    expect(retryRec.blockHash, 'redeemed in same block').to.eq(blockHash)
    expect(retryRec.to, 'redeemed in same block').to.eq(
      testState.l2Network.tokenBridge.l2ERC20Gateway
    )
    expect(retryRec.status, 'tx didnt fail').to.eq(expectedStatus)
    expect(await message.status(), 'message status').to.eq(
      expectedStatus === 0
        ? L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
        : L1ToL2MessageStatus.REDEEMED
    )
  }

  it('deposit with no funds, manual redeem', async () => {
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      GatewayType.STANDARD,
      {
        gasLimit: { base: BigNumber.from(0) },
        maxFeePerGas: { base: BigNumber.from(0) },
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
      GatewayType.STANDARD,
      {
        gasLimit: { base: BigNumber.from(5) },
        maxFeePerGas: { base: BigNumber.from(5) },
      }
    )

    await redeemAndTest(waitRes.message, 1)
  })

  it('deposit with only low gas limit, manual redeem succeeds', async () => {
    // this should cause us to emit a RedeemScheduled event, but no actual
    // redeem transaction
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      GatewayType.STANDARD,
      {
        gasLimit: { base: BigNumber.from(21000) },
      }
    )

    // check that a RedeemScheduled event was emitted, but no retry tx receipt exists
    const retryableCreation =
      await waitRes.message.getRetryableCreationReceipt()
    if (!isDefined(retryableCreation))
      throw new Error('Missing retryable creation.')
    const l2Receipt = new L2TransactionReceipt(retryableCreation)
    const redeemsScheduled = l2Receipt.getRedeemScheduledEvents()
    expect(redeemsScheduled.length, 'Unexpected redeem length').to.eq(1)
    const retryReceipt =
      await testState.l2Signer.provider!.getTransactionReceipt(
        redeemsScheduled[0].retryTxHash
      )
    expect(isDefined(retryReceipt), 'Retry should not exist').to.be.false

    // manual redeem succeeds
    await redeemAndTest(waitRes.message, 1)
  })

  // we currently skip this test because we need to find a gas limit that allows
  // for the redeem transaction to execute, but not the following scheduled l2 tx
  // we should calculate this using the l2's view of the l1 base fee
  it.skip('deposit with low funds, fails first redeem, succeeds seconds', async () => {
    const { waitRes } = await depositToken(
      depositAmount,
      testState.l1Token.address,
      testState.erc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      GatewayType.STANDARD,
      {
        gasLimit: { base: BigNumber.from(5) },
        maxFeePerGas: { base: BigNumber.from(5) },
      }
    )

    // not enough gas
    await redeemAndTest(waitRes.message, 0, BigNumber.from(130000))
    await redeemAndTest(waitRes.message, 1)
  })

  it('withdraws erc20', async function () {
    const l2TokenAddr = await testState.erc20Bridger.getL2ERC20Address(
      testState.l1Token.address,
      testState.l1Signer.provider!
    )
    const l2Token = testState.erc20Bridger.getL2TokenContract(
      testState.l2Signer.provider!,
      l2TokenAddr
    )
    // 3 deposits above - increase this number if more deposit tests added
    const startBalance = depositAmount.mul(4)
    const l2BalanceStart = await l2Token.balanceOf(
      await testState.l2Signer.getAddress()
    )
    expect(l2BalanceStart.toString(), 'l2 balance start').to.eq(
      l2BalanceStart.toString()
    )

    await withdrawToken({
      ...testState,
      amount: withdrawalAmount,
      gatewayType: GatewayType.STANDARD,
      startBalance: startBalance,
      l1Token: ERC20__factory.connect(
        testState.l1Token.address,
        testState.l1Signer.provider!
      ),
    })
  })
})
