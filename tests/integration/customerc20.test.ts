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
import { Signer, Wallet, constants, utils } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { L1CustomGateway__factory } from '../../src/lib/abi/factories/L1CustomGateway__factory'
import { L1GatewayRouter__factory } from '../../src/lib/abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../../src/lib/abi/factories/L2GatewayRouter__factory'
import { TestArbCustomToken__factory } from '../../src/lib/abi/factories/TestArbCustomToken__factory'
import { TestOrbitCustomTokenL1 } from '../../src/lib/abi/TestOrbitCustomTokenL1'
import { TestOrbitCustomTokenL1__factory } from '../../src/lib/abi/factories/TestOrbitCustomTokenL1__factory'
import { TestCustomTokenL1 } from '../../src/lib/abi/TestCustomTokenL1'
import { TestCustomTokenL1__factory } from '../../src/lib/abi/factories/TestCustomTokenL1__factory'

import {
  fundParentSigner,
  fundChildSigner,
  skipIfMainnet,
  depositToken,
  GatewayType,
  withdrawToken,
} from './testHelpers'
import { ParentToChildMessageStatus } from '../../src'
import {
  ArbitrumNetwork,
  assertArbitrumNetworkHasTokenBridge,
} from '../../src/lib/dataEntities/networks'
import { AdminErc20Bridger } from '../../src/lib/assetBridger/erc20Bridger'
import { testSetup } from '../../scripts/testSetup'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import {
  fundParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
} from './custom-fee-token/customFeeTokenTestHelpers'

const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('Custom ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // test globals
  let testState: {
    parentSigner: Signer
    childSigner: Signer
    adminErc20Bridger: AdminErc20Bridger
    childChain: ArbitrumNetwork
    parentCustomToken: TestCustomTokenL1 | TestOrbitCustomTokenL1
  }

  before('init', async () => {
    testState = {
      ...(await testSetup()),
      parentCustomToken: {} as any,
    }
    await fundParentSigner(testState.parentSigner)
    await fundChildSigner(testState.childSigner)

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(testState.parentSigner)
    }
  })

  it('register custom token', async () => {
    const { parentCustomToken: parentToken } = await registerCustomToken(
      testState.childChain,
      testState.parentSigner,
      testState.childSigner,
      testState.adminErc20Bridger
    )
    testState.parentCustomToken = parentToken
  })

  it('deposit', async () => {
    await (
      await testState.parentCustomToken.connect(testState.parentSigner).mint()
    ).wait()
    await depositToken({
      depositAmount,
      parentTokenAddress: testState.parentCustomToken.address,
      erc20Bridger: testState.adminErc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.CUSTOM,
    })
  })

  it('withdraws erc20', async function () {
    await withdrawToken({
      ...testState,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      erc20Bridger: testState.adminErc20Bridger,
      amount: withdrawalAmount,
      gatewayType: GatewayType.CUSTOM,
      startBalance: depositAmount,
      parentToken: ERC20__factory.connect(
        testState.parentCustomToken.address,
        testState.parentSigner.provider!
      ),
    })
  })

  it('deposits erc20 with extra ETH', async () => {
    await depositToken({
      depositAmount,
      ethDepositAmount: utils.parseEther('0.0005'),
      parentTokenAddress: testState.parentCustomToken.address,
      erc20Bridger: testState.adminErc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.CUSTOM,
    })
  })

  it('deposits erc20 with extra ETH to a specific child chain address', async () => {
    const randomAddress = Wallet.createRandom().address
    await depositToken({
      depositAmount,
      ethDepositAmount: utils.parseEther('0.0005'),
      parentTokenAddress: testState.parentCustomToken.address,
      erc20Bridger: testState.adminErc20Bridger,
      parentSigner: testState.parentSigner,
      childSigner: testState.childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.CUSTOM,
      destinationAddress: randomAddress,
    })
  })
})

