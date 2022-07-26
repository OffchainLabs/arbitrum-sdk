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
import dotenv from 'dotenv'

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'
import { Provider } from '@ethersproject/abstract-provider'

import { fundL1, fundL2, wait } from '../integration_test/testHelpers'
import { L2ToL1MessageStatus } from '../src/lib/message/L2ToL1Message'
import { testSetup } from '../scripts/testSetup'
import { isNitroL2 } from '../src/lib/utils/migration_types'
import { BigNumber } from 'ethers'
import { ERC20__factory } from '../src/lib/abi/factories/ERC20__factory'
import { TestWETH9__factory } from '../src/lib/abi/factories/TestWETH9__factory'
import {
  EthBridger,
  getL2Network,
  Erc20Bridger,
  L1ToL2MessageStatus,
  L2TransactionReceipt,
  L1TransactionReceipt,
} from '../src'
import { ArbSdkError } from '../src/lib/dataEntities/errors'
import path from 'path'
import * as fs from 'fs'
dotenv.config()

const waitForNitro = async (l2Provider: Provider, minimum?: number) => {
  const now = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // isNitroL2 can throw an error during the migration
      const isNitroNow =
        (await isNitroL2(l2Provider, 30000)) &&
        (!minimum || Date.now() - now > minimum)

      if (isNitroNow) {
        // verify that the L2 node is up
        await l2Provider.getBlockNumber()
        return
      }
    } catch (err) {
      console.log('L2 node unavailable', err)
    }

    await wait(30000)
    console.log('Waiting for nitro upgrade')
  }
}

abstract class MigrationTest {
  public name = ''
  constructor(public readonly testState: TestState) {}

  public abstract initialise(): Promise<void>
  public abstract finalise(): Promise<void>
}

/**
 * Check that a receiver of eth just before the migration
 * still has it after the migration
 */
class EthTransferMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Eth transfer'
  }
  public override async initialise(): Promise<void> {
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    await (
      await this.testState.core.l2Signer.sendTransaction({
        to: randomAddress,
        value: amountToSend,
      })
    ).wait()

    const beforeBalance =
      await this.testState.core.l2Signer.provider!.getBalance(randomAddress)
    expect(beforeBalance.toString(), 'Eth transfer balance before').to.eq(
      amountToSend.toString()
    )

    this.testState.ethTransfer.address = randomAddress
    this.testState.ethTransfer.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const finalBalance =
      await this.testState.core.l2Signer.provider!.getBalance(
        this.testState.ethTransfer.address!
      )
    expect(finalBalance.toString(), 'Eth transfer balance after').to.eq(
      this.testState.ethTransfer.balance!
    )
  }
}

/**
 * Check that an ERC20 created just before the migration has the same
 * symbol and name after the migration
 */
class Erc20CreationMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Erc20 creation'
  }
  public override async initialise(): Promise<void> {
    const fac = new ERC20__factory(this.testState.core.l2Signer)

    const testName = 'TESTY_MIG'
    const testSymbol = 'MIG'

    const erc20 = await fac.deploy(testName, testSymbol)
    await erc20.deployed()

    expect(await erc20.name(), 'erc20 deploy name before').to.eq(testName)
    expect(await erc20.symbol(), 'erc20 deploy symbol before').to.eq(testSymbol)

    this.testState.tokenDeploy.address = erc20.address
    this.testState.tokenDeploy.name = testName
    this.testState.tokenDeploy.symbol = testSymbol
  }

  public override async finalise(): Promise<void> {
    const erc20 = ERC20__factory.connect(
      this.testState.tokenDeploy.address!,
      this.testState.core.l2Signer
    )

    expect(await erc20.name(), 'erc20 deploy name after').to.eq(
      this.testState.tokenDeploy.name
    )
    expect(await erc20.symbol(), 'erc20 deploy symbol after').to.eq(
      this.testState.tokenDeploy.symbol
    )
  }
}

/**
 * Check that a user who deposits into the weth contract just before migration
 * still has it after the migration
 */
class WethBalanceMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Weth balance'
  }

  public override async initialise(): Promise<void> {
    const randomUser = Wallet.createRandom().connect(
      this.testState.core.l2Signer.provider!
    )
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const amountToSend = parseEther('0.000137')

    await (
      await this.testState.core.l2Signer.sendTransaction({
        to: randomUser.address,
        value: parseEther('0.1'),
      })
    ).wait()

    const weth = TestWETH9__factory.connect(
      l2Network.tokenBridge.l2Weth,
      randomUser
    )
    await (await weth.functions.deposit({ value: amountToSend })).wait()

    expect(
      (await weth.balanceOf(randomUser.address)).toString(),
      'weth balance before'
    ).to.eq(amountToSend.toString())

    this.testState.weth.user = randomUser.privateKey
    this.testState.weth.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const user = new Wallet(
      this.testState.weth.user!,
      this.testState.core.l2Signer.provider!
    )
    const weth = TestWETH9__factory.connect(l2Network.tokenBridge.l2Weth, user)

    const userBalance = await weth.balanceOf(user.address)
    expect(userBalance.toString(), 'Weth balance after').to.eq(
      this.testState.weth.balance!.toString()
    )

    const ethBalBefore = await user.getBalance()
    await (await weth.withdraw(userBalance)).wait()
    const ethBalAfter = await user.getBalance()

    expect(
      ethBalAfter.gt(ethBalBefore),
      `Bal after greater than bal before: ${ethBalBefore.toString()} ${ethBalAfter.toString()}`
    ).to.be.true

    const userBalanceAfter = await weth.balanceOf(user.address)
    expect(userBalanceAfter.toString(), 'Weth balance after withdraw').to.eq(
      BigNumber.from(0).toString()
    )
  }
}

/**
 * Check that an L1->L2 weth deposit initiated before the migration
 * can be redeemed after the migration.
 */
class WethDepositMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Weth X chain deposit'
  }

  public override async initialise(): Promise<void> {
    const randomUser = Wallet.createRandom().connect(
      this.testState.core.l1Signer.provider!
    )
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const amountToSend = parseEther('0.000137')
    const erc20Bridger = this.testState.core.erc20Bridger

    await (
      await this.testState.core.l1Signer.sendTransaction({
        to: randomUser.address,
        value: parseEther('0.2'),
      })
    ).wait()

    const l1Weth = TestWETH9__factory.connect(
      l2Network.tokenBridge.l1Weth,
      randomUser
    )
    await (await l1Weth.functions.deposit({ value: amountToSend })).wait()

    // deposit to weth
    // now deposit onto arbitrum
    await (
      await erc20Bridger.approveToken({
        erc20L1Address: l1Weth.address,
        l1Signer: randomUser,
      })
    ).wait()

    const l1Token = erc20Bridger.getL1TokenContract(
      randomUser.provider!,
      l1Weth.address
    )
    const initialBridgeTokenBalance = await l1Token.balanceOf(
      l2Network.tokenBridge.l1WethGateway
    )
    const userBalBefore = await l1Token.balanceOf(await randomUser.getAddress())

    const depositRes = await erc20Bridger.deposit({
      l1Signer: randomUser,
      l2Provider: this.testState.core.l2Signer.provider!,
      erc20L1Address: l1Weth.address,
      amount: amountToSend,
      // set so that the deposit will fail on L2
      retryableGasOverrides: {
        gasLimit: { base: BigNumber.from(5) },
        maxFeePerGas: { base: BigNumber.from(5) },
      },
    })
    const depositRec = await depositRes.wait()

    const finalBridgeTokenBalance = await l1Token.balanceOf(
      l2Network.tokenBridge.l1WethGateway
    )
    expect(
      finalBridgeTokenBalance.toNumber(),
      'bridge balance not updated after L1 token deposit txn'
    ).to.eq(
      // for weth the eth is actually withdrawn, rather than transferred
      initialBridgeTokenBalance.toNumber()
    )

    const userBalAfter = await l1Token.balanceOf(await randomUser.getAddress())
    expect(userBalAfter.toString(), 'user bal after').to.eq(
      userBalBefore.sub(amountToSend).toString()
    )

    this.testState.wethXChainDeposit.messageTxHash = depositRec.transactionHash
    this.testState.wethXChainDeposit.user = randomUser.privateKey
    this.testState.wethXChainDeposit.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const user = new Wallet(
      this.testState.wethXChainDeposit.user!,
      this.testState.core.l2Signer.provider!
    )
    const weth = TestWETH9__factory.connect(l2Network.tokenBridge.l2Weth, user)
    const l2Signer = this.testState.core.l2Signer
    const l1Provider = this.testState.core.l1Signer.provider!

    // we need to manually redeem the message
    const l1TransactionReceipt = new L1TransactionReceipt(
      await l1Provider.getTransactionReceipt(
        this.testState.wethXChainDeposit.messageTxHash!
      )
    )
    const message = (await l1TransactionReceipt.getL1ToL2Messages(l2Signer))[0]
    const status = await message.waitForStatus()
    expect(status.status, 'Weth deposit does not exist as retryable').to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
    )

    const userBalanceBefore = await weth.balanceOf(user.address)
    expect(userBalanceBefore.toString(), 'Weth balance before redeem').to.eq(
      '0'
    )

    await (await message.redeem()).wait()

    const statusAfter = await message.status()
    expect(statusAfter, 'Weth deposit not redeemed.').to.eq(
      L1ToL2MessageStatus.REDEEMED
    )

    const userBalance = await weth.balanceOf(user.address)
    expect(userBalance.toString(), 'Weth balance after redeem').to.eq(
      this.testState.wethXChainDeposit.balance!.toString()
    )
  }
}

