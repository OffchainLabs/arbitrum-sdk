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
import { Wallet, utils, constants } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { TestERC20__factory } from '../../src/lib/abi/factories/TestERC20__factory'
import {
  fundParentSigner,
  skipIfMainnet,
  depositToken,
  GatewayType,
  withdrawToken,
  fundChildSigner,
} from './testHelpers'
import {
  ParentToChildMessageStatus,
  ParentToChildMessageWriter,
  ChildTransactionReceipt,
} from '../../src'
import { TestERC20 } from '../../src/lib/abi/TestERC20'
import { testSetup } from '../testSetup'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import {
  ARB_RETRYABLE_TX_ADDRESS,
  NODE_INTERFACE_ADDRESS,
} from '../../src/lib/dataEntities/constants'
import { ArbRetryableTx__factory } from '../../src/lib/abi/factories/ArbRetryableTx__factory'
import { NodeInterface__factory } from '../../src/lib/abi/factories/NodeInterface__factory'
import { isDefined } from '../../src/lib/utils/lib'
import {
  getParentCustomFeeTokenAllowance,
  approveParentCustomFeeTokenForErc20Deposit,
  isArbitrumNetworkWithCustomFeeToken,
} from './custom-fee-token/customFeeTokenTestHelpers'
import { itOnlyWhenCustomGasToken } from './custom-fee-token/mochaExtensions'

