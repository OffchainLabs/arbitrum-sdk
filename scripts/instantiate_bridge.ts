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
import { BigNumber, Signer } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { execSync } from 'child_process'
import { Bridge__factory } from '../src/lib/abi/factories/Bridge__factory'
import { RollupAdminFacet__factory } from '../src/lib/abi/factories/RollupAdminFacet__factory'
import { deployErc20AndInit } from './deployBridge'

dotenv.config()

const pk = process.env['DEVNET_PRIVKEY'] as string
const mnemonic = process.env['DEV_MNEMONIC'] as string
const verbose = process.env['VERBOSE'] as string

// CHRIS: TODO allow switching between local network and live testnets (eg rinkeby)
const arbUrl = process.env['ARB_URL'] as string
const ethUrl = process.env['ETH_URL'] as string

// const defaultNetworkId = 421611

export const getCustomNetworks = async (
  l1Url: string,
  l2Url: string
): Promise<{
  l1Network: L1Network
  l2Network: Omit<L2Network, 'tokenBridge'>
}> => {
  const l1Provider = new JsonRpcProvider(l1Url)
  const l2Provider = new JsonRpcProvider(l2Url)
  const deploymentData = execSync(
    'docker exec nitro_sequencer_1 cat /deploydata/deployment.json'
  ).toString()
  const parsedDeploymentData = JSON.parse(deploymentData) as {
    Bridge: string
    Inbox: string
    SequencerInbox: string
    Rollup: string
  }
  const rollup = RollupAdminFacet__factory.connect(
    parsedDeploymentData.Rollup,
    l1Provider
  )
  const confirmPeriodBlocks = await rollup.confirmPeriodBlocks()

  const bridge = Bridge__factory.connect(
    parsedDeploymentData.Bridge,
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
    rpcURL: l1Url,
  }

  const l2Network: Omit<L2Network, 'tokenBridge'> = {
    chainID: l2NetworkInfo.chainId,
    confirmPeriodBlocks: confirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge: parsedDeploymentData.Bridge,
      inbox: parsedDeploymentData.Inbox,
      outboxes: {
        [outboxAddr]: BigNumber.from(0),
      },
      rollup: parsedDeploymentData.Rollup,
      sequencerInbox: parsedDeploymentData.SequencerInbox,
    },
    explorerUrl: '',
    isArbitrum: true,
    isCustom: true,
    name: 'ArbLocal',
    partnerChainID: l1NetworkInfo.chainId,
    rpcURL: l2Url,
  }
  return {
    l1Network,
    l2Network,
  }
}

export const setupNetworks = async (l1Deployer: Signer, l2Deployer: Signer) => {
  // CHRIS: TODO: pass in these urls - they should be on the signers already?
  const { l1Network, l2Network: coreL2Network } = await getCustomNetworks(
    ethUrl,
    arbUrl
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

  return {
    l1Network,
    l2Network,
  }
}

// CHRIS: TODO: we shouldnt access environment variables all over the place
const arbGenesisWallet = new Wallet(process.env.ARB_GENESIS_KEY as string)
console.debug('genesis addr', arbGenesisWallet.address)

export const instantiateBridge = async (
  l1pkParam?: string,
  l2PkParam?: string
): Promise<{
  l1Network: L1Network
  l2Network: L2Network
  l1Signer: Signer
  l2Signer: Signer
  erc20Bridger: Erc20Bridger
  ethBridger: EthBridger
  adminErc20Bridger: AdminErc20Bridger
  inboxTools: InboxTools,
  l1Deployer: Signer
  l2Deployer: Signer
}> => {
  if (!l1pkParam) {
    if (!pk && !mnemonic)
      throw new Error('need DEVNET_PRIVKEY or DEV_MNEMONIC env var')

    if (pk && mnemonic)
      throw new Error(
        'You have both a DEVNET_PRIVKEY and DEV_MNEMONIC var set; pick one! '
      )
  }

  const ethProvider = new JsonRpcProvider(ethUrl)
  const arbProvider = new JsonRpcProvider(arbUrl)

  // const arbSigner = arbProvider.getSigner(0)
  const ethDeployer = ethProvider.getSigner(0)
  // console.log(
  //   (await ethDeployer.getAddress()).toString(),
  //   (await ethDeployer.getBalance()).toString()
  // )
  const arbDeployer = arbGenesisWallet.connect(arbProvider)
  // console.log(
  //   (await arbDeployer.getAddress()).toString(),
  //   (await arbDeployer.getBalance()).toString()
  // )
  // console.log(
  //   (await arbSigner.getAddress()).toString(),
  //   (await arbSigner.getBalance()).toString()
  // )

  // CHRIS: TODO: this l1signer and the l2signer
  // CHRIS: TODO: should they be the deployer or the user?
  const l1Signer = (() => {
    if (l1pkParam) {
      return new Wallet(l1pkParam, ethProvider)
    } else if (mnemonic) {
      return Wallet.fromMnemonic(mnemonic).connect(ethProvider)
    } else if (pk) {
      return new Wallet(pk, ethProvider)
    } else {
      throw new Error('impossible path')
    }
  })()

  const l2Signer = (() => {
    if (l2PkParam) {
      return new Wallet(l2PkParam, arbProvider)
    } else if (mnemonic) {
      return Wallet.fromMnemonic(mnemonic).connect(arbProvider)
    } else if (pk) {
      return new Wallet(pk, arbProvider)
    } else {
      throw new Error('impossible path')
    }
  })()

  if (verbose) {
    console.log('')
    console.log(
      '**** Bridger instantiated w/ address',
      l1Signer.address,
      '****'
    )
    console.log('')
  }

  let l1Network: L1Network
  let l2Network: L2Network
  try {
    l1Network = await getL1Network(ethDeployer)
    l2Network = await getL2Network(arbDeployer)
  } catch (err) {
    // ok if this fails
    const setup = await setupNetworks(ethDeployer, arbDeployer)
    l1Network = setup.l1Network
    l2Network = setup.l2Network
    addCustomNetwork({
      customL1Network: l1Network,
      customL2Network: l2Network,
    })
  }

  const erc20Bridger = new Erc20Bridger(l2Network)
  const adminErc20Bridger = new AdminErc20Bridger(l2Network)
  const ethBridger = new EthBridger(l2Network)
  const inboxTools = new InboxTools(l1Signer, l2Network)

  return {
    l1Signer,
    l2Signer,
    l1Network,
    l2Network,
    erc20Bridger,
    adminErc20Bridger,
    ethBridger,
    inboxTools,
    l1Deployer: ethDeployer,
    l2Deployer: arbDeployer
  }
}
