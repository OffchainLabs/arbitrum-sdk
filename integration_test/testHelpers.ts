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
import { JsonRpcProvider, Provider } from '@ethersproject/providers'
import { ContractReceipt } from '@ethersproject/contracts'
import { Wallet } from '@ethersproject/wallet'
import { formatBytes32String } from '@ethersproject/strings'
import { parseEther } from '@ethersproject/units'

import { instantiateBridge } from '../scripts/instantiate_bridge'

import config from './config'
import { L1TransactionReceipt } from '../src/lib/message/L1Transaction'
import { Signer } from 'ethers'
import { EthBridger, InboxTools, Erc20Bridger } from '../src'
import {
  L1Network,
  L2Network,
  getL2Network,
  getL1Network,
} from '../src/lib/dataEntities/networks'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { L2TxnType } from '../src/lib/message/L1ToL2Message'

const argv = yargs(process.argv.slice(2))
  .options({
    networkID: {
      type: 'string',
    },
  })
  .parseSync()

const networkID = (argv.networkID as '1' | '4' | '1338') || '4'
if (!config[networkID]) {
  throw new Error('network not supported')
}

const {
  existentTestERC20: _existentTestERC20,
  existentTestCustomToken: _existentTestCustomToken,
} = config[networkID]

export const existentTestERC20 = _existentTestERC20 as string
export const existentTestCustomToken = _existentTestCustomToken as string

export const preFundAmount = parseEther('0.1')

export const testRetryableTicket = async (
  l2Provider: Provider,
  rec: ContractReceipt,
): Promise<void> => {
  prettyLog(`testing retryable for ${rec.transactionHash}`)

  const messages = await new L1TransactionReceipt(rec).getL1ToL2Messages(
    l2Provider,
  )

  const message = messages && messages[0]
  if (!message) {
    throw new Error('Seq num not found')
  }
  const retryableTicket = message.retryableCreationId

  const redeemTransaction = message.l2TxHash

  prettyLog(`retryableTicket: ${retryableTicket}, redeem: ${redeemTransaction}`)
  prettyLog('Waiting for retryable ticket')

  await message.waitForStatus(1, 1000 * 60 * 15)

  const retryableTicketReceipt = await message.getRetryableCreationReceipt()

  prettyLog('retryableTicketReceipt found:')

  expect(retryableTicketReceipt && retryableTicketReceipt.status).to.equal(
    1,
    'retryable ticket txn failed'
  )

  // prettyLog(`Waiting for auto redeem transaction (this shouldn't take long`)
  // const autoRedeemReceipt = await message.getAutoRedeemReceipt()

  // prettyLog('autoRedeem receipt found!')

  // expect(autoRedeemReceipt && autoRedeemReceipt.status).to.equal(
  //   1,
  //   'autoredeem txn failed'
  // )

  prettyLog('Getting redemption')

  // CHRIS: we sometimes got a fail fetching teh receipt? cannot read "data" of undefined
  const redemptionReceipt = await message.getL2TxReceipt()
  expect(redemptionReceipt && redemptionReceipt.status).equals(
    1,
    'redeem txn failed'
  )
}

export const prettyLog = (text: string): void => {
  console.log(chalk.blue(`    *** ${text}`))
  console.log()
}

export const warn = (text: string): void => {
  console.log(chalk.red(`WARNING: ${text}`))
  console.log()
}

export const instantiateBridgeWithRandomWallet = async (): Promise<{
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  inboxTools: InboxTools
  l1Network: L1Network
  l2Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  l1Deployer: Signer
  l2Deployer: Signer
  adminErc20Bridger: AdminErc20Bridger
}> => {
  const testPk = formatBytes32String(Math.random().toString())
  prettyLog(
    `Generated wallet, pk: ${testPk} address: ${new Wallet(testPk).address} `
  )
  return await instantiateBridge(testPk, testPk)
}

// CHRIS: TODO: tidy this and below and usage up
const fundIfNonZero = async (
  l1Provider: JsonRpcProvider,
  target: string,
  amount: BigNumber
) => {
  const l1Signer = l1Provider.getSigner(0)
  if ((await l1Provider.getBalance(target)).gt(0)) return
  const tx = await l1Signer.sendTransaction({
    to: target,
    value: amount,
  })
  await tx.wait()
}

const _preFundedWallet = new Wallet(process.env.DEVNET_PRIVKEY as string)
// CHRIS: TODO: remove, or continue using the devnet privkey
// const _preFundedL2Wallet = new Wallet(process.env.DEVNET_PRIVKEY as string)
const _preFundedL2Wallet = new Wallet(process.env.ARB_GENESIS_KEY as string)
console.warn('using prefunded wallet ', _preFundedWallet.address)

export const fundL1 = async (
  l1Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  const testWalletAddress = await l1Signer.getAddress()
  const preFundedWallet = _preFundedWallet.connect(l1Signer.provider!)
  await fundIfNonZero(
    l1Signer.provider! as JsonRpcProvider,
    preFundedWallet.address,
    parseEther('10')
  )
  const res = await preFundedWallet.sendTransaction({
    to: testWalletAddress,
    value: amount || preFundAmount,
  })
  await res.wait()
  prettyLog('Funded L1 account')
}

export const fundL2Addr = async (
  l2Address: string,
  l2Provider: Provider,
  amount: BigNumber
) => {
  const testWalletAddress = l2Address
  const preFundedL2Wallet = _preFundedL2Wallet.connect(l2Provider)
  const res = await preFundedL2Wallet.sendTransaction({
    to: testWalletAddress,
    value: amount || preFundAmount,
  })
  await res.wait()
  prettyLog('Funded L2 account')
}

// CHRIS: TODO: remove
export const fundL22 = async (
  addrToFund: string,
  l2Provider: Provider,
  amount?: BigNumber
): Promise<void> => {
  const testWalletAddress = addrToFund
  const preFundedL2Wallet = _preFundedL2Wallet.connect(l2Provider)
  const res = await preFundedL2Wallet.sendTransaction({
    to: testWalletAddress,
    value: amount || preFundAmount,
    gasLimit: 3000000, // CHRIS: TODO: this isnt correct? we should be able to use the gas estimate?
  })
  await res.wait()
  prettyLog('Funded L2 account')
}

export const fundL2 = async (
  l2Signer: Signer,
  amount?: BigNumber
): Promise<void> => {
  const testWalletAddress = await l2Signer.getAddress()
  const preFundedL2Wallet = _preFundedL2Wallet.connect(l2Signer.provider!)
  const res = await preFundedL2Wallet.sendTransaction({
    to: testWalletAddress,
    value: amount || preFundAmount,
    gasLimit: 3000000, // CHRIS: TODO: this isnt correct? we should be able to use the gas estimate?
  })
  await res.wait()
  prettyLog('Funded L2 account')
}

export const wait = (ms = 0): Promise<void> => {
  return new Promise(res => setTimeout(res, ms))
}

export const skipIfMainnet = (() => {
  let chainId: number
  return async (testContext: Mocha.Context) => {
    if (!chainId) {
      const { l1Network } = await instantiateBridgeWithRandomWallet()
      chainId = l1Network.chainID
    }
    if (chainId === 1) {
      console.log("You're writing to the chain on mainnet lol stop")
      testContext.skip()
    }
  }
})()