const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('standard ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // test globals
  let testState: Awaited<ReturnType<typeof testSetup>> & {
    parentToken: TestERC20
  }

  before('init', async () => {
    const setup = await testSetup()
    await fundParentSigner(setup.parentSigner)
    await fundChildSigner(setup.childSigner)
    const deployErc20 = new TestERC20__factory().connect(setup.parentSigner)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()

    testState = { ...setup, parentToken: testToken }
  })

  itOnlyWhenCustomGasToken(
    'approves custom gas token to be spent by the relevant gateway',
    async () => {
      const { parentSigner, erc20Bridger } = await testSetup()

      const gatewayAddress = await erc20Bridger.getParentGatewayAddress(
        testState.parentToken.address,
        parentSigner.provider!
      )

      const initialAllowance = await getParentCustomFeeTokenAllowance(
        await parentSigner.getAddress(),
        gatewayAddress
      )

      expect(initialAllowance.toString()).to.eq(
        constants.Zero.toString(),
        'initial allowance is not empty'
      )

      const tx = await erc20Bridger.approveGasToken({
        parentSigner,
        erc20ParentAddress: testState.parentToken.address,
      })
      await tx.wait()

      const finalAllowance = await getParentCustomFeeTokenAllowance(
        await parentSigner.getAddress(),
        gatewayAddress
      )

      expect(finalAllowance.toString()).to.eq(
        constants.MaxUint256.toString(),
        'initial allowance is not empty'
      )
    }
  )

  it('deposits erc20', async () => {
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveParentCustomFeeTokenForErc20Deposit(
        testState.parentSigner,
        testState.parentToken.address
      )
    }

    await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.STANDARD,
    })
  })

  const redeemAndTest = async (
    message: ParentToChildMessageWriter,
    expectedStatus: 0 | 1,
    gasLimit?: BigNumber
  ) => {
    const manualRedeem = await message.redeem({ gasLimit })
    const retryRec = await manualRedeem.waitForRedeem()
    const redeemRec = await manualRedeem.wait()
    const blockHash = redeemRec.blockHash

    expect(retryRec.blockHash, 'redeemed in same block').to.eq(blockHash)
    expect(retryRec.to, 'redeemed in same block').to.eq(
      testState.childChain.tokenBridge.childErc20Gateway
    )
    expect(retryRec.status, 'tx didnt fail').to.eq(expectedStatus)
    expect(await message.status(), 'message status').to.eq(
      expectedStatus === 0
        ? ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD
        : ParentToChildMessageStatus.REDEEMED
    )
  }

  it('deposit with no funds, manual redeem', async () => {
    const { waitRes } = await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      expectedGatewayType: GatewayType.STANDARD,
      retryableOverrides: {
        gasLimit: { base: BigNumber.from(0) },
        maxFeePerGas: { base: BigNumber.from(0) },
      },
    })

    await redeemAndTest(waitRes.message, 1)
  })

  it('deposit with low funds, manual redeem', async () => {
    const { waitRes } = await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      expectedGatewayType: GatewayType.STANDARD,
      retryableOverrides: {
        gasLimit: { base: BigNumber.from(5) },
        maxFeePerGas: { base: BigNumber.from(5) },
      },
    })

    await redeemAndTest(waitRes.message, 1)
  })

  it('deposit with only low gas limit, manual redeem succeeds', async () => {
    // this should cause us to emit a RedeemScheduled event, but no actual
    // redeem transaction
    const { waitRes } = await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      expectedGatewayType: GatewayType.STANDARD,
      retryableOverrides: {
        gasLimit: { base: BigNumber.from(21000) },
      },
    })

    // check that a RedeemScheduled event was emitted, but no retry tx receipt exists
    const retryableCreation =
      await waitRes.message.getRetryableCreationReceipt()
    if (!isDefined(retryableCreation))
      throw new Error('Missing retryable creation.')
    const l2Receipt = new ChildTransactionReceipt(retryableCreation)
    const redeemsScheduled = l2Receipt.getRedeemScheduledEvents()
    expect(redeemsScheduled.length, 'Unexpected redeem length').to.eq(1)
    const retryReceipt =
      await testState.childSigner.provider!.getTransactionReceipt(
        redeemsScheduled[0].retryTxHash
      )
    expect(isDefined(retryReceipt), 'Retry should not exist').to.be.false

    // manual redeem succeeds
    await redeemAndTest(waitRes.message, 1)
  })

  it('deposit with low funds, fails first redeem, succeeds seconds', async () => {
    const { waitRes } = await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      expectedGatewayType: GatewayType.STANDARD,
      retryableOverrides: {
        gasLimit: { base: BigNumber.from(5) },
        maxFeePerGas: { base: BigNumber.from(5) },
      },
    })
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      testState.childSigner.provider!
    )
    const nInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      testState.childSigner.provider!
    )
    const gasComponents = await nInterface.callStatic.gasEstimateComponents(
      arbRetryableTx.address,
      false,
      arbRetryableTx.interface.encodeFunctionData('redeem', [
        waitRes.message.retryableCreationId,
      ])
    )

    // force the redeem to fail by submitted just a bit under the required gas
    // so it is enough to pay for L1 + L2 intrinsic gas costs
    await redeemAndTest(waitRes.message, 0, gasComponents.gasEstimate.sub(9000))
    await redeemAndTest(waitRes.message, 1)
  })

  it('withdraws erc20', async function () {
    const l2TokenAddr = await testState.erc20Bridger.getChildErc20Address(
      testState.parentToken.address,
      testState.parentSigner.provider!
    )
    const l2Token = testState.erc20Bridger.getChildTokenContract(
      testState.childSigner.provider!,
      l2TokenAddr
    )
    // 5 deposits above - increase this number if more deposit tests added
    const startBalance = depositAmount.mul(5)
    const l2BalanceStart = await l2Token.balanceOf(
      await testState.childSigner.getAddress()
    )
    expect(l2BalanceStart.toString(), 'l2 balance start').to.eq(
      l2BalanceStart.toString()
    )

    await withdrawToken({
      ...testState,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      amount: withdrawalAmount,
      gatewayType: GatewayType.STANDARD,
      startBalance: startBalance,
      parentToken: ERC20__factory.connect(
        testState.parentToken.address,
        testState.parentSigner.provider!
      ),
    })
  })

  it('deposits erc20 with extra ETH', async () => {
    await depositToken({
      depositAmount,
      ethDepositAmount: utils.parseEther('0.0005'),
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.STANDARD,
    })
  })

  it('deposits erc20 with extra ETH to a specific child chain address', async () => {
    const randomAddress = Wallet.createRandom().address
    await depositToken({
      depositAmount,
      ethDepositAmount: utils.parseEther('0.0005'),
      parentTokenAddress: testState.parentToken.address,
      erc20Bridger: testState.erc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.STANDARD,
      destinationAddress: randomAddress,
    })
  })
})
