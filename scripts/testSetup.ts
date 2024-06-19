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
import { Provider } from '@ethersproject/abstract-provider'
import dotenv from 'dotenv'

import { EthBridger, InboxTools, Erc20Bridger } from '../src'
import {
  L1Network,
  L2Network,
  getL1Network,
  getL2Network,
  addCustomNetwork,
} from '../src/lib/dataEntities/networks'
import { Signer } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import * as path from 'path'
import * as fs from 'fs'
import { ArbSdkError } from '../src/lib/dataEntities/errors'
import {
  approveL1CustomFeeToken,
  fundL1CustomFeeToken,
  isL2NetworkWithCustomFeeToken,
} from '../tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import { fundL1 } from '../tests/integration/testHelpers'

dotenv.config()

const isTestingOrbitChains = process.env.ORBIT_TEST === '1'

/**
 * The RPC urls and private keys using during testing
 *
 * @note When the `ORBIT_TEST` env variable is `true`, we treat `ethUrl` as the L2 and `arbUrl` as the L3
 */
export const config = isTestingOrbitChains
  ? {
      arbUrl: process.env['ORBIT_URL'] as string,
      ethUrl: process.env['ARB_URL'] as string,
      arbKey: process.env['ORBIT_KEY'] as string,
      ethKey: process.env['ARB_KEY'] as string,
    }
  : {
      arbUrl: process.env['ARB_URL'] as string,
      ethUrl: process.env['ETH_URL'] as string,
      arbKey: process.env['ARB_KEY'] as string,
      ethKey: process.env['ETH_KEY'] as string,
    }

export const getSigner = (provider: JsonRpcProvider, key?: string) => {
  if (!key && !provider)
    throw new ArbSdkError('Provide at least one of key or provider.')
  if (key) return new Wallet(key).connect(provider)
  else return provider.getSigner(0)
}

export const testSetup = async (): Promise<{
  l1Network: L1Network | L2Network
  l2Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  l1Provider: Provider
  l2Provider: Provider
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
  l1Deployer: Signer
  l2Deployer: Signer
}> => {
  const ethProvider = new JsonRpcProvider(config.ethUrl)
  const arbProvider = new JsonRpcProvider(config.arbUrl)

  const l1Deployer = getSigner(ethProvider, config.ethKey)
  const l2Deployer = getSigner(arbProvider, config.arbKey)

  const seed = Wallet.createRandom()
  const l1Signer = seed.connect(ethProvider)
  const l2Signer = seed.connect(arbProvider)

  let setL1Network: L1Network | L2Network, setL2Network: L2Network
  try {
    const l1Network = isTestingOrbitChains
      ? await getL2Network(l1Deployer)
      : await getL1Network(l1Deployer)
    const l2Network = await getL2Network(l2Deployer)
    setL1Network = l1Network
    setL2Network = l2Network
  } catch (err) {
    // the networks havent been added yet

    // check if theres an existing network available
    const localNetworkFile = getLocalNetworksFromFile()

    const { l1Network, l2Network } = localNetworkFile

    if (isTestingOrbitChains) {
      const _l1Network = l1Network as L2Network
      const ethLocal: L1Network = {
        blockTime: 10,
        chainID: _l1Network.partnerChainID,
        explorerUrl: '',
        isCustom: true,
        name: 'EthLocal',
        partnerChainIDs: [_l1Network.chainID],
        isArbitrum: false,
      }

      addCustomNetwork({
        customL1Network: ethLocal,
        customL2Network: _l1Network,
      })

      addCustomNetwork({
        customL2Network: l2Network,
      })

      setL1Network = l1Network
      setL2Network = l2Network
    } else {
      addCustomNetwork({
        customL1Network: l1Network as L1Network,
        customL2Network: l2Network,
      })

      setL1Network = l1Network
      setL2Network = l2Network
    }
  }

  const erc20Bridger = new Erc20Bridger(setL2Network)
  const adminErc20Bridger = new AdminErc20Bridger(setL2Network)
  const ethBridger = new EthBridger(setL2Network)
  const inboxTools = new InboxTools(l1Signer, setL2Network)

  if (isL2NetworkWithCustomFeeToken()) {
    await fundL1(l1Signer)
    await fundL1CustomFeeToken(l1Signer)
    await approveL1CustomFeeToken(l1Signer)
  }

  return {
    l1Signer,
    l2Signer,
    l1Provider: ethProvider,
    l2Provider: arbProvider,
    l1Network: setL1Network,
    l2Network: setL2Network,
    erc20Bridger,
    adminErc20Bridger,
    ethBridger,
    inboxTools,
    l1Deployer,
    l2Deployer,
  }
}

export function getLocalNetworksFromFile(): {
  l1Network: L1Network | L2Network
  l2Network: L2Network
} {
  const pathToLocalNetworkFile = path.join(__dirname, '..', 'localNetwork.json')
  if (!fs.existsSync(pathToLocalNetworkFile)) {
    throw new ArbSdkError('localNetwork.json not found, must gen:network first')
  }
  const localNetworksFile = fs.readFileSync(pathToLocalNetworkFile, 'utf8')
  return JSON.parse(localNetworksFile)
}
