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
import { parseEther } from '@ethersproject/units'
import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { L1CustomGateway__factory } from '../src/lib/abi/factories/L1CustomGateway__factory'
import { L1GatewayRouter__factory } from '../src/lib/abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../src/lib/abi/factories/L2GatewayRouter__factory'
import { TestArbCustomToken__factory } from '../src/lib/abi/factories/TestArbCustomToken__factory'
import { TestCustomTokenL1 } from '../src/lib/abi/TestCustomTokenL1'
import { TestCustomTokenL1__factory } from '../src/lib/abi/factories/TestCustomTokenL1__factory'

import {
  fundL1,
  fundL2,
  skipIfMainnet,
  depositToken,
  GatewayType,
  withdrawToken,
} from './testHelpers'
import { isNitroL1, L1ToL2MessageStatus, L2Network } from '../src'
import { Signer, constants } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { testSetup } from '../scripts/testSetup'
import { ERC20__factory } from '../src/lib/abi/factories/ERC20__factory'

const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('Custom ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // test globals
  let testState: {
    l1Signer: Signer
    l2Signer: Signer
    adminErc20Bridger: AdminErc20Bridger
    l2Network: L2Network
    l1CustomToken: TestCustomTokenL1
  }

  before('init', async () => {
    testState = {
      ...(await testSetup()),
      l1CustomToken: {} as any,
    }
    const l2ChainId = await testState.l2Signer.getChainId()
    await fundL1(testState.l1Signer, parseEther('0.01'))
    if (await isNitroL1(l2ChainId, testState.l1Signer)) {
      await fundL2(testState.l2Signer, parseEther('0.5'))
    } else {
      await fundL2(testState.l2Signer)
    }
  })

  it('register custom token', async () => {
    const { l1CustomToken: l1Token } = await registerCustomToken(
      testState.l2Network,
      testState.l1Signer,
      testState.l2Signer,
      testState.adminErc20Bridger
    )
    testState.l1CustomToken = l1Token
  })

  it('deposit', async () => {
    await (
      await testState.l1CustomToken.connect(testState.l1Signer).mint()
    ).wait()
    await depositToken(
      depositAmount,
      testState.l1CustomToken.address,
      testState.adminErc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.REDEEMED,
      GatewayType.CUSTOM
    )
  })

  it('withdraws erc20', async function () {
    await withdrawToken({
      ...testState,
      erc20Bridger: testState.adminErc20Bridger,
      amount: withdrawalAmount,
      gatewayType: GatewayType.CUSTOM,
      startBalance: depositAmount,
      l1Token: ERC20__factory.connect(
        testState.l1CustomToken.address,
        testState.l1Signer.provider!
      ),
    })
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

  // send the messages
  const regTx = await adminErc20Bridger.registerCustomToken(
    l1CustomToken.address,
    l2CustomToken.address,
    l1Signer,
    l2Signer.provider!
  )
  const regRec = await regTx.wait()

  // wait on messages
  const l1ToL2Messages = await regRec.getL1ToL2Messages(l2Signer.provider!)
  expect(l1ToL2Messages.length, 'Should be 2 messages.').to.eq(2)

  const setTokenTx = await l1ToL2Messages[0].waitForStatus()
  expect(setTokenTx.status, 'Set token not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )

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

  const endL2GatewayAddress = await l2GatewayRouter.l1TokenToGateway(
    l1CustomToken.address
  )
  expect(
    endL2GatewayAddress,
    'End l2GatewayAddress not equal to l2 custom gateway'
  ).to.eq(l2Network.tokenBridge.l2CustomGateway)

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
