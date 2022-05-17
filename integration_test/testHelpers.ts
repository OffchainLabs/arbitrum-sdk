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

import { config, getSigner, testSetup } from '../scripts/testSetup'

import { Signer } from 'ethers'
import { Erc20Bridger, L1ToL2MessageStatus, L2ToL1MessageStatus } from '../src'
import { L2Network } from '../src/lib/dataEntities/networks'
import { GasOverrides } from '../src/lib/message/L1ToL2MessageGasEstimator'
import { ArbSdkError } from '../src/lib/dataEntities/errors'
import { ERC20 } from '../src/lib/abi/ERC20'

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
  l1Token: ERC20
  l2Signer: Signer
  l1Signer: Signer
  gatewayType: GatewayType
}

/**
 * Withdraws a token and tests that it occurred correctly
 * @param params
 */
export const withdrawToken = async (params: WithdrawalParams) => {
  const withdrawRes = await params.erc20Bridger.withdraw({
    amount: params.amount,
    erc20l1Address: params.l1Token.address,
    l2Signer: params.l2Signer,
  })
  const withdrawRec = await withdrawRes.wait()
  expect(withdrawRec.status).to.equal(1, 'initiate token withdraw txn failed')

  const message = (await withdrawRec.getL2ToL1Messages(params.l1Signer))[0]
  expect(message, 'withdraw message not found').to.exist

  const messageStatus = await message.status(params.l2Signer.provider!)
  expect(messageStatus, `invalid withdraw status`).to.eq(
    L2ToL1MessageStatus.UNCONFIRMED
  )

  const l2TokenAddr = await params.erc20Bridger.getL2ERC20Address(
    params.l1Token.address,
    params.l1Signer.provider!
  )
  const l2Token = params.erc20Bridger.getL2TokenContract(
    params.l2Signer.provider!,
    l2TokenAddr
  )
  const testWalletL2Balance = await l2Token.balanceOf(
    await params.l2Signer.getAddress()
  )
  expect(
    testWalletL2Balance.toNumber(),
    'token withdraw balance not deducted'
  ).to.eq(params.startBalance.sub(params.amount).toNumber())
  const walletAddress = await params.l1Signer.getAddress()

  const gatewayAddress = await params.erc20Bridger.getL2GatewayAddress(
    params.l1Token.address,
    params.l2Signer.provider!
  )

  const { expectedL2Gateway } = getGateways(
    params.gatewayType,
    params.erc20Bridger.l2Network
  )
  expect(gatewayAddress, 'Gateway is not custom gateway').to.eq(
    expectedL2Gateway
  )

  const gatewayWithdrawEvents = await params.erc20Bridger.getL2WithdrawalEvents(
    params.l2Signer.provider!,
    gatewayAddress,
    { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
    params.l1Token.address,
    walletAddress
  )
  expect(gatewayWithdrawEvents.length).to.equal(1, 'token query failed')

  const balBefore = await params.l1Token.balanceOf(
    await params.l1Signer.getAddress()
  )
  await message.waitUntilReadyToExecute(params.l2Signer.provider!)
  expect(
    await message.status(params.l2Signer.provider!),
    'confirmed status'
  ).to.eq(L2ToL1MessageStatus.CONFIRMED)

  const execTx = await message.execute(params.l2Signer.provider!)

  await execTx.wait()
  expect(
    await message.status(params.l2Signer.provider!),
    'executed status'
  ).to.eq(L2ToL1MessageStatus.EXECUTED)

  const balAfter = await params.l1Token.balanceOf(
    await params.l1Signer.getAddress()
  )
  expect(balBefore.add(params.amount).toString(), 'Not withdrawn').to.eq(
    balAfter.toString()
  )
}

const getGateways = (gatewayType: GatewayType, l2Network: L2Network) => {
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
 * @param l1Signer
 * @param l2Signer
 */
export const depositToken = async (
  depositAmount: BigNumber,
  l1TokenAddress: string,
  erc20Bridger: Erc20Bridger,
  l1Signer: Signer,
  l2Signer: Signer,
  expectedStatus: L1ToL2MessageStatus,
  expectedGatewayType: GatewayType,
  retryableOverrides?: GasOverrides
) => {
  await (
    await erc20Bridger.approveToken({
      erc20L1Address: l1TokenAddress,
      l1Signer: l1Signer,
    })
  ).wait()

  const expectedL1GatewayAddress = await erc20Bridger.getL1GatewayAddress(
    l1TokenAddress,
    l1Signer.provider!
  )
  const l1Token = erc20Bridger.getL1TokenContract(
    l1Signer.provider!,
    l1TokenAddress
  )
  const allowance = await l1Token.allowance(
    await l1Signer.getAddress(),
    expectedL1GatewayAddress
  )
  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  const initialBridgeTokenBalance = await l1Token.balanceOf(
    expectedL1GatewayAddress
  )
  const userBalBefore = await l1Token.balanceOf(await l1Signer.getAddress())

  const depositRes = await erc20Bridger.deposit({
    l1Signer: l1Signer,
    l2Provider: l2Signer.provider!,
    erc20L1Address: l1TokenAddress,
    amount: depositAmount,
    retryableGasOverrides: retryableOverrides,
  })

  const depositRec = await depositRes.wait()
  const finalBridgeTokenBalance = await l1Token.balanceOf(
    expectedL1GatewayAddress
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
  const userBalAfter = await l1Token.balanceOf(await l1Signer.getAddress())
  expect(userBalAfter.toString(), 'user bal after').to.eq(
    userBalBefore.sub(depositAmount).toString()
  )

  const waitRes = await depositRec.waitForL2(l2Signer)

  expect(waitRes.status, 'Unexpected status').to.eq(expectedStatus)
  if (retryableOverrides) {
    return {
      l1Token,
      waitRes,
    }
  }

  const { expectedL1Gateway, expectedL2Gateway } = getGateways(
    expectedGatewayType,
    erc20Bridger.l2Network
  )

  const l1Gateway = await erc20Bridger.getL1GatewayAddress(
    l1TokenAddress,
    l1Signer.provider!
  )
  expect(l1Gateway, 'incorrect l1 gateway address').to.eq(expectedL1Gateway)

  const l2Gateway = await erc20Bridger.getL2GatewayAddress(
    l1TokenAddress,
    l2Signer.provider!
  )
  expect(l2Gateway, 'incorrect l2 gateway address').to.eq(expectedL2Gateway)

  const l2Erc20Addr = await erc20Bridger.getL2ERC20Address(
    l1TokenAddress,
    l1Signer.provider!
  )
  const l2Token = erc20Bridger.getL2TokenContract(
    l2Signer.provider!,
    l2Erc20Addr
  )
  const l1Erc20Addr = await erc20Bridger.getL1ERC20Address(
    l2Erc20Addr,
    l2Signer.provider!
  )
  expect(l1Erc20Addr).to.equal(
    l1TokenAddress,
    'getERC20L1Address/getERC20L2Address failed with proper token address'
  )

  const testWalletL2Balance = await l2Token.balanceOf(
    await l2Signer.getAddress()
  )
  expect(
    testWalletL2Balance.eq(depositAmount),
    'l2 wallet not updated after deposit'
  ).to.be.true

  return { l1Token, waitRes, l2Token }
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

export const fundL1 = async (
  l1Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  await fund(l1Signer, amount, config.ethKey)
}

export const fundL2 = async (
  l2Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  await fund(l2Signer, amount, config.arbKey)
}

export const wait = (ms = 0): Promise<void> => {
  return new Promise(res => setTimeout(res, ms))
}

export const skipIfMainnet = (() => {
  let chainId: number
  return async (testContext: Mocha.Context) => {
    if (!chainId) {
      const { l1Network } = await testSetup()
      chainId = l1Network.chainID
    }
    if (chainId === 1) {
      console.error("You're writing to the chain on mainnet lol stop")
      testContext.skip()
    }
  }
})()
