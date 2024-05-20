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
import { AeWETH__factory } from '../../src/lib/abi/factories/AeWETH__factory'
import {
  fundL1,
  fundL2,
  skipIfMainnet,
  withdrawToken,
  GatewayType,
  depositToken,
} from './testHelpers'
import { L1ToL2MessageStatus } from '../../src'
import { Wallet } from 'ethers'
import { testSetup } from '../../scripts/testSetup'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { describeOnlyWhenEth } from './custom-fee-token/mochaExtensions'

describeOnlyWhenEth('WETH', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('deposit WETH', async () => {
    const { l2Network, l1Signer, l2Signer, erc20Bridger } = await testSetup()

    const l1WethAddress = l2Network.tokenBridge.l1Weth

    const wethToWrap = parseEther('0.00001')
    const wethToDeposit = parseEther('0.0000001')

    await fundL1(l1Signer, parseEther('1'))

    const l2WETH = AeWETH__factory.connect(
      l2Network.tokenBridge.l2Weth,
      l2Signer.provider!
    )
    expect(
      (await l2WETH.balanceOf(await l2Signer.getAddress())).toString(),
      'start balance weth'
    ).to.eq('0')

    const l1WETH = AeWETH__factory.connect(l1WethAddress, l1Signer)
    const res = await l1WETH.deposit({
      value: wethToWrap,
    })
    await res.wait()
    await depositToken({
      depositAmount: wethToDeposit,
      l1TokenAddress: l1WethAddress,
      erc20Bridger,
      l1Signer,
      l2Signer,
      expectedStatus: L1ToL2MessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.WETH,
    })

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

    // now try to withdraw the funds
    await fundL2(l2Signer)
    const l2Weth = AeWETH__factory.connect(l2Token.address, l2Signer)
    const randomAddr = Wallet.createRandom().address
    await (
      await l2Weth.connect(l2Signer).withdrawTo(randomAddr, wethToDeposit)
    ).wait()
    const afterBalance = await l2Signer.provider!.getBalance(randomAddr)

    expect(afterBalance.toString(), 'balance after').to.eq(
      wethToDeposit.toString()
    )
  })

  it('withdraw WETH', async () => {
    const wethToWrap = parseEther('0.00001')
    const wethToWithdraw = parseEther('0.00000001')

    const { l2Network, l1Signer, l2Signer, erc20Bridger } = await testSetup()
    await fundL1(l1Signer)
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

    await withdrawToken({
      amount: wethToWithdraw,
      erc20Bridger: erc20Bridger,
      gatewayType: GatewayType.WETH,
      l1Signer: l1Signer,
      l1Token: ERC20__factory.connect(
        l2Network.tokenBridge.l1Weth,
        l1Signer.provider!
      ),
      l2Signer: l2Signer,
      startBalance: wethToWrap,
    })
  })
})
