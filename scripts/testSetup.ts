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
import { EthBridger, InboxTools, Erc20Bridger } from '../src'
import {
  L1Network,
  L2Network,
  getL1Network,
  getL2Network,
  addCustomNetwork,
} from '../src/lib/dataEntities/networks'
import { Signer, providers } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { execSync } from 'child_process'
import { Bridge__factory } from '../src/lib/abi/factories/Bridge__factory'
import { RollupAdminLogic__factory } from '../src/lib/abi/factories/RollupAdminLogic__factory'
import { deployErc20AndInit } from './deployBridge'
import * as path from 'path'
import * as fs from 'fs'
import { ArbSdkError } from '../src/lib/dataEntities/errors'
import { ARB_MINIMUM_BLOCK_TIME_IN_SECONDS } from '../src/lib/dataEntities/constants'

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

type DeploymentData = {
  bridge: string
  inbox: string
  ['sequencer-inbox']: string
  rollup: string
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

function getL3DeploymentData() {
  const dockerNames = ['nitro-testnode-l3node-1']
  for (const dockerName of dockerNames) {
    try {
      return execSync(
        'docker exec ' + dockerName + ' cat /config/l3deployment.json'
      ).toString()
    } catch {
      // empty on purpose
    }
  }
  throw new Error('nitro-testnode-l3node sequencer not found')
}

export const getCustomNetworks = async (
  l1Url: string,
  l2Url: string
): Promise<{
  customL1Network: L1Network
  customL2Network: L2Network
}> => {
  const l1Provider = new JsonRpcProvider(l1Url)
  const l2Provider = new JsonRpcProvider(l2Url)
  const deploymentData = getDeploymentData()
  const parsedDeploymentData = JSON.parse(deploymentData) as DeploymentData

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

  const l2Network: L2Network = {
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
    tokenBridge: {
      l1CustomGateway: '',
      l1ERC20Gateway: '',
      l1GatewayRouter: '',
      l1MultiCall: '',
      l1ProxyAdmin: '',
      l1Weth: '',
      l1WethGateway: '',
      l2CustomGateway: '',
      l2ERC20Gateway: '',
      l2GatewayRouter: '',
      l2Multicall: '',
      l2ProxyAdmin: '',
      l2Weth: '',
      l2WethGateway: '',
    },
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
    partnerChainIDs: [],
  }

  return {
    customL1Network: l1Network,
    customL2Network: l2Network,
  }
}

/**
 * Adds the L1 and L2 networks (as defined in the environment) to the global network registry
 */
const setupL1NetworkForOrbit = async (): Promise<{
  l2Network: L2Network
  l2Provider: providers.Provider
}> => {
  const l1Provider = new JsonRpcProvider(process.env['ETH_URL'])
  const l2Provider = new JsonRpcProvider(process.env['ARB_URL'])

  const deploymentData = getDeploymentData()
  const parsedDeploymentData = JSON.parse(deploymentData) as DeploymentData

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

  const l2Network = await getCustomOrbitNetwork(
    parsedDeploymentData,
    l1Provider,
    l2Provider
  )

  // addCustomNetwork({
  //   customL1Network: l1Network,
  //   customL2Network: l2Network,
  // })

  return { l2Network, l2Provider }
}

/**
 * Adds the L3 network (as defined in the environment) to the global network registry
 */
const setupOrbitNetworks = async (): Promise<{
  customL1Network: L2Network
  customL2Network: L2Network
}> => {
  const { l2Network, l2Provider } = await setupL1NetworkForOrbit()
  const l3Provider = new JsonRpcProvider(process.env['ORBIT_URL'])

  const l3DeploymentData = getL3DeploymentData()
  const parsedL3DeploymentData = JSON.parse(l3DeploymentData) as DeploymentData
  const l3Network = await getCustomOrbitNetwork(
    parsedL3DeploymentData,
    l2Provider,
    l3Provider
  )

  return {
    customL1Network: l2Network,
    customL2Network: l3Network,
  }
}

/**
 * Builds a child network configuration object from deployment data
 *
 * @note `l1Provider` and `l2Provider` can be a `l2Provider` and `l3Provider` in a parent-child
 * relationship. They will be renamed in the next major version.
 */
async function getCustomOrbitNetwork(
  deploymentData: DeploymentData,
  l1Provider: providers.Provider,
  l2Provider: providers.Provider
) {
  const rollup = RollupAdminLogic__factory.connect(
    deploymentData.rollup,
    l1Provider
  )
  const confirmPeriodBlocks = await rollup.confirmPeriodBlocks()

  const bridge = Bridge__factory.connect(deploymentData.bridge, l1Provider)
  const outboxAddr = await bridge.allowedOutboxList(0)

  const l1NetworkInfo = await l1Provider.getNetwork()
  const l2NetworkInfo = await l2Provider.getNetwork()

  const l2Network: L2Network = {
    chainID: l2NetworkInfo.chainId,
    confirmPeriodBlocks: confirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge: deploymentData.bridge,
      inbox: deploymentData.inbox,
      outbox: outboxAddr,
      rollup: deploymentData.rollup,
      sequencerInbox: deploymentData['sequencer-inbox'],
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
    tokenBridge: {
      l1CustomGateway: '',
      l1ERC20Gateway: '',
      l1GatewayRouter: '',
      l1MultiCall: '',
      l1ProxyAdmin: '',
      l1Weth: '',
      l1WethGateway: '',
      l2CustomGateway: '',
      l2ERC20Gateway: '',
      l2GatewayRouter: '',
      l2Multicall: '',
      l2ProxyAdmin: '',
      l2Weth: '',
      l2WethGateway: '',
    },
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
    partnerChainIDs: [],
  }

  return l2Network
}

/**
 * Builds network configuration and deploys the token bridge contracts
 *
 * @note `l1Deployer`/`l2Deployer` and `l1Url`/`l2url` can refer to an `L2` or `L3` in a
 * parent-child relationship. They will be renamed in the next major version.
 */
export const setupNetworks = async (
  l1Deployer: Signer,
  l2Deployer: Signer,
  l1Url: string,
  l2Url: string,
  shouldSetupOrbit: boolean,
  l1WethOverride?: string
) => {
  const customNetworks = shouldSetupOrbit
    ? await setupOrbitNetworks()
    : await getCustomNetworks(l1Url, l2Url)

  const { l1: l1Contracts, l2: l2Contracts } = await deployErc20AndInit(
    l1Deployer,
    l2Deployer,
    customNetworks.customL2Network.ethBridge.inbox,
    l1WethOverride
  )

  const l2Network: L2Network = {
    ...customNetworks.customL2Network,
    tokenBridge: {
      l1CustomGateway: l1Contracts.customGateway.address,
      l1ERC20Gateway: l1Contracts.standardGateway.address,
      l1GatewayRouter: l1Contracts.router.address,
      l1MultiCall: l1Contracts.multicall.address,
      l1ProxyAdmin: l1Contracts.proxyAdmin.address,
      l1Weth: l1WethOverride || l1Contracts.weth.address,
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

  // in case of L3, we only need to add the L3, as L1 and L2 were registered inside "setupL1NetworkForOrbit"
  // register the network with the newly deployed token bridge contracts
  if (shouldSetupOrbit) {
    addCustomNetwork({ customL2Network: l2Network })
  } else {
    addCustomNetwork({ ...customNetworks, customL2Network: l2Network })
  }

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
    l1Network: customNetworks.customL1Network,
    l2Network,
  }
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

      if (isTestingOrbitChains) {
        await setupL1NetworkForOrbit()
        addCustomNetwork({ customL2Network: l2Network })
      } else {
        addCustomNetwork({
          customL1Network: l1Network,
          customL2Network: l2Network,
        })
      }

      setL1Network = l1Network
      setL2Network = l2Network
    } else {
      let l1WethOverride: string | undefined

      if (isTestingOrbitChains) {
        //deploy l1/l2 bridge
        const l1Url = process.env['ETH_URL']!
        const l2Url = process.env['ARB_URL']!
        const ethProvider = new JsonRpcProvider(l1Url)
        const arbProvider = new JsonRpcProvider(l2Url)
        const l1Deployer = getSigner(ethProvider, process.env['ETH_KEY'])
        const l2Deployer = getSigner(arbProvider, process.env['ARB_KEY'])
        const { l2Network: arbNetwork } = await setupNetworks(
          l1Deployer,
          l2Deployer,
          l1Url,
          l2Url,
          false
        )

        l1WethOverride = arbNetwork.tokenBridge.l2Weth
      }

      // deploy a new network
      const { l1Network, l2Network } = await setupNetworks(
        l1Deployer,
        l2Deployer,
        config.ethUrl,
        config.arbUrl,
        isTestingOrbitChains,
        l1WethOverride
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
