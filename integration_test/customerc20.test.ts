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
import { Wallet } from '@ethersproject/wallet'

import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)

import { L1CustomGateway__factory } from '../src/lib/abi/factories/L1CustomGateway__factory'
import { L1GatewayRouter__factory } from '../src/lib/abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../src/lib/abi/factories/L2GatewayRouter__factory'
import { TestArbCustomToken__factory } from '../src/lib/abi/factories/TestArbCustomToken__factory'
import { TestCustomTokenL1__factory } from '../src/lib/abi/factories/TestCustomTokenL1__factory'
import { TestERC20__factory } from '../src/lib/abi/factories/TestERC20__factory'

import { L2ToL1MessageStatus } from '../src/lib/message/L2ToL1Message'

import {
  fundL1,
  fundL2,
  testRetryableTicket,
  instantiateBridgeWithRandomWallet,
  skipIfMainnet,
} from './testHelpers'
import { L1ToL2MessageStatus, Erc20Bridger, L2Network } from '../src'
import { Signer, constants } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'

const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('Custom ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // CHRIS: TODO: properly refactor L1 test case
  // CHRIS: TODO: important test case for address alias - also do something that's under the offset, or at the offset

  // CHRIS: TODO: remove
  it.skip('deploy', async () => {
    const { l1Network, l2Network } = await instantiateBridgeWithRandomWallet()
    console.log('l1network', l1Network)
    console.log('l2network', l2Network)
  })

  it.skip('deposits erc20 (no L2 Eth funding)', async () => {
    const {
      l1Signer,
      l2Signer,
      adminErc20Bridger,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await depositTokenTest(adminErc20Bridger, l1Signer, l2Signer)
  })

  it.skip('deposits erc20 (with L2 Eth funding)', async () => {
    const {
      l1Signer,
      l2Signer,
      adminErc20Bridger,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await fundL2(l2Signer)
    await depositTokenTest(adminErc20Bridger, l1Signer, l2Signer)
  })

  it('register custom token', async () => {
    const {
      l2Network,
      l2Signer,
      l1Signer,
      adminErc20Bridger,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    await registerCustomToken(l2Network, l1Signer, l2Signer, adminErc20Bridger)
  })

  // CHRIS: TODO: why do we have this?
  it('deposits erc20 and transfer to funding wallet', async () => {
    const {
      l1Signer,
      l2Signer,
      adminErc20Bridger,
    } = await instantiateBridgeWithRandomWallet()
    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const testToken = await depositTokenTest(
      adminErc20Bridger,
      l1Signer,
      l2Signer
    )
    const l2Token = adminErc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      await adminErc20Bridger.getL2ERC20Address(
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
      l2Network,
      l2Signer,
      l1Signer,
      adminErc20Bridger,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    await fundL2(l2Signer)
    const testToken = await depositTokenTest(
      adminErc20Bridger,
      l1Signer,
      l2Signer
    )

    const l2Token = adminErc20Bridger.getL2TokenContract(
      l2Signer.provider!,
      await adminErc20Bridger.getL2ERC20Address(
        testToken.address,
        l1Signer.provider!
      )
    )

    const withdrawRes = await adminErc20Bridger.withdraw({
      amount: withdrawalAmount,
      erc20l1Address: testToken.address,
      l2Signer: l2Signer,
    })
    const withdrawRec = await withdrawRes.wait()

    expect(withdrawRec.status).to.equal(1, 'initiate token withdraw txn failed')

    const message = (
      await withdrawRec.getL2ToL1Messages(l1Signer.provider!, l2Network)
    )[0]
    expect(message, 'withdrawEventData not found').to.exist

    const messageStatus = await message.status(null, withdrawRec.blockHash)
    expect(
      messageStatus === L2ToL1MessageStatus.UNCONFIRMED,
      `custom token withdraw status returned ${messageStatus}`
    ).to.be.true

    const testWalletL2Balance = await l2Token.balanceOf(
      await l2Signer.getAddress()
    )
    expect(
      testWalletL2Balance.toNumber(),
      'token withdraw balance not deducted'
    ).to.eq(depositAmount.sub(withdrawalAmount).toNumber())
    const walletAddress = await l1Signer.getAddress()

    const gatewayAddress = await adminErc20Bridger.getL2GatewayAddress(
      testToken.address,
      l2Signer.provider!
    )
    expect(gatewayAddress, 'Gateway is not custom gateway').to.eq(
      adminErc20Bridger.l2Network.tokenBridge.l2CustomGateway
    )

    const gatewayWithdrawEvents = await adminErc20Bridger.getL2WithdrawalEvents(
      l2Signer.provider!,
      gatewayAddress,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      testToken.address,
      walletAddress
    )
    expect(gatewayWithdrawEvents.length).to.equal(
      1,
      'token custom gateway query failed'
    )
  })
})

const registerCustomToken = async (
  l2Network: L2Network,
  l1Signer: Signer,
  l2Signer: Signer,
  adminErc20Bridger: AdminErc20Bridger
) => {
  // create a custom token on L1 and L2
  const l1CustomTokenFac = new TestCustomTokenL1__factory(l1Signer)
  const l1CustomToken = await l1CustomTokenFac.deploy(
    l2Network.tokenBridge.l1CustomGateway,
    l2Network.tokenBridge.l1GatewayRouter
  )
  await l1CustomToken.deployed()

  const l2CustomTokenFac = new TestArbCustomToken__factory(l2Signer)
  const l2CustomToken = await l2CustomTokenFac.deploy(
    l2Network.tokenBridge.l2CustomGateway,
    l1CustomToken.address
  )
  await l2CustomToken.deployed()

  // check starting conditions - should initially use the default gateway
  const l1GatewayRouter = new L1GatewayRouter__factory(l1Signer).attach(
    l2Network.tokenBridge.l1GatewayRouter
  )
  const l2GatewayRouter = new L2GatewayRouter__factory(l2Signer).attach(
    l2Network.tokenBridge.l2GatewayRouter
  )
  const l1CustomGateway = new L1CustomGateway__factory(l1Signer).attach(
    l2Network.tokenBridge.l1CustomGateway
  )
  const l2CustomGateway = new L1CustomGateway__factory(l2Signer).attach(
    l2Network.tokenBridge.l2CustomGateway
  )
  const startL1GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l1CustomToken.address
  )
  expect(
    startL1GatewayAddress,
    'Start l1GatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL2GatewayAddress = await l2GatewayRouter.l1TokenToGateway(
    l2CustomToken.address
  )
  expect(
    startL2GatewayAddress,
    'Start l2GatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL1Erc20Address = await l1CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    startL1Erc20Address,
    'Start l1Erc20Address not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL2Erc20Address = await l2CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    startL2Erc20Address,
    'Start l2Erc20Address not equal empty address'
  ).to.eq(constants.AddressZero)

  console.log('a')
  // send the messages
  const regTx = await adminErc20Bridger.registerCustomToken(
    l1CustomToken.address,
    l2CustomToken.address,
    l1Signer,
    l2Signer.provider!
  )
  console.log('b')
  const regRec = await regTx.wait()
  console.log('c')

  // wait on messages
  const l1ToL2Messages = await regRec.getL1ToL2Messages(l2Signer.provider!)
  console.log('d')
  expect(l1ToL2Messages.length, 'Should be 2 messages.').to.eq(2)

  console.log('logs', regRec.logs)

  const setTokenTx = await l1ToL2Messages[0].waitForStatus()
  console.log('e')
  expect(setTokenTx.status, 'Set token not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )

  // ChainId   *big.Int
  // RequestId common.Hash
  // From      common.Address
  // L1BaseFee *big.Int

  // DepositValue     *big.Int 114888000206080
  // GasFeeCap        *big.Int        // wei per gas 1000000000
  // Gas              uint64          // gas limit 114888
  // To               *common.Address `rlp:"nil"` // nil means contract creation
  // Value            *big.Int        // wei amount 0?
  // Beneficiary      common.Address 0x91EfB51E57AE53569CAf11445F7f156e1E87445a
  // MaxSubmissionFee *big.Int 206080
  // FeeRefundAddr    common.Address 0x91EfB51E57AE53569CAf11445F7f156e1E87445a?
  // Data             []byte // contract invocation input data

  // f9015583066eeca
  // 0000000000000000000000000000000000000000000000000000000000000052f
  // 94
  //   10da8231ef2fd1f77106e10581a1fac14e29e125
  // 01
  //   10da8231ef2fd1f77106e10581a1fac14e29e125

  // 0x01
  // 10da8231ef 2fd1f77106 e10581a1fa c14e29e125
  // 0786688308f3e500843b9aca008301c0e0947b650845242a96595f3a9766d4e8e5ab0887936a80945ae928b031bec25dd6de505d80aa98942219b7a183032500945ae928b031bec25dd6de505d80aa98942219b7a1b8c44201f98500000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000000000000084d4b8072bb473fc04f561ebdcdef66cd74b39970000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f0b003f9247f2dc0e874710ed55e55f8c63b14a3

  0x0110da8231ef2fd1f77106e10581a1fac14e29e125

  console.log('f')
  const setGateways = await l1ToL2Messages[1].waitForStatus()
  expect(setGateways.status, 'Set gateways not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )

  // check end conditions
  const endL1GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l1CustomToken.address
  )
  expect(
    endL1GatewayAddress,
    'End l1GatewayAddress not equal to l1 custom gateway'
  ).to.eq(l2Network.tokenBridge.l1CustomGateway)
  const endL2GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l2CustomToken.address
  )
  expect(
    endL2GatewayAddress,
    'End l2GatewayAddress not equal to l1 custom gateway'
  ).to.eq(l2Network.tokenBridge.l1CustomGateway)

  const endL1Erc20Address = await l1CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    endL1Erc20Address,
    'End l1Erc20Address not equal l1CustomToken address'
  ).to.eq(l2CustomToken.address)
  const endL2Erc20Address = await l2CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    endL2Erc20Address,
    'End l2Erc20Address not equal l2CustomToken address'
  ).to.eq(l2CustomToken.address)

  return {
    l1CustomToken,
    l2CustomToken,
  }
}

