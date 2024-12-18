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
  fundParentSigner,
  fundChildSigner,
  skipIfMainnet,
  withdrawToken,
  GatewayType,
  depositToken,
} from './testHelpers'
import { ParentToChildMessageStatus } from '../../src'
import { Wallet } from 'ethers'
import { testSetup } from '../testSetup'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { describeOnlyWhenEth } from './custom-fee-token/mochaExtensions'

describeOnlyWhenEth('WETH', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('deposit WETH', async () => {
    const { childChain, parentSigner, childSigner, erc20Bridger } =
      await testSetup()

    const parentWethAddress = childChain.tokenBridge.parentWeth

    const wethToWrap = parseEther('0.00001')
    const wethToDeposit = parseEther('0.0000001')

    await fundParentSigner(parentSigner, parseEther('1'))

    const childWETH = AeWETH__factory.connect(
      childChain.tokenBridge.childWeth,
      childSigner.provider!
    )
    expect(
      (await childWETH.balanceOf(await childSigner.getAddress())).toString(),
      'start balance weth'
    ).to.eq('0')

    const parentWETH = AeWETH__factory.connect(parentWethAddress, parentSigner)
    const res = await parentWETH.deposit({
      value: wethToWrap,
    })
    await res.wait()
    await depositToken({
      depositAmount: wethToDeposit,
      parentTokenAddress: parentWethAddress,
      erc20Bridger,
      parentSigner,
      childSigner,
      expectedStatus: ParentToChildMessageStatus.REDEEMED,
      expectedGatewayType: GatewayType.WETH,
    })

    const childWethGateway = await erc20Bridger.getChildGatewayAddress(
      parentWethAddress,
      childSigner.provider!
    )
    expect(childWethGateway, 'child weth gateway').to.eq(
      childChain.tokenBridge.childWethGateway
    )
    const childToken = erc20Bridger.getChildTokenContract(
      childSigner.provider!,
      childChain.tokenBridge.childWeth
    )
    expect(childToken.address, 'child weth').to.eq(
      childChain.tokenBridge.childWeth
    )

    // now try to withdraw the funds
    await fundChildSigner(childSigner)
    const childWeth = AeWETH__factory.connect(childToken.address, childSigner)
    const randomAddr = Wallet.createRandom().address
    await (
      await childWeth.connect(childSigner).withdrawTo(randomAddr, wethToDeposit)
    ).wait()
    const afterBalance = await childSigner.provider!.getBalance(randomAddr)

    expect(afterBalance.toString(), 'balance after').to.eq(
      wethToDeposit.toString()
    )
  })

  it('withdraw WETH', async () => {
    const wethToWrap = parseEther('0.00001')
    const wethToWithdraw = parseEther('0.00000001')

    const { childChain, parentSigner, childSigner, erc20Bridger } =
      await testSetup()
    await fundParentSigner(parentSigner)
    await fundChildSigner(childSigner)

    const childWeth = AeWETH__factory.connect(
      childChain.tokenBridge.childWeth,
      childSigner
    )
    const res = await childWeth.deposit({
      value: wethToWrap,
    })
    const rec = await res.wait()
    expect(rec.status).to.equal(1, 'deposit txn failed')

    await withdrawToken({
      amount: wethToWithdraw,
      erc20Bridger: erc20Bridger,
      gatewayType: GatewayType.WETH,
      parentSigner: parentSigner,
      parentToken: ERC20__factory.connect(
        childChain.tokenBridge.parentWeth,
        parentSigner.provider!
      ),
      childSigner: childSigner,
      startBalance: wethToWrap,
    })
  })
})