/**
 * Checks that a weth withdrawal that was started before the migration
 * can be completed after the migration
 */
class WethWithdrawalMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Weth X chain withdrawal'
  }

  public override async initialise(): Promise<void> {
    const randomUser = Wallet.createRandom().connect(
      this.testState.core.l2Signer.provider!
    )
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const amountToSend = parseEther('0.000137')
    const erc20Bridger = this.testState.core.erc20Bridger

    await (
      await this.testState.core.l2Signer.sendTransaction({
        to: randomUser.address,
        value: parseEther('0.2'),
      })
    ).wait()

    const l2Weth = TestWETH9__factory.connect(
      l2Network.tokenBridge.l2Weth,
      randomUser
    )
    await (await l2Weth.functions.deposit({ value: amountToSend })).wait()

    // deposit to weth
    // now withdraw from arbitrum
    const withdrawRes = await erc20Bridger.withdraw({
      amount: amountToSend,
      erc20l1Address: l2Network.tokenBridge.l1Weth,
      l2Signer: randomUser,
    })
    const withdrawRec = await withdrawRes.wait()
    expect(withdrawRec.status).to.equal(
      1,
      'weth initiate token withdraw txn failed'
    )

    const message = (
      await withdrawRec.getL2ToL1Messages(
        this.testState.core.l1Signer,
        this.testState.core.l2Signer.provider!
      )
    )[0]
    expect(message, 'weth withdraw message not found').to.exist

    const messageStatus = await message.status(randomUser.provider!)
    expect(messageStatus, `invalid withdraw status`).to.eq(
      L2ToL1MessageStatus.UNCONFIRMED
    )

    this.testState.wethXChainWithdrawal.messageTxHash =
      withdrawRec.transactionHash
    this.testState.wethXChainWithdrawal.user = randomUser.privateKey
    this.testState.wethXChainWithdrawal.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const l2Signer = this.testState.core.l2Signer
    const l2Provider = l2Signer.provider!
    const l2Network = await getL2Network(this.testState.core.l2Signer)
    const user = new Wallet(
      this.testState.wethXChainWithdrawal.user!,
      this.testState.core.l1Signer.provider!
    )
    const l1Weth = TestWETH9__factory.connect(
      l2Network.tokenBridge.l1Weth,
      user
    )
    const balBefore = await l1Weth.balanceOf(user.address)
    expect(balBefore.toString(), 'weth withdrawal balance before not 0').to.eq(
      '0'
    )
    const l2TransactionReceipt = new L2TransactionReceipt(
      await l2Provider.getTransactionReceipt(
        this.testState.wethXChainWithdrawal.messageTxHash!
      )
    )
    const message = (
      await l2TransactionReceipt.getL2ToL1Messages(
        this.testState.core.l1Signer,
        l2Provider
      )
    )[0]

    const outboxStatus = await message.status(l2Provider)
    expect(outboxStatus, 'weth withdrawal status not CONFIRMED').to.eq(
      L2ToL1MessageStatus.CONFIRMED
    )
    const execTx = await message.execute(l2Provider)
    await execTx.wait()
    expect(await message.status(l2Provider), 'executed status').to.eq(
      L2ToL1MessageStatus.EXECUTED
    )

    const userBalance = await l1Weth.balanceOf(user.address)
    expect(userBalance.toString(), 'Weth balance after xchain').to.eq(
      this.testState.wethXChainWithdrawal.balance!.toString()
    )
  }
}

/**
 * Check that an Eth withdrawal initiated before the migration
 * completes successfully after the migration
 */
class EthWithdrawalMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Eth X chain withdrawal'
  }

  public override async initialise(): Promise<void> {
    const randomUser = Wallet.createRandom().connect(
      this.testState.core.l2Signer.provider!
    )
    const amountToSend = parseEther('0.000137')

    await (
      await this.testState.core.l2Signer.sendTransaction({
        to: randomUser.address,
        value: parseEther('0.1'),
      })
    ).wait()

    const withdrawEthRec = await (
      await this.testState.core.ethBridger.withdraw({
        amount: amountToSend,
        l2Signer: randomUser,
      })
    ).wait()

    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    this.testState.ethXChainWithdrawal.messageTxHash =
      withdrawEthRec.transactionHash
    this.testState.ethXChainWithdrawal.user = randomUser.privateKey
    this.testState.ethXChainWithdrawal.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const l2Signer = this.testState.core.l2Signer
    const l2Provider = l2Signer.provider!
    const l1User = new Wallet(
      this.testState.ethXChainWithdrawal.user!,
      this.testState.core.l1Signer.provider!
    )
    const l2TransactionReceipt = new L2TransactionReceipt(
      await l2Provider.getTransactionReceipt(
        this.testState.ethXChainWithdrawal.messageTxHash!
      )
    )
    const message = (
      await l2TransactionReceipt.getL2ToL1Messages(
        this.testState.core.l1Signer,
        l2Provider
      )
    )[0]

    const balBefore = await l1User.getBalance()
    expect(balBefore.toString(), 'eth withdrawal balance before not 0').to.eq(
      '0'
    )

    const outboxStatus = await message.status(l2Provider)
    expect(outboxStatus, 'eth withdrawal status not CONFIRMED').to.eq(
      L2ToL1MessageStatus.CONFIRMED
    )

    const execTx = await message.execute(l2Provider)
    await execTx.wait()
    expect(await message.status(l2Provider), 'executed status').to.eq(
      L2ToL1MessageStatus.EXECUTED
    )

    const userBalance = await l1User.getBalance()
    expect(userBalance.toString(), 'eth balance after xchain').to.eq(
      this.testState.ethXChainWithdrawal.balance!.toString()
    )
  }
}

/**
 * Check that an L1->L2 Eth deposit initiated before the migration
 * can be finalised after the migration.
 */
class EthDepositMigrationTest extends MigrationTest {
  public constructor(testState: TestState) {
    super(testState)
    this.name = 'Eth X chain deposit'
  }

  public override async initialise(): Promise<void> {
    const randomUser = Wallet.createRandom().connect(
      this.testState.core.l1Signer.provider!
    )
    const amountToSend = parseEther('0.000137')
    const ethBridger = this.testState.core.ethBridger

    await (
      await this.testState.core.l1Signer.sendTransaction({
        to: randomUser.address,
        value: parseEther('0.1'),
      })
    ).wait()

    const depositRes = await ethBridger.deposit({
      l1Signer: randomUser,
      l2Provider: this.testState.core.l2Signer.provider!,
      amount: amountToSend,
    })
    await depositRes.wait()

    this.testState.ethXChainDeposit.user = randomUser.privateKey
    this.testState.ethXChainDeposit.balance = amountToSend.toString()
  }

  public override async finalise(): Promise<void> {
    const l1User = new Wallet(
      this.testState.ethXChainDeposit.user!,
      this.testState.core.l2Signer.provider!
    )

    expect(
      (await l1User.getBalance()).toString(),
      'Eth X chain deposit balance'
    ).to.eq(this.testState.ethXChainDeposit.balance!.toString())
  }
}

interface TestState {
  fromFile: boolean
  core: {
    l1Signer: Wallet
    l2Signer: Wallet
    erc20Bridger: Erc20Bridger
    ethBridger: EthBridger
  }
  ethTransfer: {
    address?: string
    balance?: string
  }
  tokenDeploy: {
    address?: string
    name?: string
    symbol?: string
  }
  weth: {
    user?: string
    balance?: string
  }
  wethXChainDeposit: {
    messageTxHash?: string
    user?: string
    balance?: string
  }
  ethXChainDeposit: {
    user?: string
    balance?: string
  }
  wethXChainWithdrawal: {
    messageTxHash?: string
    user?: string
    balance?: string
  }
  ethXChainWithdrawal: {
    messageTxHash?: string
    user?: string
    balance?: string
  }
}

class MultiTest extends MigrationTest {
  public readonly tests: MigrationTest[]
  constructor(
    testState: TestState,
    testConstructors: (new (testState: TestState) => MigrationTest)[]
  ) {
    super(testState)
    this.tests = testConstructors.map(tc => new tc(testState))
  }