const depositTokenTest = async (
  adminErc20Bridger: AdminErc20Bridger,
  l1Signer: Signer,
  l2Signer: Signer
) => {
  const { l1CustomToken: testToken } = await registerCustomToken(
    adminErc20Bridger.l2Network,
    l1Signer,
    l2Signer,
    adminErc20Bridger
  )

  await (await testToken.mint()).wait()
  await (
    await adminErc20Bridger.approveToken({
      erc20L1Address: testToken.address,
      l1Signer: l1Signer,
    })
  ).wait()

  const expectedL1GatewayAddress = await adminErc20Bridger.getL1GatewayAddress(
    testToken.address,
    l1Signer.provider!
  )
  const l1Token = adminErc20Bridger.getL1TokenContract(
    l1Signer.provider!,
    testToken.address
  )
  const allowance = await l1Token.allowance(
    await l1Signer.getAddress(),
    expectedL1GatewayAddress
  )

  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  const initialBridgeTokenBalance = await testToken.balanceOf(
    expectedL1GatewayAddress
  )

  const depositRes = await adminErc20Bridger.deposit({
    erc20L1Address: testToken.address,
    amount: depositAmount,
    l1Signer: l1Signer,
    l2Provider: l2Signer.provider!,
  })

  const depositRec = await depositRes.wait()
  console.log('exited')

  const finalBridgeTokenBalance = await testToken.balanceOf(
    expectedL1GatewayAddress
  )

  expect(
    initialBridgeTokenBalance.add(depositAmount).toNumber(),
    'bridge balance not properly updated after deposit'
  ).to.be.eq(finalBridgeTokenBalance.toNumber())
  await testRetryableTicket(l2Signer.provider!, depositRec)

  const l2Token = adminErc20Bridger.getL2TokenContract(
    l2Signer.provider!,
    await adminErc20Bridger.getL2ERC20Address(
      testToken.address,
      l1Signer.provider!
    )
  )
  const testWalletL2Balance = (
    await l2Token.functions.balanceOf(await l2Signer.getAddress())
  )[0]

  expect(
    testWalletL2Balance.eq(depositAmount),
    "l2 wallet balance not properly updated after deposit'"
  ).to.be.true

  return testToken
}