const registerCustomToken = async (
  childChain: ArbitrumNetwork,
  parentSigner: Signer,
  childSigner: Signer,
  adminErc20Bridger: AdminErc20Bridger
) => {
  // create a custom token on Parent and Child
  const parentCustomTokenFactory = isArbitrumNetworkWithCustomFeeToken()
    ? new TestOrbitCustomTokenL1__factory(parentSigner)
    : new TestCustomTokenL1__factory(parentSigner)
  const parentCustomToken = await parentCustomTokenFactory.deploy(
    childChain.tokenBridge.l1CustomGateway,
    childChain.tokenBridge.l1GatewayRouter
  )
  await parentCustomToken.deployed()

  const childCustomTokenFac = new TestArbCustomToken__factory(childSigner)
  const childCustomToken = await childCustomTokenFac.deploy(
    childChain.tokenBridge.l2CustomGateway,
    parentCustomToken.address
  )
  await childCustomToken.deployed()

  // check starting conditions - should initially use the default gateway
  const l1GatewayRouter = new L1GatewayRouter__factory(parentSigner).attach(
    childChain.tokenBridge.l1GatewayRouter
  )
  const l2GatewayRouter = new L2GatewayRouter__factory(childSigner).attach(
    childChain.tokenBridge.l2GatewayRouter
  )
  const l1CustomGateway = new L1CustomGateway__factory(parentSigner).attach(
    childChain.tokenBridge.l1CustomGateway
  )
  const l2CustomGateway = new L1CustomGateway__factory(childSigner).attach(
    childChain.tokenBridge.l2CustomGateway
  )
  const startParentGatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    parentCustomToken.address
  )
  expect(
    startParentGatewayAddress,
    'Start parentGatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startChildGatewayAddress = await l2GatewayRouter.l1TokenToGateway(
    childCustomToken.address
  )
  expect(
    startChildGatewayAddress,
    'Start childGatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startParentErc20Address = await l1CustomGateway.l1ToL2Token(
    parentCustomToken.address
  )
  expect(
    startParentErc20Address,
    'Start parentErc20Address not equal empty address'
  ).to.eq(constants.AddressZero)
  const startChildErc20Address = await l2CustomGateway.l1ToL2Token(
    parentCustomToken.address
  )
  expect(
    startChildErc20Address,
    'Start childErc20Address not equal empty address'
  ).to.eq(constants.AddressZero)

  // it should fail without the approval
  if (isArbitrumNetworkWithCustomFeeToken()) {
    try {
      const regTx = await adminErc20Bridger.registerCustomToken(
        parentCustomToken.address,
        childCustomToken.address,
        parentSigner,
        childSigner.provider!
      )
      await regTx.wait()
      throw new Error('Child custom token is not approved but got deployed')
    } catch (err) {
      expect((err as Error).message).to.contain('Insufficient allowance')
    }
  }

  if (isArbitrumNetworkWithCustomFeeToken()) {
    await adminErc20Bridger.approveGasTokenForCustomTokenRegistration({
      parentSigner,
      erc20ParentAddress: parentCustomToken.address,
    })
  }

  // send the messages
  const regTx = await adminErc20Bridger.registerCustomToken(
    parentCustomToken.address,
    childCustomToken.address,
    parentSigner,
    childSigner.provider!
  )
  const regRec = await regTx.wait()

  // wait on messages
  const parentToChildMessages = await regRec.getParentToChildMessages(
    childSigner.provider!
  )
  expect(parentToChildMessages.length, 'Should be 2 messages.').to.eq(2)

  const setTokenTx = await parentToChildMessages[0].waitForStatus()
  expect(setTokenTx.status, 'Set token not redeemed.').to.eq(
    ParentToChildMessageStatus.REDEEMED
  )

  const setGateways = await parentToChildMessages[1].waitForStatus()
  expect(setGateways.status, 'Set gateways not redeemed.').to.eq(
    ParentToChildMessageStatus.REDEEMED
  )

  // check end conditions
  const endParentGatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    parentCustomToken.address
  )
  expect(
    endParentGatewayAddress,
    'End parentGatewayAddress not equal to parent custom gateway'
  ).to.eq(childChain.tokenBridge.l1CustomGateway)

  const endChildGatewayAddress = await l2GatewayRouter.l1TokenToGateway(
    parentCustomToken.address
  )
  expect(
    endChildGatewayAddress,
    'End childGatewayAddress not equal to child custom gateway'
  ).to.eq(childChain.tokenBridge.l2CustomGateway)

  const endParentErc20Address = await l1CustomGateway.l1ToL2Token(
    parentCustomToken.address
  )
  expect(
    endParentErc20Address,
    'End parentErc20Address not equal parentCustomToken address'
  ).to.eq(childCustomToken.address)

  const endChildErc20Address = await l2CustomGateway.l1ToL2Token(
    parentCustomToken.address
  )
  expect(
    endChildErc20Address,
    'End childErc20Address not equal childCustomToken address'
  ).to.eq(childCustomToken.address)

  return {
    parentCustomToken,
    childCustomToken,
  }
}
