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

import dotenv from 'dotenv'
import args from './getCLargs'
import { EthBridger, InboxTools, Erc20Bridger } from '../src'
import {
  l1Networks,
  l2Networks,
  L1Network,
  L2Network,
} from '../src/lib/dataEntities/networks'
import { Signer } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { isDefined } from '../src/lib/utils/lib'

dotenv.config()

const arbKey = process.env['ARB_KEY'] as string
const ethKey = process.env['ETH_KEY'] as string

const defaultNetworkId = 421613

export const instantiateBridge = (
  l1PkParam?: string,
  l2PkParam?: string
): {
  l1Network: L1Network
  l2Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
} => {
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
  const isL1 = isDefined(l1Networks[l2NetworkID])
  const isL2 = isDefined(l2Networks[l2NetworkID])
  if (!isL1 && !isL2) {
    throw new Error(`Unrecognized network ID: ${l2NetworkID}`)
  }
  if (!isL2) {
    throw new Error(`Tests must specify an L2 network ID: ${l2NetworkID}`)
  }

  const l2Network = l2Networks[l2NetworkID]
  const l1Network = l1Networks[l2Network.partnerChainID]

  if (!l1Network) {
    throw new Error(
      `Unrecognised partner chain id: ${l2Network.partnerChainID}`
    )
  }

  const l1Rpc = (() => {
    if (l2NetworkID === 42161) return process.env['MAINNET_RPC'] as string
    if (l2NetworkID === 421613) return process.env['GOERLI_RPC'] as string
    if (l2NetworkID === 1338) return 'http://127.0.0.1:8545/'
    throw new Error(
      'L1 rpc url not set (see .env.sample or networks.ts) or chain id not supported'
    )
  })()
  const l2Rpc = (() => {
    if (l2NetworkID === 42161)
      return process.env['ARB_ONE_RPC'] || 'https://arb1.arbitrum.io/rpc'
    if (l2NetworkID === 421613)
      return (
        process.env['GOERLI_ROLLUP_TESTNET_RPC'] ||
        'https://goerli-rollup.arbitrum.io/rpc'
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
    l1Network,
    l2Network,
    l1Signer,
    l2Signer,
    erc20Bridger: erc20Bridger,
    ethBridger,
    adminErc20Bridger,
    inboxTools,
  }
}
