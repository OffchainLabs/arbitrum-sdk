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
  addCustomChain,
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

dotenv.config()

export const config = {
  l3Url: process.env['L3_URL'] as string,
  arbUrl: process.env['ARB_URL'] as string,
  ethUrl: process.env['ETH_URL'] as string,
  l3Key: process.env['L3_KEY'] as string,
  arbKey: process.env['ARB_KEY'] as string,
  ethKey: process.env['ETH_KEY'] as string,
}

function getDeploymentData(dockerNames: string[], deploymentPath: string) {
  for (const dockerName of dockerNames) {
    try {
      const str = execSync(
        `docker exec ${dockerName} cat ${deploymentPath}`
      ).toString()

      return JSON.parse(str) as {
        bridge: string
        inbox: string
        ['sequencer-inbox']: string
        rollup: string
      }
    } catch {
      // empty on purpose
    }
  }
  throw new Error(
    `${deploymentPath} not found in any containers ${JSON.stringify(
      dockerNames
    )}`
  )
}

function getL2DeploymentData() {
  return getDeploymentData(
    [
      'nitro_sequencer_1',
      'nitro-sequencer-1',
      'nitro-testnode-sequencer-1',
      'nitro-testnode_sequencer_1',
    ],
    '/config/deployment.json'
  )
}

function getL3DeploymentData() {
  return getDeploymentData(
    [
      'nitro_l3node_1',
      'nitro-l3node-1',
      'nitro-testnode-l3node-1',
      'nitro-testnode_l3node_1',
    ],
    '/config/l3deployment.json'
  )
}

export const getCustomNetworks = async (
  l1Url: string,
  l2Url: string,
  l3Url: string
): Promise<{
  l1Network: L1Network
  l2Network: Omit<L2Network, 'tokenBridge'>
  l3Network: Omit<L2Network, 'tokenBridge'>
}> => {
  const l1Provider = new JsonRpcProvider(l1Url)
  const l2Provider = new JsonRpcProvider(l2Url)
  const l3Provider = new JsonRpcProvider(l3Url)

  const parsedL2DeploymentData = getL2DeploymentData()
  const parsedL3DeploymentData = getL3DeploymentData()

  const l2Rollup = RollupAdminLogic__factory.connect(
    parsedL2DeploymentData.rollup,
    l1Provider
  )
  const l3Rollup = RollupAdminLogic__factory.connect(
    parsedL3DeploymentData.rollup,
    l2Provider
  )

  const l2ConfirmPeriodBlocks = await l2Rollup.confirmPeriodBlocks()
  const l3ConfirmPeriodBlocks = await l3Rollup.confirmPeriodBlocks()

  const l2Bridge = Bridge__factory.connect(
    parsedL2DeploymentData.bridge,
    l1Provider
  )
  const l3Bridge = Bridge__factory.connect(
    parsedL3DeploymentData.bridge,
    l2Provider
  )

  const l2OutboxAddr = await l2Bridge.allowedOutboxList(0)
  const l3OutboxAddr = await l3Bridge.allowedOutboxList(0)

  const l1NetworkInfo = await l1Provider.getNetwork()
  const l2NetworkInfo = await l2Provider.getNetwork()
  const l3NetworkInfo = await l3Provider.getNetwork()

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
    confirmPeriodBlocks: l2ConfirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge: parsedL2DeploymentData.bridge,
      inbox: parsedL2DeploymentData.inbox,
      outbox: l2OutboxAddr,
      rollup: parsedL2DeploymentData.rollup,
      sequencerInbox: parsedL2DeploymentData['sequencer-inbox'],
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

  const l3Network: Omit<L2Network, 'tokenBridge'> = {
    chainID: l3NetworkInfo.chainId,
    confirmPeriodBlocks: l3ConfirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge: parsedL3DeploymentData.bridge,
      inbox: parsedL3DeploymentData.inbox,
      outbox: l3OutboxAddr,
      rollup: parsedL3DeploymentData.rollup,
      sequencerInbox: parsedL3DeploymentData['sequencer-inbox'],
    },
    explorerUrl: '',
    isArbitrum: true,
    isCustom: true,
    name: 'L3Local',
    partnerChainID: l2NetworkInfo.chainId,
    retryableLifetimeSeconds: 7 * 24 * 60 * 60,
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 900000,
  }

  return {
    l1Network,
    l2Network,
    l3Network,
  }
}

