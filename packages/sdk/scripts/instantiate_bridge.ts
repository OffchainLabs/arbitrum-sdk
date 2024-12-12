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

import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { loadEnv } from '../src/lib/utils/env'

import args from './getCLargs'
import { EthBridger, InboxTools, Erc20Bridger } from '../src'
import {
  ArbitrumNetwork,
  getArbitrumNetwork,
} from '../src/lib/dataEntities/networks'
import { Signer } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'

loadEnv()

const arbKey = process.env['ARB_KEY'] as string
const ethKey = process.env['ETH_KEY'] as string

const defaultNetworkId = 421614

export const instantiateBridge = async (
  l1PkParam?: string,
  l2PkParam?: string
): Promise<{
  l2Network: ArbitrumNetwork
  l1Signer: Signer
  l2Signer: Signer
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
}> => {
  if (!l1PkParam && !ethKey) {
    throw new Error('need ARB_KEY var')
  }
  if (!l2PkParam && !arbKey) {
    throw new Error('need ARB_KEY var')
  }

  let l2NetworkID = args.networkID
  if (!l2NetworkID) {
    console.log(
      'No networkID command line arg provided; using network',
      defaultNetworkId
    )

    l2NetworkID = defaultNetworkId
  }

  const l2Network = await getArbitrumNetwork(l2NetworkID)

  const l1Rpc = (() => {
    if (l2NetworkID === 42161) return process.env['MAINNET_RPC'] as string
    if (l2NetworkID === 421614) return process.env['SEPOLIA_RPC'] as string
    if (l2NetworkID === 1338) return 'http://127.0.0.1:8545/'
    throw new Error(
      'L1 rpc url not set (see .env.sample or networks.ts) or chain id not supported'
    )
  })()
  const l2Rpc = (() => {
    if (l2NetworkID === 42161)
      return process.env['ARB_ONE_RPC'] || 'https://arb1.arbitrum.io/rpc'
    if (l2NetworkID === 421614)
      return (
        process.env['SEPOLIA_ROLLUP_TESTNET_RPC'] ||
        'https://sepolia-rollup.arbitrum.io/rpc'
      )
    throw new Error(
      'L2 rpc url not set (see .env.sample or networks.ts) or chain id not supported'
    )
  })()

  const ethProvider = new JsonRpcProvider(l1Rpc)
  const arbProvider = new JsonRpcProvider(l2Rpc)

  const l1Signer = (() => {
    if (l1PkParam) {
      return new Wallet(l1PkParam, ethProvider)
    } else if (ethKey) {
      return new Wallet(ethKey, ethProvider)
    } else {
      throw new Error('impossible path')
    }
  })()

  const l2Signer = (() => {
    if (l2PkParam) {
      return new Wallet(l2PkParam, arbProvider)
    } else if (arbKey) {
      return new Wallet(arbKey, arbProvider)
    } else {
      throw new Error('impossible path')
    }
  })()

  console.log('')
  console.log('**** Bridger instantiated w/ address', l1Signer.address, '****')
  console.log('')

  const erc20Bridger = new Erc20Bridger(l2Network)
  const adminErc20Bridger = new AdminErc20Bridger(l2Network)
  const ethBridger = new EthBridger(l2Network)
  const inboxTools = new InboxTools(l1Signer, l2Network)

  return {
    l2Network,
    l1Signer,
    l2Signer,
    erc20Bridger: erc20Bridger,
    ethBridger,
    adminErc20Bridger,
    inboxTools,
  }
}
