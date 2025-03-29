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
import chalk from 'chalk'

import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider } from '@ethersproject/providers'
import { parseEther } from 'ethers/lib/utils'

import { config, getSigner, testSetup } from '../testSetup'

import { Signer, Wallet } from 'ethers'
import { Erc20Bridger, ChildToParentMessageStatus } from '../../src'
import { ParentToChildMessageStatus } from '../../src/lib/message/ParentToChildMessage'
import {
  ArbitrumNetwork,
  assertArbitrumNetworkHasTokenBridge,
} from '../../src/lib/dataEntities/networks'
import { GasOverrides } from '../../src/lib/message/ParentToChildMessageGasEstimator'
import { ArbSdkError } from '../../src/lib/dataEntities/errors'
import { ERC20 } from '../../src/lib/abi/ERC20'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { scaleFrom18DecimalsToNativeTokenDecimals } from '../../src/lib/utils/lib'

const preFundAmount = parseEther('0.1')

export const prettyLog = (text: string): void => {
  console.log(chalk.blue(`    *** ${text}`))
  console.log()
}

export const warn = (text: string): void => {
  console.log(chalk.red(`WARNING: ${text}`))
  console.log()
}

export enum GatewayType {
  STANDARD = 1,
  CUSTOM = 2,
  WETH = 3,
}

interface WithdrawalParams {
  startBalance: BigNumber
  amount: BigNumber
  erc20Bridger: Erc20Bridger
  parentToken: ERC20
  childSigner: Signer
  parentSigner: Signer
  gatewayType: GatewayType
}

export const mineUntilStop = async (
  miner: Signer,
  state: { mining: boolean }
) => {
  while (state.mining) {
    await (
      await miner.sendTransaction({
        to: await miner.getAddress(),
        value: 0,
      })
    ).wait()
    await wait(15000)
  }
}

/**
 * Withdraws a token and tests that it occurred correctly
 * @param params
 */
