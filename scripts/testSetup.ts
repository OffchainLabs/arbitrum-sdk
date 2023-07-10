import { transformUniversalProviderToEthersV5Provider } from './../src/lib/utils/providerTransforms'
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
;('use strict')

import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'

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
import { execSync } from 'child_process'
import { Bridge__factory } from '../src/lib/abi/factories/Bridge__factory'
import { RollupAdminLogic__factory } from '../src/lib/abi/factories/RollupAdminLogic__factory'
import { deployErc20AndInit } from './deployBridge'
import * as path from 'path'
import * as fs from 'fs'
import { ArbSdkError } from '../src/lib/dataEntities/errors'
import { setupViemArbProvider, setupViemEthProvider } from './setupViemProvider'

dotenv.config()

export const config = {
  arbUrl: process.env['ARB_URL'] as string,
  ethUrl: process.env['ETH_URL'] as string,
  arbKey: process.env['ARB_KEY'] as string,
  ethKey: process.env['ETH_KEY'] as string,
  experimentalFeaturesEnabled: process.env['EXPERIMENTAL_FEATURES'] === 'true',
}

function getDeploymentData(): string {
  const dockerNames = [
    'nitro_sequencer_1',
    'nitro-sequencer-1',
    'nitro-testnode-sequencer-1',
    'nitro-testnode_sequencer_1',
  ]
  for (const dockerName of dockerNames) {
    try {
      return execSync(
        'docker exec ' + dockerName + ' cat /config/deployment.json'
      ).toString()
    } catch {
      // empty on purpose
    }
  }
  throw new Error('nitro-testnode sequencer not found')
}

export const getCustomNetworks = async (
  l1Url: string,
  l2Url: string
): Promise<{
  l1Network: L1Network
  l2Network: Omit<L2Network, 'tokenBridge'>
}> => {
  const l1Provider = new JsonRpcProvider(l1Url)
  const l2Provider = new JsonRpcProvider(l2Url)
  const deploymentData = getDeploymentData()
  const parsedDeploymentData = JSON.parse(deploymentData) as {
    bridge: string
    inbox: string
    ['sequencer-inbox']: string
    rollup: string
  }

  const rollup = RollupAdminLogic__factory.connect(
    parsedDeploymentData.rollup,
    l1Provider
  )
  const confirmPeriodBlocks = await rollup.confirmPeriodBlocks()

  const bridge = Bridge__factory.connect(
    parsedDeploymentData.bridge,
    l1Provider
  )
  const outboxAddr = await bridge.allowedOutboxList(0)

  const l1NetworkInfo = await l1Provider.getNetwork()
  const l2NetworkInfo = await l2Provider.getNetwork()

  const l1Network: L1Network = {
    blockTime: 10,
    chainID: l1NetworkInfo.chainId,
    explorerUrl: '',
    isCustom: true,
    name: 'EthLocal',
    partnerChainIDs: [l2NetworkInfo.chainId],
    isArbitrum: false,
  }

  const l2Network: Omit<L2Network, 'tokenBridge'> = {
    chainID: l2NetworkInfo.chainId,
    confirmPeriodBlocks: confirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge: parsedDeploymentData.bridge,
      inbox: parsedDeploymentData.inbox,
      outbox: outboxAddr,
      rollup: parsedDeploymentData.rollup,
      sequencerInbox: parsedDeploymentData['sequencer-inbox'],
    },
    explorerUrl: '',
    isArbitrum: true,
    isCustom: true,
    name: 'ArbLocal',
    partnerChainID: l1NetworkInfo.chainId,
    retryableLifetimeSeconds: 7 * 24 * 60 * 60,
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 900000,
  }
  return {
    l1Network,
    l2Network,
  }
}