export const setupNetworks = async (
  l1Deployer: Signer,
  l2Deployer: Signer,
  l3Deployer: Signer,
  l1Url: string,
  l2Url: string,
  l3Url: string
) => {
  const {
    l1Network,
    l2Network: coreL2Network,
    l3Network: coreL3Network,
  } = await getCustomNetworks(l1Url, l2Url, l3Url)
  const tokenBridgeContracts = await deployErc20AndInit(
    l1Deployer,
    l2Deployer,
    l3Deployer,
    coreL2Network.ethBridge.inbox,
    coreL3Network.ethBridge.inbox
  )

  const l2Network: L2Network = {
    ...coreL2Network,
    tokenBridge: {
      l1CustomGateway: tokenBridgeContracts.l1Parent.customGateway.address,
      l1ERC20Gateway: tokenBridgeContracts.l1Parent.standardGateway.address,
      l1GatewayRouter: tokenBridgeContracts.l1Parent.router.address,
      l1MultiCall: tokenBridgeContracts.l1Parent.multicall.address,
      l1ProxyAdmin: tokenBridgeContracts.l1Parent.proxyAdmin.address,
      l1Weth: tokenBridgeContracts.l1Parent.weth.address,
      l1WethGateway: tokenBridgeContracts.l1Parent.wethGateway.address,

      l2CustomGateway: tokenBridgeContracts.l2Child.customGateway.address,
      l2ERC20Gateway: tokenBridgeContracts.l2Child.standardGateway.address,
      l2GatewayRouter: tokenBridgeContracts.l2Child.router.address,
      l2Multicall: tokenBridgeContracts.l2Child.multicall.address,
      l2ProxyAdmin: tokenBridgeContracts.l2Child.proxyAdmin.address,
      l2Weth: tokenBridgeContracts.l2Child.weth.address,
      l2WethGateway: tokenBridgeContracts.l2Child.wethGateway.address,
    },
  }
  const l3Network: L2Network = {
    ...coreL3Network,
    tokenBridge: {
      l1CustomGateway: tokenBridgeContracts.l2Parent.customGateway.address,
      l1ERC20Gateway: tokenBridgeContracts.l2Parent.standardGateway.address,
      l1GatewayRouter: tokenBridgeContracts.l2Parent.router.address,
      l1MultiCall: tokenBridgeContracts.l2Parent.multicall.address,
      l1ProxyAdmin: tokenBridgeContracts.l2Parent.proxyAdmin.address,
      l1Weth: tokenBridgeContracts.l2Parent.weth.address,
      l1WethGateway: tokenBridgeContracts.l2Parent.wethGateway.address,

      l2CustomGateway: tokenBridgeContracts.l3Child.customGateway.address,
      l2ERC20Gateway: tokenBridgeContracts.l3Child.standardGateway.address,
      l2GatewayRouter: tokenBridgeContracts.l3Child.router.address,
      l2Multicall: tokenBridgeContracts.l3Child.multicall.address,
      l2ProxyAdmin: tokenBridgeContracts.l3Child.proxyAdmin.address,
      l2Weth: tokenBridgeContracts.l3Child.weth.address,
      l2WethGateway: tokenBridgeContracts.l3Child.wethGateway.address,
    },
  }

  addCustomNetwork({
    customL1Network: l1Network,
    customL2Network: l2Network,
  })

  addCustomChain({
    customParentChain: {
      ...l2Network,
      partnerChainIDs: [l3Network.chainID]
    },
    customChain: l3Network,
  })

  // also register the weth gateway
  // we add it here rather than in deployBridge because
  // we have access to an adminerc20bridger
  const registerWethGateway = async (
    parentDeployer: Signer,
    childDeployer: Signer,
    childNetwork: L2Network
  ) => {
    const adminErc20Bridger = new AdminErc20Bridger(childNetwork)
    await (
      await (
        await adminErc20Bridger.setGateways(
          parentDeployer,
          childDeployer.provider!,
          [
            {
              gatewayAddr: childNetwork.tokenBridge.l1WethGateway,
              tokenAddr: childNetwork.tokenBridge.l1Weth,
            },
          ]
        )
      ).wait()
    ).waitForL2(childDeployer)
  }

  await Promise.all([
    registerWethGateway(l1Deployer, l2Deployer, l2Network),
    registerWethGateway(l2Deployer, l3Deployer, l3Network),
  ])

  return {
    l1Network,
    l2Network,
    l3Network,
  }
}

