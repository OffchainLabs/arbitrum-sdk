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

import dotenv from 'dotenv'
import { SignerOrProvider } from './signerOrProvider'

import * as classic from '@arbitrum/sdk-classic'
import { l1Networks as classicl1Networks } from '@arbitrum/sdk-classic/dist/lib/dataEntities/networks'
import * as nitro from '@arbitrum/sdk-nitro'
import { l1Networks as nitrol1Networks } from '@arbitrum/sdk-nitro/dist/lib/dataEntities/networks'
import {
  convertNetworkClassicToNitro,
  convertNetworkNitroToClassic,
  isNitroL1,
  isNitroL2,
} from '../utils/migration_types'
import { isDefined } from '../utils/lib'

dotenv.config()

export interface L1Network extends Network {
  partnerChainIDs: number[]
  blockTime: number //seconds
}

export interface L2Network extends Network {
  tokenBridge: TokenBridge
  ethBridge: EthBridge
  partnerChainID: number
  isArbitrum: true
  confirmPeriodBlocks: number
  retryableLifetimeSeconds: number
}
export interface Network {
  chainID: number
  name: string
  explorerUrl: string
  rpcURL: string
  gif?: string
  isCustom: boolean
}

export interface TokenBridge {
  l1GatewayRouter: string
  l2GatewayRouter: string
  l1ERC20Gateway: string
  l2ERC20Gateway: string
  l1CustomGateway: string
  l2CustomGateway: string
  l1WethGateway: string
  l2WethGateway: string
  l2Weth: string
  l1Weth: string
  l1ProxyAdmin: string
  l2ProxyAdmin: string
  l1MultiCall: string
  l2Multicall: string
}

export interface EthBridge {
  bridge: string
  inbox: string
  sequencerInbox: string
  outbox: string
  rollup: string
}

export interface L1Networks {
  [id: string]: L1Network
}

export interface L2Networks {
  [id: string]: L2Network
}

export const getL1Network = async (
  signerOrProvider: SignerOrProvider,
  l2ChainId: number
): Promise<L1Network> => {
  const network = (
    (await isNitroL1(l2ChainId, signerOrProvider)) ? nitro : classic
  ).getL1Network(signerOrProvider)

  return isDefined((await network).rpcURL)
    ? network
    : {
        ...network,
        rpcURL: process.env['L1RPC'],
      }
}
export const getL2Network = async (
  signerOrProvider: SignerOrProvider
): Promise<L2Network> => {
  if (await isNitroL2(signerOrProvider)) {
    return await nitro.getL2Network(signerOrProvider)
  } else {
    return convertNetworkClassicToNitro(
      await classic.getL2Network(signerOrProvider)
    )
  }
}

export const addCustomNetwork = ({
  customL1Network,
  customL2Network,
}: {
  customL1Network?: L1Network
  customL2Network: L2Network
}): void => {
  // we can ignore errors
  if (customL1Network?.chainID)
    delete classicl1Networks[customL1Network.chainID]
  if (customL1Network?.chainID) delete nitrol1Networks[customL1Network.chainID]

  // add to both classic and nitro
  classic.addCustomNetwork({
    customL1Network: customL1Network,
    customL2Network: convertNetworkNitroToClassic(customL2Network),
  })

  nitro.addCustomNetwork({
    customL1Network: customL1Network,
    customL2Network: customL2Network,
  })
}

export const isL1Network = (
  network: L1Network | L2Network
): network is L1Network => {
  if ((network as L1Network).partnerChainIDs) return true
  else return false
}
