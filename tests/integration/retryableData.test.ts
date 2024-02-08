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
import { fundL1, skipIfMainnet } from './testHelpers'
import { RetryableDataTools } from '../../src'
import { Wallet } from 'ethers'
import { testSetup } from '../../scripts/testSetup'
import { parseEther, randomBytes } from 'ethers/lib/utils'
import { Inbox__factory } from '../../src/lib/abi/factories/Inbox__factory'
import { GasOverrides } from '../../src/lib/message/L1ToL2MessageGasEstimator'
const depositAmount = BigNumber.from(100)
import { ERC20Inbox__factory } from '../../src/lib/abi/factories/ERC20Inbox__factory'
import { isL2NetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'

describe('RevertData', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  const createRevertParams = () => {
    const l2CallValue = BigNumber.from(137)
    const maxSubmissionCost = BigNumber.from(1618)
    return {
      to: Wallet.createRandom().address,
      excessFeeRefundAddress: Wallet.createRandom().address,
      callValueRefundAddress: Wallet.createRandom().address,
      l2CallValue,
      data: hexlify(randomBytes(32)),
      maxSubmissionCost: maxSubmissionCost,
      value: l2CallValue
        .add(maxSubmissionCost)
        .add(RetryableDataTools.ErrorTriggeringParams.gasLimit)
        .add(RetryableDataTools.ErrorTriggeringParams.maxFeePerGas),
      gasLimit: RetryableDataTools.ErrorTriggeringParams.gasLimit,
      maxFeePerGas: RetryableDataTools.ErrorTriggeringParams.maxFeePerGas,
    }
  }

  const testRetryableDataParsing = async (
    func: 'estimateGas' | 'callStatic'
  ) => {
    const { l1Signer, l2Network } = await testSetup()
    await fundL1(l1Signer)

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
    } = createRevertParams()

    try {
      if (isL2NetworkWithCustomFeeToken()) {
        const inbox = ERC20Inbox__factory.connect(
          l2Network.ethBridge.inbox,
          l1Signer
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
          l2Network.ethBridge.inbox,
          l1Signer
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
      expect(parsed.from, 'from').to.eq(await l1Signer.getAddress())
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
    const { erc20Bridger, l1Signer, l2Signer } = await testSetup()
    await fundL1(l1Signer, parseEther('2'))

    const deployErc20 = new TestERC20__factory().connect(l1Signer)
    const testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()
    const l1TokenAddress = testToken.address

    await (
      await erc20Bridger.approveToken({
        erc20L1Address: l1TokenAddress,
        l1Signer: l1Signer,
      })
    ).wait()

    if (isL2NetworkWithCustomFeeToken()) {
      // approve the custom fee token
      await (
        await erc20Bridger.approveGasToken({
          erc20L1Address: l1TokenAddress,
          l1Signer: l1Signer,
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
      l1Signer: l1Signer,
      l2SignerOrProvider: l2Signer.provider!,
      from: await l1Signer.getAddress(),
      erc20L1Address: l1TokenAddress,
      amount: depositAmount,
      retryableGasOverrides: retryableOverrides,
    }

    const depositParams = await erc20Bridger.getDepositRequest({
      ...erc20Params,
      l1Provider: l1Signer.provider!,
      l2Provider: l2Signer.provider!,
    })

    try {
      await erc20Bridger.deposit({
        ...erc20Params,
        l1Signer: l1Signer,
        l2Provider: l2Signer.provider!,
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
        isL2NetworkWithCustomFeeToken()
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