export const getSigner = (provider: JsonRpcProvider, key?: string) => {
  if (!key && !provider)
    throw new ArbSdkError('Provide at least one of key or provider.')
  if (key) return new Wallet(key).connect(provider)
  else return provider.getSigner(0)
}

export const testSetup = async (): Promise<{
  l1Network: L1Network
  l2Network: L2Network
  l3Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  l3Signer: Signer
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools
  l1Deployer: Signer
  l2Deployer: Signer
  l3Deployer: Signer
}> => {
  const ethProvider = new JsonRpcProvider(config.ethUrl)
  const arbProvider = new JsonRpcProvider(config.arbUrl)
  const l3Provider = new JsonRpcProvider(config.l3Url)

  const l1Deployer = getSigner(ethProvider, config.ethKey)
  const l2Deployer = getSigner(arbProvider, config.arbKey)
  const l3Deployer = getSigner(l3Provider, config.l3Key)

  const seed = Wallet.createRandom()
  const l1Signer = seed.connect(ethProvider)
  const l2Signer = seed.connect(arbProvider)
  const l3Signer = seed.connect(l3Provider)

  let setL1Network: L1Network, setL2Network: L2Network, setL3Network: L2Network
  try {
    const l1Network = await getL1Network(l1Deployer)
    const l2Network = await getL2Network(l2Deployer)
    const l3Network = await getL2Network(l3Deployer)
    setL1Network = l1Network
    setL2Network = l2Network
    setL3Network = l3Network
  } catch (err) {
    // the networks havent been added yet

    // check if theres an existing network available
    const localNetworkFile = path.join(__dirname, '..', 'localNetwork.json')
    if (fs.existsSync(localNetworkFile)) {
      const { l1Network, l2Network, l3Network } = JSON.parse(
        fs.readFileSync(localNetworkFile).toString()
      ) as {
        l1Network: L1Network
        l2Network: L2Network
        l3Network: L2Network
      }
      addCustomNetwork({
        customL1Network: l1Network,
        customL2Network: l2Network,
      })
      addCustomChain({
        customParentChain: {
          ...l2Network,
          partnerChainIDs: [l3Network.chainID]
        },
        customChain: l3Network,
      })
      setL1Network = l1Network
      setL2Network = l2Network
      setL3Network = l3Network
    } else {
      // deploy a new network
      const { l1Network, l2Network, l3Network } = await setupNetworks(
        l1Deployer,
        l2Deployer,
        l3Deployer,
        config.ethUrl,
        config.arbUrl,
        config.l3Url
      )
      setL1Network = l1Network
      setL2Network = l2Network
      setL3Network = l3Network
    }
  }

  const erc20Bridger = new Erc20Bridger(setL2Network)
  const adminErc20Bridger = new AdminErc20Bridger(setL2Network)
  const ethBridger = new EthBridger(setL2Network)
  const inboxTools = new InboxTools(l1Signer, setL2Network)

  return {
    l1Signer,
    l2Signer,
    l3Signer,
    l1Network: setL1Network,
    l2Network: setL2Network,
    l3Network: setL3Network,
    erc20Bridger,
    adminErc20Bridger,
    ethBridger,
    inboxTools,
    l1Deployer,
    l2Deployer,
    l3Deployer,
  }
}