  public async initialise(): Promise<void> {
    for (const test of this.tests) {
      console.log(`Initialising ${test.name} test`)
      await test.initialise()
      console.log(`Initialising ${test.name} test completed`)
    }
    console.log('Tests initialised, ready for migration.')
  }

  public async finalise(): Promise<void> {
    console.log('Migration complete testing finalising tests')
    for (const test of this.tests) {
      console.log(`Finalising ${test.name} test`)
      await test.finalise()
      console.log(`Finalised ${test.name} test`)
    }
  }
}

type SerialisedTestState = Omit<TestState, 'core' | 'fromFile'> & {
  core: {
    l1Signer: string
    l2Signer: string
  }
}

describe('Migration tests', async () => {
  const writeTestStateToFile = (testState: TestState) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { core, fromFile, ...rest } = testState
    const serialisableTestState: SerialisedTestState = {
      core: {
        l1Signer: core.l1Signer.privateKey,
        l2Signer: core.l2Signer.privateKey,
      },
      ...rest,
    }

    fs.writeFileSync(
      path.join(__dirname, 'prevMigrationTestState.json'),
      JSON.stringify(serialisableTestState, null, 2)
    )
    console.log('prevMigrationTestState.json updated')
  }

  const initialiseTestState = async (): Promise<TestState> => {
    const { l2Signer, l1Signer, erc20Bridger, ethBridger } = await testSetup()
    // look for an existing teststate file
    const localNetworkFile = path.join(__dirname, 'migrationTestState.json')
    if (fs.existsSync(localNetworkFile)) {
      const testState = JSON.parse(
        fs.readFileSync(localNetworkFile).toString()
      ) as SerialisedTestState
      const l1Wallet = new Wallet(testState.core.l1Signer, l1Signer.provider!)
      const l2Wallet = new Wallet(testState.core.l2Signer, l2Signer.provider!)
      const l1Balance = await l1Wallet.getBalance()
      const l2Balance = await l2Wallet.getBalance()
      if (l1Balance.eq(0))
        throw new ArbSdkError(
          'L1 wallet loaded from teststate has not balance. Is the teststate file up to date.'
        )
      if (l2Balance.eq(0))
        throw new ArbSdkError(
          'L2 wallet loaded from teststate has not balance. Is the teststate file up to date.'
        )

      return {
        ...testState,
        core: {
          l1Signer: l1Wallet,
          l2Signer: l2Wallet,
          erc20Bridger: erc20Bridger,
          ethBridger: ethBridger,
        },
        fromFile: true,
      }
    } else {
      await fundL1(l1Signer, parseEther('20'))
      await fundL2(l2Signer, parseEther('20'))

      return {
        fromFile: false,
        core: {
          l2Signer,
          l1Signer,
          erc20Bridger,
          ethBridger,
        },
        ethTransfer: {},
        tokenDeploy: {},
        weth: {},
        wethXChainDeposit: {},
        wethXChainWithdrawal: {},
        ethXChainWithdrawal: {},
        ethXChainDeposit: {},
      }
    }
  }

  it('all together', async () => {
    const testState = await initialiseTestState()
    const multiTest = new MultiTest(testState, [
      /**
       * Check that a receiver of eth just before the migration
       * still has it after the migration
       */
      EthTransferMigrationTest,
      /**
       * Check that an ERC20 created just before the migration has the same
       * symbol and name after the migration
       */
      Erc20CreationMigrationTest,
      /**
       * Check that a user who deposits into the weth contract just before migration
       * still has it after the migration
       */
      WethBalanceMigrationTest,
      /**
       * Check that an L1->L2 weth deposit initiated before the migration
       * can be redeemed after the migration.
       */
      WethDepositMigrationTest,
      /**
       * Checks that a weth withdrawal that was started before the migration
       * can be completed after the migration
       */
      WethWithdrawalMigrationTest,
      /**
       * Check that an Eth withdrawal initiated before the migration
       * completes successfully after the migration
       */
      EthWithdrawalMigrationTest,
      /**
       * Check that an L1->L2 Eth deposit initiated before the migration
       * can be finalised after the migration.
       */
      EthDepositMigrationTest,
    ])

    if (!testState.fromFile) {
      // if we loaded the teststate from file it must mean it
      // was already initialised
      await multiTest.initialise()
      writeTestStateToFile(testState)
    }

    await waitForNitro(
      testState.core.l2Signer.provider!,
      testState.fromFile ? 0 : 150000
    )

    await multiTest.finalise()
  })
})