export const withdrawToken = async (params: WithdrawalParams) => {
  const withdrawalParams = await params.erc20Bridger.getWithdrawalRequest({
    amount: params.amount,
    erc20ParentAddress: params.parentToken.address,
    destinationAddress: await params.childSigner.getAddress(),
    from: await params.childSigner.getAddress(),
  })
  const parentGasEstimate = await withdrawalParams.estimateParentGasLimit(
    params.parentSigner.provider!
  )

  const withdrawRes = await params.erc20Bridger.withdraw({
    destinationAddress: await params.childSigner.getAddress(),
    amount: params.amount,
    erc20ParentAddress: params.parentToken.address,
    childSigner: params.childSigner,
  })
  const withdrawRec = await withdrawRes.wait()
  expect(withdrawRec.status).to.equal(1, 'initiate token withdraw txn failed')

  const message = (
    await withdrawRec.getChildToParentMessages(params.parentSigner)
  )[0]
  expect(message, 'withdraw message not found').to.exist

  const messageStatus = await message.status(params.childSigner.provider!)
  expect(messageStatus, `invalid withdraw status`).to.eq(
    ChildToParentMessageStatus.UNCONFIRMED
  )

  const childTokenAddr = await params.erc20Bridger.getChildErc20Address(
    params.parentToken.address,
    params.parentSigner.provider!
  )
  const childToken = params.erc20Bridger.getChildTokenContract(
    params.childSigner.provider!,
    childTokenAddr
  )
  const testWalletChildBalance = await childToken.balanceOf(
    await params.childSigner.getAddress()
  )
  expect(
    testWalletChildBalance.toNumber(),
    'token withdraw balance not deducted'
  ).to.eq(params.startBalance.sub(params.amount).toNumber())
  const walletAddress = await params.parentSigner.getAddress()

  const gatewayAddress = await params.erc20Bridger.getChildGatewayAddress(
    params.parentToken.address,
    params.childSigner.provider!
  )

  const { expectedL2Gateway } = getGateways(
    params.gatewayType,
    params.erc20Bridger.childNetwork
  )
  expect(gatewayAddress, 'Gateway is not custom gateway').to.eq(
    expectedL2Gateway
  )

  const gatewayWithdrawEvents = await params.erc20Bridger.getWithdrawalEvents(
    params.childSigner.provider!,
    gatewayAddress,
    { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
    params.parentToken.address,
    walletAddress
  )
  expect(gatewayWithdrawEvents.length).to.equal(1, 'token query failed')

  const balBefore = await params.parentToken.balanceOf(
    await params.parentSigner.getAddress()
  )

  // whilst waiting for status we miner on both parent and child chains
  const miner1 = Wallet.createRandom().connect(params.parentSigner.provider!)
  const miner2 = Wallet.createRandom().connect(params.childSigner.provider!)
  await fundParentSigner(miner1, parseEther('1'))
  await fundChildSigner(miner2, parseEther('1'))
  const state = { mining: true }
  await Promise.race([
    mineUntilStop(miner1, state),
    mineUntilStop(miner2, state),
    message.waitUntilReadyToExecute(params.childSigner.provider!),
  ])
  state.mining = false

  expect(
    await message.status(params.childSigner.provider!),
    'confirmed status'
  ).to.eq(ChildToParentMessageStatus.CONFIRMED)

  const execTx = await message.execute(params.childSigner.provider!)
  const execRec = await execTx.wait()

  expect(
    execRec.gasUsed.toNumber(),
    'Gas used greater than estimate'
  ).to.be.lessThan(parentGasEstimate.toNumber())

  expect(
    await message.status(params.childSigner.provider!),
    'executed status'
  ).to.eq(ChildToParentMessageStatus.EXECUTED)

  const balAfter = await params.parentToken.balanceOf(
    await params.parentSigner.getAddress()
  )
  expect(balBefore.add(params.amount).toString(), 'Not withdrawn').to.eq(
    balAfter.toString()
  )
}

const getGateways = (gatewayType: GatewayType, l2Network: ArbitrumNetwork) => {
  assertArbitrumNetworkHasTokenBridge(l2Network)

  switch (gatewayType) {
    case GatewayType.CUSTOM:
      return {
        expectedL1Gateway: l2Network.tokenBridge.parentCustomGateway,
        expectedL2Gateway: l2Network.tokenBridge.childCustomGateway,
      }
    case GatewayType.STANDARD:
      return {
        expectedL1Gateway: l2Network.tokenBridge.parentErc20Gateway,
        expectedL2Gateway: l2Network.tokenBridge.childErc20Gateway,
      }
    case GatewayType.WETH:
      return {
        expectedL1Gateway: l2Network.tokenBridge.parentWethGateway,
        expectedL2Gateway: l2Network.tokenBridge.childWethGateway,
      }
    default:
      throw new ArbSdkError(`Unexpected gateway type: ${gatewayType}`)
  }
}

/**
 * Deposits a token and tests that it occurred correctly
 * @param depositAmount
 * @param parentTokenAddress
 * @param erc20Bridger
 * @param parentSigner
 * @param childSigner
 */
export const depositToken = async ({
  depositAmount,
  ethDepositAmount,
  parentTokenAddress,
  erc20Bridger,
  parentSigner,
  childSigner,
  expectedStatus,
  expectedGatewayType,
  retryableOverrides,
  destinationAddress,
}: {
  depositAmount: BigNumber
  ethDepositAmount?: BigNumber
  parentTokenAddress: string
  erc20Bridger: Erc20Bridger
  parentSigner: Signer
  childSigner: Signer
  expectedStatus: ParentToChildMessageStatus
  expectedGatewayType: GatewayType
  retryableOverrides?: GasOverrides
  destinationAddress?: string
}) => {
  let feeTokenBalanceBefore: BigNumber | undefined

  await (
    await erc20Bridger.approveToken({
      erc20ParentAddress: parentTokenAddress,
      parentSigner,
    })
  ).wait()

  const senderAddress = await parentSigner.getAddress()
  const expectedParentGatewayAddress =
    await erc20Bridger.getParentGatewayAddress(
      parentTokenAddress,
      parentSigner.provider!
    )
  const parentToken = erc20Bridger.getParentTokenContract(
    parentSigner.provider!,
    parentTokenAddress
  )
  const allowance = await parentToken.allowance(
    senderAddress,
    expectedParentGatewayAddress
  )
  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  if (isArbitrumNetworkWithCustomFeeToken()) {
    await (
      await erc20Bridger.approveGasToken({
        parentSigner,
        erc20ParentAddress: parentTokenAddress,
      })
    ).wait()

    const feeTokenAllowance = await ERC20__factory.connect(
      erc20Bridger.nativeToken!,
      parentSigner
    ).allowance(await parentSigner.getAddress(), expectedParentGatewayAddress)

    expect(
      feeTokenAllowance.eq(Erc20Bridger.MAX_APPROVAL),
      'set fee token allowance failed'
    ).to.be.true

    feeTokenBalanceBefore = await ERC20__factory.connect(
      erc20Bridger.nativeToken!,
      parentSigner
    ).balanceOf(senderAddress)
  }

  const initialBridgeTokenBalance = await parentToken.balanceOf(
    expectedParentGatewayAddress
  )
  const parentTokenBalanceBefore = await parentToken.balanceOf(senderAddress)
  const childEthBalanceBefore = await childSigner.provider!.getBalance(
    destinationAddress || senderAddress
  )

  const depositRes = await erc20Bridger.deposit({
    parentSigner,
    childProvider: childSigner.provider!,
    erc20ParentAddress: parentTokenAddress,
    amount: depositAmount,
    retryableGasOverrides: retryableOverrides,
    maxSubmissionCost: ethDepositAmount,
    excessFeeRefundAddress: destinationAddress,
    destinationAddress,
  })

  const depositRec = await depositRes.wait()
  const finalBridgeTokenBalance = await parentToken.balanceOf(
    expectedParentGatewayAddress
  )
  expect(
    finalBridgeTokenBalance.toNumber(),
    'bridge balance not updated after L1 token deposit txn'
  ).to.eq(
    // for weth the eth is actually withdrawn, rather than transferred
    expectedGatewayType === GatewayType.WETH
      ? 0
      : initialBridgeTokenBalance.add(depositAmount).toNumber()
  )
  const parentTokenBalanceAfter = await parentToken.balanceOf(senderAddress)
  expect(parentTokenBalanceAfter.toString(), 'user bal after').to.eq(
    parentTokenBalanceBefore.sub(depositAmount).toString()
  )

  if (isArbitrumNetworkWithCustomFeeToken()) {
    const nativeTokenContract = ERC20__factory.connect(
      erc20Bridger.nativeToken!,
      parentSigner
    )

    const feeTokenBalanceAfter = await nativeTokenContract.balanceOf(
      senderAddress
    )

    // makes sure gas spent was rescaled correctly for non-18 decimal fee tokens
    const feeTokenDecimals = await nativeTokenContract.decimals()

    const MAX_BASE_ESTIMATED_GAS_FEE = BigNumber.from(1_000_000_000_000_000)

    const maxScaledEstimatedGasFee = scaleFrom18DecimalsToNativeTokenDecimals({
      amount: MAX_BASE_ESTIMATED_GAS_FEE,
      decimals: feeTokenDecimals,
    })

    expect(
      feeTokenBalanceBefore!
        .sub(feeTokenBalanceAfter)
        .lte(maxScaledEstimatedGasFee),
      'Too much custom fee token used as gas'
    ).to.be.true
  }

  const waitRes = await depositRec.waitForChildTransactionReceipt(childSigner)

  const childEthBalanceAfter = await childSigner.provider!.getBalance(
    destinationAddress || senderAddress
  )

  expect(waitRes.status, 'Unexpected status').to.eq(expectedStatus)
  if (retryableOverrides) {
    return {
      parentToken,
      waitRes,
    }
  }

  const { expectedL1Gateway, expectedL2Gateway } = getGateways(
    expectedGatewayType,
    erc20Bridger.childNetwork
  )

  const parentGateway = await erc20Bridger.getParentGatewayAddress(
    parentTokenAddress,
    parentSigner.provider!
  )
  expect(parentGateway, 'incorrect parent chain gateway address').to.eq(
    expectedL1Gateway
  )

  const childGateway = await erc20Bridger.getChildGatewayAddress(
    parentTokenAddress,
    childSigner.provider!
  )
  expect(childGateway, 'incorrect child chain gateway address').to.eq(
    expectedL2Gateway
  )

  const childErc20Addr = await erc20Bridger.getChildErc20Address(
    parentTokenAddress,
    parentSigner.provider!
  )
  const childToken = erc20Bridger.getChildTokenContract(
    childSigner.provider!,
    childErc20Addr
  )
  const parentErc20Addr = await erc20Bridger.getParentErc20Address(
    childErc20Addr,
    childSigner.provider!
  )
  expect(parentErc20Addr).to.equal(
    parentTokenAddress,
    'getERC20L1Address/getERC20L2Address failed with proper token address'
  )

  const tokenBalOnChildAfter = await childToken.balanceOf(
    destinationAddress || senderAddress
  )

  // only check for standard deposits
  if (!destinationAddress && !ethDepositAmount) {
    expect(
      tokenBalOnChildAfter.eq(depositAmount),
      'child wallet not updated after deposit'
    ).to.be.true
  }

  // batched token+eth
  if (ethDepositAmount) {
    expect(
      childEthBalanceAfter.gte(childEthBalanceBefore.add(ethDepositAmount)),
      'child wallet not updated with the extra eth deposit'
    ).to.be.true
  }

  return { parentToken, waitRes, childToken }
}

const fund = async (
  signer: Signer,
  amount?: BigNumber,
  fundingKey?: string
) => {
  const wallet = getSigner(signer.provider! as JsonRpcProvider, fundingKey)
  await (
    await wallet.sendTransaction({
      to: await signer.getAddress(),
      value: amount || preFundAmount,
    })
  ).wait()
}

export const fundParentSigner = async (
  parentSigner: Signer,
  amount?: BigNumber
): Promise<void> => {
  await fund(parentSigner, amount, config.ethKey)
}

export const fundChildSigner = async (
  childSigner: Signer,
  amount?: BigNumber
): Promise<void> => {
  await fund(childSigner, amount, config.arbKey)
}

export const wait = (ms = 0): Promise<void> => {
  return new Promise(res => setTimeout(res, ms))
}

export const skipIfMainnet = (() => {
  let chainId: number
  return async (testContext: Mocha.Context) => {
    if (!chainId) {
      const { childChain } = await testSetup()
      chainId = childChain.chainId
    }
    if (chainId === 42161 || chainId === 42170) {
      console.error("You're writing to the chain on mainnet lol stop")
      testContext.skip()
    }
  }
})()
