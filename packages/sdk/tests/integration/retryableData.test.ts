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

import { assert, expect } from 'chai'
import { BigNumber } from '@ethersproject/bignumber'
import { hexlify } from '@ethersproject/bytes'
import { TestERC20__factory } from '../../src/lib/abi/factories/TestERC20__factory'
import { fundParentSigner, skipIfMainnet } from './testHelpers'
import { RetryableDataTools } from '../../src'
import { Wallet } from 'ethers'
import { testSetup } from '../testSetup'
import { parseEther, randomBytes } from 'ethers/lib/utils'
import { Inbox__factory } from '../../src/lib/abi/factories/Inbox__factory'
import { GasOverrides } from '../../src/lib/message/ParentToChildMessageGasEstimator'
const depositAmount = BigNumber.from(100)
import { ERC20Inbox__factory } from '../../src/lib/abi/factories/ERC20Inbox__factory'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import {
  getNativeTokenDecimals,
  scaleFrom18DecimalsToNativeTokenDecimals,
} from '../../src/lib/utils/lib'

describe('RevertData', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  const createRevertParams = async () => {
    const l2CallValue = BigNumber.from(137)
    const maxSubmissionCost = BigNumber.from(1618)

    const { parentProvider, childChain } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    return {
      to: Wallet.createRandom().address,
      excessFeeRefundAddress: Wallet.createRandom().address,
      callValueRefundAddress: Wallet.createRandom().address,
      l2CallValue,
      data: hexlify(randomBytes(32)),
      maxSubmissionCost: maxSubmissionCost,
      value: scaleFrom18DecimalsToNativeTokenDecimals({
        amount: l2CallValue
          .add(maxSubmissionCost)
          .add(RetryableDataTools.ErrorTriggeringParams.gasLimit)
          .add(RetryableDataTools.ErrorTriggeringParams.maxFeePerGas),
        decimals,
      }),
      gasLimit: RetryableDataTools.ErrorTriggeringParams.gasLimit,
      maxFeePerGas: RetryableDataTools.ErrorTriggeringParams.maxFeePerGas,
    }
  }

  const testRetryableDataParsing = async (
    func: 'estimateGas' | 'callStatic'
  ) => {
    const { parentSigner, childChain } = await testSetup()
    await fundParentSigner(parentSigner)

    const {
      to,
      l2CallValue,
      maxSubmissionCost,
      excessFeeRefundAddress,
      callValueRefundAddress,
      data,
      value,
      gasLimit,
      maxFeePerGas,
    } = await createRevertParams()

    try {
      if (isArbitrumNetworkWithCustomFeeToken()) {
        const inbox = ERC20Inbox__factory.connect(
          childChain.ethBridge.inbox,
          parentSigner
        )
        await inbox[func].createRetryableTicket(
          to,
          l2CallValue,
          maxSubmissionCost,
          excessFeeRefundAddress,
          callValueRefundAddress,
          gasLimit,
          maxFeePerGas,
          value,
          data
        )
      } else {
        const inbox = Inbox__factory.connect(
          childChain.ethBridge.inbox,
          parentSigner
        )
        await inbox[func].createRetryableTicket(
          to,
          l2CallValue,
          maxSubmissionCost,
          excessFeeRefundAddress,
          callValueRefundAddress,
          gasLimit,
          maxFeePerGas,
          data,
          { value }
        )
      }

      assert.fail(`Expected ${func} to fail`)
    } catch (err) {
      const typedErr = err as Error
      const parsed = RetryableDataTools.tryParseError(typedErr)
      if (!parsed) throw err
      expect(parsed.callValueRefundAddress, 'callValueRefundAddress').to.eq(
        callValueRefundAddress
      )
      expect(parsed.data, 'data').to.eq(data)
      expect(parsed.deposit.toString(), 'deposit').to.eq(value.toString())
      expect(parsed.excessFeeRefundAddress, 'excessFeeRefundAddress').to.eq(
        excessFeeRefundAddress
      )
      expect(parsed.from, 'from').to.eq(await parentSigner.getAddress())
      expect(parsed.gasLimit.toString(), 'gasLimit').to.eq(gasLimit.toString())
      expect(parsed.l2CallValue.toString(), 'l2CallValue').to.eq(
        l2CallValue.toString()
      )
      expect(parsed.maxFeePerGas.toString(), 'maxFeePerGas').to.eq(
        maxFeePerGas.toString()
      )
      expect(parsed.maxSubmissionCost.toString(), 'maxSubmissionCost').to.eq(
        maxSubmissionCost.toString()
      )
      expect(parsed.to, 'to').to.eq(to)
    }
  }

  it('does parse error in estimate gas', async () => {
    await testRetryableDataParsing('estimateGas')
  })

  it('does parse from callStatic', async () => {
    await testRetryableDataParsing('callStatic')
  })

  it('is the same as what we estimate in erc20Bridger', async () => {
    const { erc20Bridger, parentSigner, childSigner } = await testSetup()
    await fundParentSigner(parentSigner, parseEther('2'))

    const deployErc20 = new TestERC20__factory().connect(parentSigner)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()
    const parentTokenAddress = testToken.address

    await (
      await erc20Bridger.approveToken({
        erc20ParentAddress: parentTokenAddress,
        parentSigner,
      })
    ).wait()

    if (isArbitrumNetworkWithCustomFeeToken()) {
      // approve the custom fee token
      await (
        await erc20Bridger.approveGasToken({
          erc20ParentAddress: parentTokenAddress,
          parentSigner,
        })
      ).wait()
    }

    const retryableOverrides: GasOverrides = {
      maxFeePerGas: {
        base: RetryableDataTools.ErrorTriggeringParams.maxFeePerGas,
        percentIncrease: BigNumber.from(0),
      },
      gasLimit: {
        base: RetryableDataTools.ErrorTriggeringParams.gasLimit,
        min: BigNumber.from(0),
        percentIncrease: BigNumber.from(0),
      },
    }

    const erc20Params = {
      parentSigner,
      childSignerOrProvider: childSigner.provider!,
      from: await parentSigner.getAddress(),
      erc20ParentAddress: parentTokenAddress,
      amount: depositAmount,
      retryableGasOverrides: retryableOverrides,
    }

    const depositParams = await erc20Bridger.getDepositRequest({
      ...erc20Params,
      parentProvider: parentSigner.provider!,
      childProvider: childSigner.provider!,
    })

    try {
      await erc20Bridger.deposit({
        ...erc20Params,
        parentSigner,
        childProvider: childSigner.provider!,
      })
      assert.fail('Expected estimateGas to fail')
    } catch (err) {
      const typedErr = err as Error
      const parsed = RetryableDataTools.tryParseError(typedErr)
      if (!parsed) throw err

      expect(parsed.callValueRefundAddress, 'callValueRefundAddress').to.eq(
        depositParams.retryableData.callValueRefundAddress
      )
      expect(parsed.data, 'data').to.eq(depositParams.retryableData.data)
      expect(parsed.deposit.toString(), 'deposit').to.eq(
        isArbitrumNetworkWithCustomFeeToken()
          ? depositParams.retryableData.deposit.toString()
          : depositParams.txRequest.value.toString()
      )
      expect(parsed.excessFeeRefundAddress, 'excessFeeRefundAddress').to.eq(
        depositParams.retryableData.excessFeeRefundAddress
      )
      expect(parsed.from, 'from').to.eq(depositParams.retryableData.from)
      expect(parsed.gasLimit.toString(), 'gasLimit').to.eq(
        depositParams.retryableData.gasLimit.toString()
      )

      expect(parsed.l2CallValue.toString(), 'l2CallValue').to.eq(
        depositParams.retryableData.l2CallValue.toString()
      )
      expect(parsed.maxFeePerGas.toString(), 'maxFeePerGas').to.eq(
        depositParams.retryableData.maxFeePerGas.toString()
      )
      expect(parsed.maxSubmissionCost.toString(), 'maxSubmissionCost').to.eq(
        depositParams.retryableData.maxSubmissionCost.toString()
      )
      expect(parsed.to).to.eq(depositParams.retryableData.to)
    }
  })
})
