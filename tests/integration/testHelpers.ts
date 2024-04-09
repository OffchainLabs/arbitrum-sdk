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
import { parseEther } from '@ethersproject/units'

import { config, getSigner, testSetup } from '../../scripts/testSetup'

import { Signer, Wallet } from 'ethers'
import { Erc20Bridger, ChildToParentMessageStatus } from '../../src'
import { ParentToChildMessageStatus } from '../../src/lib/message/L1ToL2Message'
import { ArbitrumNetwork } from '../../src/lib/dataEntities/networks'
import { GasOverrides } from '../../src/lib/message/L1ToL2MessageGasEstimator'
import { ArbSdkError } from '../../src/lib/dataEntities/errors'
import { ERC20 } from '../../src/lib/abi/ERC20'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'

export const preFundAmount = parseEther('0.1')

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
  parentChainToken: ERC20
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
    erc20ParentAddress: params.parentChainToken.address,
    destinationAddress: await params.childSigner.getAddress(),
    from: await params.childSigner.getAddress(),
  })
  const parentChainGasEstimate = await withdrawalParams.estimateL1GasLimit(
    params.parentSigner.provider!
  )

  const withdrawRes = await params.erc20Bridger.withdraw({
    destinationAddress: await params.childSigner.getAddress(),
    amount: params.amount,
    erc20ParentAddress: params.parentChainToken.address,
    l2Signer: params.childSigner,
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

  const childChainTokenAddr = await params.erc20Bridger.getL2ERC20Address(
    params.parentChainToken.address,
    params.parentSigner.provider!
  )
  const childChainToken = params.erc20Bridger.getChildTokenContract(
    params.childSigner.provider!,
    childChainTokenAddr
  )
  const testWalletChildChainBalance = await childChainToken.balanceOf(
    await params.childSigner.getAddress()
  )
  expect(
    testWalletChildChainBalance.toNumber(),
    'token withdraw balance not deducted'
  ).to.eq(params.startBalance.sub(params.amount).toNumber())
  const walletAddress = await params.parentSigner.getAddress()

  const gatewayAddress = await params.erc20Bridger.getL2GatewayAddress(
    params.parentChainToken.address,
    params.childSigner.provider!
  )

  const { expectedL2Gateway } = getGateways(
    params.gatewayType,
    params.erc20Bridger.childChain
  )
  expect(gatewayAddress, 'Gateway is not custom gateway').to.eq(
    expectedL2Gateway
  )

  const gatewayWithdrawEvents = await params.erc20Bridger.getL2WithdrawalEvents(
    params.childSigner.provider!,
    gatewayAddress,
    { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
    params.parentChainToken.address,
    walletAddress
  )
  expect(gatewayWithdrawEvents.length).to.equal(1, 'token query failed')

  const balBefore = await params.parentChainToken.balanceOf(
    await params.parentSigner.getAddress()
  )

  // whilst waiting for status we miner on both l1 and l2
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
  ).to.be.lessThan(parentChainGasEstimate.toNumber())

  expect(
    await message.status(params.childSigner.provider!),
    'executed status'
  ).to.eq(ChildToParentMessageStatus.EXECUTED)

  const balAfter = await params.parentChainToken.balanceOf(
    await params.parentSigner.getAddress()
  )
  expect(balBefore.add(params.amount).toString(), 'Not withdrawn').to.eq(
    balAfter.toString()
  )
}

const getGateways = (gatewayType: GatewayType, l2Network: ArbitrumNetwork) => {
  switch (gatewayType) {
    case GatewayType.CUSTOM:
      return {
        expectedL1Gateway: l2Network.tokenBridge.l1CustomGateway,
        expectedL2Gateway: l2Network.tokenBridge.l2CustomGateway,
      }
    case GatewayType.STANDARD:
      return {
        expectedL1Gateway: l2Network.tokenBridge.l1ERC20Gateway,
        expectedL2Gateway: l2Network.tokenBridge.l2ERC20Gateway,
      }
    case GatewayType.WETH:
      return {
        expectedL1Gateway: l2Network.tokenBridge.l1WethGateway,
        expectedL2Gateway: l2Network.tokenBridge.l2WethGateway,
      }
    default:
      throw new ArbSdkError(`Unexpected gateway type: ${gatewayType}`)
  }
}

/**
 * Deposits a token and tests that it occurred correctly
 * @param depositAmount
 * @param l1TokenAddress
 * @param erc20Bridger
 * @param parentSigner
 * @param childSigner
 */
export const depositToken = async ({
  depositAmount,
  ethDepositAmount,
  l1TokenAddress,
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
  l1TokenAddress: string
  erc20Bridger: Erc20Bridger
  parentSigner: Signer
  childSigner: Signer
  expectedStatus: ParentToChildMessageStatus
  expectedGatewayType: GatewayType
  retryableOverrides?: GasOverrides
  destinationAddress?: string
}) => {
  await (
    await erc20Bridger.approveToken({
      erc20ParentAddress: l1TokenAddress,
      l1Signer: parentSigner,
    })
  ).wait()

  const senderAddress = await parentSigner.getAddress()
  const expectedParentChainGatewayAddress =
    await erc20Bridger.getL1GatewayAddress(
      l1TokenAddress,
      parentSigner.provider!
    )
  const parentChainToken = erc20Bridger.getParentChainTokenContract(
    parentSigner.provider!,
    l1TokenAddress
  )
  const allowance = await parentChainToken.allowance(
    senderAddress,
    expectedParentChainGatewayAddress
  )
  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  if (isArbitrumNetworkWithCustomFeeToken()) {
    await (
      await erc20Bridger.approveGasToken({
        l1Signer: parentSigner,
        erc20ParentAddress: l1TokenAddress,
      })
    ).wait()

    const feeTokenAllowance = await ERC20__factory.connect(
      erc20Bridger.nativeToken!,
      parentSigner
    ).allowance(
      await parentSigner.getAddress(),
      expectedParentChainGatewayAddress
    )

    expect(
      feeTokenAllowance.eq(Erc20Bridger.MAX_APPROVAL),
      'set fee token allowance failed'
    ).to.be.true
  }

  const initialBridgeTokenBalance = await parentChainToken.balanceOf(
    expectedParentChainGatewayAddress
  )
  const parentTokenBalanceBefore = await parentChainToken.balanceOf(
    senderAddress
  )
  const childChainEthBalanceBefore = await childSigner.provider!.getBalance(
    destinationAddress || senderAddress
  )

  const depositRes = await erc20Bridger.deposit({
    l1Signer: parentSigner,
    childProvider: childSigner.provider!,
    erc20ParentAddress: l1TokenAddress,
    amount: depositAmount,
    retryableGasOverrides: retryableOverrides,
    maxSubmissionCost: ethDepositAmount,
    excessFeeRefundAddress: destinationAddress,
    destinationAddress,
  })

  const depositRec = await depositRes.wait()
  const finalBridgeTokenBalance = await parentChainToken.balanceOf(
    expectedParentChainGatewayAddress
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
  const parentTokenBalanceAfter = await parentChainToken.balanceOf(
    senderAddress
  )
  expect(parentTokenBalanceAfter.toString(), 'user bal after').to.eq(
    parentTokenBalanceBefore.sub(depositAmount).toString()
  )

  const waitRes = await depositRec.waitForChildTx(childSigner)

  const childChainEthBalanceAfter = await childSigner.provider!.getBalance(
    destinationAddress || senderAddress
  )

  expect(waitRes.status, 'Unexpected status').to.eq(expectedStatus)
  if (retryableOverrides) {
    return {
      parentChainToken,
      waitRes,
    }
  }

  const { expectedL1Gateway, expectedL2Gateway } = getGateways(
    expectedGatewayType,
    erc20Bridger.childChain
  )

  const parentChainGateway = await erc20Bridger.getL1GatewayAddress(
    l1TokenAddress,
    parentSigner.provider!
  )
  expect(parentChainGateway, 'incorrect parent chain gateway address').to.eq(
    expectedL1Gateway
  )

  const childChainGateway = await erc20Bridger.getL2GatewayAddress(
    l1TokenAddress,
    childSigner.provider!
  )
  expect(childChainGateway, 'incorrect child chain gateway address').to.eq(
    expectedL2Gateway
  )

  const childChainErc20Addr = await erc20Bridger.getL2ERC20Address(
    l1TokenAddress,
    parentSigner.provider!
  )
  const childChainToken = erc20Bridger.getChildTokenContract(
    childSigner.provider!,
    childChainErc20Addr
  )
  const parentChainErc20Addr = await erc20Bridger.getL1ERC20Address(
    childChainErc20Addr,
    childSigner.provider!
  )
  expect(parentChainErc20Addr).to.equal(
    l1TokenAddress,
    'getERC20L1Address/getERC20L2Address failed with proper token address'
  )

  const tokenBalOnChildChainAfter = await childChainToken.balanceOf(
    destinationAddress || senderAddress
  )

  // only check for standard deposits
  if (!destinationAddress && !ethDepositAmount) {
    expect(
      tokenBalOnChildChainAfter.eq(depositAmount),
      'child wallet not updated after deposit'
    ).to.be.true
  }

  // batched token+eth
  if (ethDepositAmount) {
    expect(
      childChainEthBalanceAfter.gte(
        childChainEthBalanceBefore.add(ethDepositAmount)
      ),
      'child wallet not updated with the extra eth deposit'
    ).to.be.true
  }

  return { parentChainToken, waitRes, childChainToken }
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
      const { parentChain } = await testSetup()
      chainId = parentChain.chainID
    }
    if (chainId === 1) {
      console.error("You're writing to the chain on mainnet lol stop")
      testContext.skip()
    }
  }
})()