export const setupNetworks = async (
  l1Deployer: Signer,
  l2Deployer: Signer,
  l1Url: string,
  l2Url: string
) => {
  const { l1Network, l2Network: coreL2Network } = await getCustomNetworks(
    l1Url,
    l2Url
  )
  const { l1: l1Contracts, l2: l2Contracts } = await deployErc20AndInit(
    l1Deployer,
    l2Deployer,
    coreL2Network.ethBridge.inbox
  )
  const l2Network: L2Network = {
    ...coreL2Network,
    tokenBridge: {
      l1CustomGateway: l1Contracts.customGateway.address,
      l1ERC20Gateway: l1Contracts.standardGateway.address,
      l1GatewayRouter: l1Contracts.router.address,
      l1MultiCall: l1Contracts.multicall.address,
      l1ProxyAdmin: l1Contracts.proxyAdmin.address,
      l1Weth: l1Contracts.weth.address,
      l1WethGateway: l1Contracts.wethGateway.address,

      l2CustomGateway: l2Contracts.customGateway.address,
      l2ERC20Gateway: l2Contracts.standardGateway.address,
      l2GatewayRouter: l2Contracts.router.address,
      l2Multicall: l2Contracts.multicall.address,
      l2ProxyAdmin: l2Contracts.proxyAdmin.address,
      l2Weth: l2Contracts.weth.address,
      l2WethGateway: l2Contracts.wethGateway.address,
    },
  }

  addCustomNetwork({
    customL1Network: l1Network,
    customL2Network: l2Network,
  })

  // also register the weth gateway
  // we add it here rather than in deployBridge because
  // we have access to an adminerc20bridger
  const adminErc20Bridger = new AdminErc20Bridger(l2Network)
  await (
    await (
      await adminErc20Bridger.setGateways(l1Deployer, l2Deployer.provider!, [
        {
          gatewayAddr: l2Network.tokenBridge.l1WethGateway,
          tokenAddr: l2Network.tokenBridge.l1Weth,
        },
      ])
    ).wait()
  ).waitForL2(l2Deployer)

  return {
    l1Network,
    l2Network,
  }
}

export const getSigner = (provider: any, key?: string) => {
  if (!key && !provider)
    throw new ArbSdkError('Provide at least one of key or provider.')
  if (key) return new Wallet(key).connect(provider)
  else return provider.getSigner(0)
}

export const testSetup = async (): Promise<{
  l1Network: L1Network
  l2Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
  l1Deployer: Signer
  l2Deployer: Signer
}> => {
  let ethProvider
  let arbProvider

  if (config.experimentalFeaturesEnabled) {
    console.log('Experimental features enabled')
    ethProvider = await transformUniversalProviderToEthersV5Provider(
      setupViemEthProvider(config)
    )

    arbProvider = await transformUniversalProviderToEthersV5Provider(
      setupViemArbProvider(config)
    )
  } else {
    ethProvider = new JsonRpcProvider(config.ethUrl)
    arbProvider = new JsonRpcProvider(config.arbUrl)
  }

  const l1Deployer = getSigner(ethProvider, config.ethKey)
  const l2Deployer = getSigner(arbProvider, config.arbKey)

  const seed = Wallet.createRandom()
  const l1Signer = seed.connect(ethProvider)
  const l2Signer = seed.connect(arbProvider)

  let setL1Network: L1Network, setL2Network: L2Network
  try {
    const l1Network = await getL1Network(l1Deployer)
    const l2Network = await getL2Network(l2Deployer)
    setL1Network = l1Network
    setL2Network = l2Network
  } catch (err) {
    // the networks havent been added yet

    // check if theres an existing network available
    const localNetworkFile = path.join(__dirname, '..', 'localNetwork.json')
    if (fs.existsSync(localNetworkFile)) {
      const { l1Network, l2Network } = JSON.parse(
        fs.readFileSync(localNetworkFile).toString()
      ) as {
        l1Network: L1Network
        l2Network: L2Network
      }
      addCustomNetwork({
        customL1Network: l1Network,
        customL2Network: l2Network,
      })
      setL1Network = l1Network
      setL2Network = l2Network
    } else {
      // deploy a new network
      const { l1Network, l2Network } = await setupNetworks(
        l1Deployer,
        l2Deployer,
        config.ethUrl,
        config.arbUrl
      )
      setL1Network = l1Network
      setL2Network = l2Network
    }
  }

  const erc20Bridger = new Erc20Bridger(setL2Network)
  const adminErc20Bridger = new AdminErc20Bridger(setL2Network)
  const ethBridger = new EthBridger(setL2Network)
  const inboxTools = new InboxTools(l1Signer, setL2Network)

  return {
    l1Signer,
    l2Signer,
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
