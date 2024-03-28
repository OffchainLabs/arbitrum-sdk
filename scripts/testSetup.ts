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
  getL1Network,
  getL2Network,
  addCustomNetwork,
  ChildChain,
  ParentChain,
  L1Network,
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
  parentChain: ParentChain | ChildChain
  childChain: ChildChain
  parentSigner: Signer
  childSigner: Signer
  parentProvider: Provider
  childProvider: Provider
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
  parentDeployer: Signer
  childDeployer: Signer
}> => {
  const ethProvider = new JsonRpcProvider(config.ethUrl)
  const arbProvider = new JsonRpcProvider(config.arbUrl)

  const parentDeployer = getSigner(ethProvider, config.ethKey)
  const childDeployer = getSigner(arbProvider, config.arbKey)

  const seed = Wallet.createRandom()
  const parentSigner = seed.connect(ethProvider)
  const childSigner = seed.connect(arbProvider)

  let setParentChain: ParentChain, setChildChain: ChildChain
  try {
    const l1Network = isTestingOrbitChains
      ? await getL2Network(parentDeployer)
      : await getL1Network(parentDeployer)
    const l2Network = await getL2Network(childDeployer)
    setParentChain = l1Network
    setChildChain = l2Network
  } catch (err) {
    // the networks havent been added yet

    // check if theres an existing network available
    const localNetworkFile = getLocalNetworksFromFile()

    const { l1Network: parentChain, l2Network: childChain } = localNetworkFile

    if (isTestingOrbitChains) {
      const _parentChain = parentChain as ChildChain
      const ethLocal: ParentChain = {
        blockTime: 10,
        chainID: _parentChain.partnerChainID,
        explorerUrl: '',
        isCustom: true,
        name: 'EthLocal',
        partnerChainIDs: [_parentChain.chainID],
        isArbitrum: false,
      }

      addCustomNetwork({
        customL1Network: ethLocal,
        customArbitrumNetwork: _l1Network,
      })

      addCustomNetwork({
        customArbitrumNetwork: l2Network,
      })

      setParentChain = parentChain
      setChildChain = childChain
    } else {
      addCustomNetwork({
        customL1Network: l1Network as L1Network,
        customArbitrumNetwork: l2Network,
      })

      setParentChain = parentChain
      setChildChain = childChain
    }
  }

  const erc20Bridger = new Erc20Bridger(setChildChain)
  const adminErc20Bridger = new AdminErc20Bridger(setChildChain)
  const ethBridger = new EthBridger(setChildChain)
  const inboxTools = new InboxTools(parentSigner, setChildChain)

  if (isL2NetworkWithCustomFeeToken()) {
    await fundL1(parentSigner)
    await fundL1CustomFeeToken(parentSigner)
    await approveL1CustomFeeToken(parentSigner)
  }

  return {
    parentSigner,
    childSigner,
    parentProvider: ethProvider,
    childProvider: arbProvider,
    parentChain: setParentChain,
    childChain: setChildChain,
    erc20Bridger,
    adminErc20Bridger,
    ethBridger,
    inboxTools,
    parentDeployer,
    childDeployer,
  }
}

export function getLocalNetworksFromFile(): {
  l1Network: ParentChain | ChildChain
  l2Network: ChildChain
} {
  const pathToLocalNetworkFile = path.join(__dirname, '..', 'localNetwork.json')
  if (!fs.existsSync(pathToLocalNetworkFile)) {
    throw new ArbSdkError('localNetwork.json not found, must gen:network first')
  }
  const localNetworksFile = fs.readFileSync(pathToLocalNetworkFile, 'utf8')
  return JSON.parse(localNetworksFile)
}
