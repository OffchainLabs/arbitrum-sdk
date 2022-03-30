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
import yargs from 'yargs/yargs'
import chalk from 'chalk'

import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'

import { config, testSetup } from '../scripts/testSetup'

import { Signer } from 'ethers'
import {
  EthBridger,
  InboxTools,
  Erc20Bridger,
  L1ToL2MessageStatus,
} from '../src'
import { L1Network, L2Network } from '../src/lib/dataEntities/networks'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { GasOverrides } from '../src/lib/message/L1ToL2MessageGasEstimator'
import { ArbTsError } from '../src/lib/dataEntities/errors'

const argv = yargs(process.argv.slice(2))
  .options({
    networkID: {
      type: 'string',
    },
  })
  .parseSync()

export const preFundAmount = parseEther('0.1')

export const prettyLog = (text: string): void => {
  console.log(chalk.blue(`    *** ${text}`))
  console.log()
}

export const warn = (text: string): void => {
  console.log(chalk.red(`WARNING: ${text}`))
  console.log()
}

export enum ExpectedGatewayType {
  STANDARD = 1,
  CUSTOM = 2,
  WETH = 3,
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
  expectedGatewayType: ExpectedGatewayType,
  retryableOverrides?: Omit<GasOverrides, 'sendL2CallValueFromL1'>
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
    initialBridgeTokenBalance.add(depositAmount).toNumber(),
    'bridge balance not updated after L1 token deposit txn'
  ).to.eq(finalBridgeTokenBalance.toNumber())

  const waitRes = await depositRec.waitForL2(l2Signer)
  expect(waitRes.status, 'Unexpected status').to.eq(expectedStatus)
  if (!!retryableOverrides) {
    return {
      l1Token,
      waitRes,
    }
  }

  const { expectedL1Gateway, expectedL2Gateway } = (() => {
    switch (expectedGatewayType) {
      case ExpectedGatewayType.CUSTOM:
        return {
          expectedL1Gateway: erc20Bridger.l2Network.tokenBridge.l1CustomGateway,
          expectedL2Gateway: erc20Bridger.l2Network.tokenBridge.l2CustomGateway,
        }
      case ExpectedGatewayType.STANDARD:
        return {
          expectedL1Gateway: erc20Bridger.l2Network.tokenBridge.l1ERC20Gateway,
          expectedL2Gateway: erc20Bridger.l2Network.tokenBridge.l2ERC20Gateway,
        }
      case ExpectedGatewayType.WETH:
        return {
          expectedL1Gateway: erc20Bridger.l2Network.tokenBridge.l1WethGateway,
          expectedL2Gateway: erc20Bridger.l2Network.tokenBridge.l2WethGateway,
        }
      default:
        throw new ArbTsError(`Unexpected gateway type: ${expectedGatewayType}`)
    }
  })()

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

export const fundL1 = async (
  l1Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  const preFundedSigner = (l1Signer.provider! as JsonRpcProvider).getSigner(0)
  await (
    await preFundedSigner.sendTransaction({
      to: await l1Signer.getAddress(),
      value: amount || preFundAmount,
    })
  ).wait()
}

export const fundL2 = async (
  l2Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  const testWalletAddress = await l2Signer.getAddress()
  const arbGenesisWallet = new Wallet(config.arbGenesisKey);
  await (
    await arbGenesisWallet.connect(l2Signer.provider!).sendTransaction({
      to: testWalletAddress,
      value: amount || preFundAmount,
    })
  ).wait()
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
