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

import { SignerOrProvider, SignerProviderUtils } from './signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SEVEN_DAYS_IN_SECONDS,
  ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
} from './constants'
import { RollupAdminLogic__factory } from '../abi/factories/RollupAdminLogic__factory'

export interface Network {
  chainID: number
  name: string
  explorerUrl: string
  gif?: string
  isCustom: boolean
  /**
   * Minimum possible block time for the chain (in seconds).
   */
  blockTime: number
  /**
   * Chain ids of children chains, i.e. chains that settle to this chain.
   */
  partnerChainIDs: number[]
}

/**
 * Represents an L1 chain, e.g. Ethereum Mainnet or Sepolia.
 */
export interface L1Network extends Network {
  isArbitrum: false
}

/**
 * Represents an Arbitrum chain, e.g. Arbitrum One, Arbitrum Sepolia, or an L3 chain.
 */
export interface L2Network extends Network {
  tokenBridge: TokenBridge
  ethBridge: EthBridge
  /**
   * Chain id of the parent chain, i.e. the chain on which this chain settles to.
   */
  partnerChainID: number
  isArbitrum: true
  confirmPeriodBlocks: number
  retryableLifetimeSeconds: number
  nitroGenesisBlock: number
  nitroGenesisL1Block: number
  /**
   * How long to wait (ms) for a deposit to arrive on l2 before timing out a request
   */
  depositTimeout: number
  /**
   * In case of a chain that uses ETH as its native/gas token, this is either `undefined` or the zero address
   *
   * In case of a chain that uses an ERC-20 token from the parent chain as its native/gas token, this is the address of said token on the parent chain
   */
  nativeToken?: string
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
  classicOutboxes?: {
    [addr: string]: number
  }
}

export interface L1Networks {
  [id: string]: L1Network
}

export interface L2Networks {
  [id: string]: L2Network
}

export interface Networks {
  [id: string]: L1Network | L2Network
}

const mainnetTokenBridge: TokenBridge = {
  l1GatewayRouter: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
  l2GatewayRouter: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
  l1ERC20Gateway: '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
  l2ERC20Gateway: '0x09e9222E96E7B4AE2a407B98d48e330053351EEe',
  l1CustomGateway: '0xcEe284F754E854890e311e3280b767F80797180d',
  l2CustomGateway: '0x096760F208390250649E3e8763348E783AEF5562',
  l1WethGateway: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
  l2WethGateway: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
  l2Weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  l1Weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  l1ProxyAdmin: '0x9aD46fac0Cf7f790E5be05A0F15223935A0c0aDa',
  l2ProxyAdmin: '0xd570aCE65C43af47101fC6250FD6fC63D1c22a86',
  l1MultiCall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  l2Multicall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
}

const mainnetETHBridge: EthBridge = {
  bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
  inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
  outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
  rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
  classicOutboxes: {
    '0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a': 0,
    '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40': 30,
  },
}

/**
 * Storage for all networks, either L1, L2 or L3.
 */
export const networks: Networks = {
  1: {
    chainID: 1,
    name: 'Mainnet',
    explorerUrl: 'https://etherscan.io',
    partnerChainIDs: [42161, 42170],
    blockTime: 14,
    isCustom: false,
    isArbitrum: false,
  },
  1338: {
    chainID: 1338,
    name: 'Hardhat_Mainnet_Fork',
    explorerUrl: 'https://etherscan.io',
    partnerChainIDs: [42161],
    blockTime: 1,
    isCustom: false,
    isArbitrum: false,
  },
  5: {
    blockTime: 15,
    chainID: 5,
    explorerUrl: 'https://goerli.etherscan.io',
    isCustom: false,
    name: 'Goerli',
    partnerChainIDs: [421613],
    isArbitrum: false,
  },
  11155111: {
    chainID: 11155111,
    name: 'Sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
    partnerChainIDs: [421614],
    blockTime: 12,
    isCustom: false,
    isArbitrum: false,
  },
  42161: {
    chainID: 42161,
    name: 'Arbitrum One',
    explorerUrl: 'https://arbiscan.io',
    partnerChainID: 1,
    partnerChainIDs: [],
    isArbitrum: true,
    tokenBridge: mainnetTokenBridge,
    ethBridge: mainnetETHBridge,
    confirmPeriodBlocks: 45818,
    isCustom: false,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    nitroGenesisBlock: 22207817,
    nitroGenesisL1Block: 15447158,
    /**
     * Finalisation on mainnet can be up to 2 epochs = 64 blocks on mainnet
     * We add 10 minutes for the system to create and redeem the ticket, plus some extra buffer of time
     * (Total timeout: 30 minutes)
     */
    depositTimeout: 1800000,
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  },
  421613: {
    chainID: 421613,
    confirmPeriodBlocks: 20,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    ethBridge: {
      bridge: '0xaf4159A80B6Cc41ED517DB1c453d1Ef5C2e4dB72',
      inbox: '0x6BEbC4925716945D46F0Ec336D5C2564F419682C',
      outbox: '0x45Af9Ed1D03703e480CE7d328fB684bb67DA5049',
      rollup: '0x45e5cAea8768F42B385A366D3551Ad1e0cbFAb17',
      sequencerInbox: '0x0484A87B144745A2E5b7c359552119B6EA2917A9',
    },
    explorerUrl: 'https://goerli.arbiscan.io',
    isArbitrum: true,
    isCustom: false,
    name: 'Arbitrum Rollup Goerli Testnet',
    partnerChainID: 5,
    partnerChainIDs: [],
    tokenBridge: {
      l1CustomGateway: '0x9fDD1C4E4AA24EEc1d913FABea925594a20d43C7',
      l1ERC20Gateway: '0x715D99480b77A8d9D603638e593a539E21345FdF',
      l1GatewayRouter: '0x4c7708168395aEa569453Fc36862D2ffcDaC588c',
      l1MultiCall: '0xa0A8537a683B49ba4bbE23883d984d4684e0acdD',
      l1ProxyAdmin: '0x16101A84B00344221E2983190718bFAba30D9CeE',
      l1Weth: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
      l1WethGateway: '0x6e244cD02BBB8a6dbd7F626f05B2ef82151Ab502',
      l2CustomGateway: '0x8b6990830cF135318f75182487A4D7698549C717',
      l2ERC20Gateway: '0x2eC7Bc552CE8E51f098325D2FcF0d3b9d3d2A9a2',
      l2GatewayRouter: '0xE5B9d8d42d656d1DcB8065A6c012FE3780246041',
      l2Multicall: '0x108B25170319f38DbED14cA9716C54E5D1FF4623',
      l2ProxyAdmin: '0xeC377B42712608B0356CC54Da81B2be1A4982bAb',
      l2Weth: '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3',
      l2WethGateway: '0xf9F2e89c8347BD96742Cc07095dee490e64301d6',
    },
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    /**
     * Low validator participation on goerli means that it can take a long time to finalise
     * Wait 10 epochs there on goerli = 320 blocks. Each block is 12 seconds.
     */
    depositTimeout: 3960000,
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  },
  42170: {
    chainID: 42170,
    confirmPeriodBlocks: 45818,
    ethBridge: {
      bridge: '0xC1Ebd02f738644983b6C4B2d440b8e77DdE276Bd',
      inbox: '0xc4448b71118c9071Bcb9734A0EAc55D18A153949',
      outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
      rollup: '0xFb209827c58283535b744575e11953DCC4bEAD88',
      sequencerInbox: '0x211E1c4c7f1bF5351Ac850Ed10FD68CFfCF6c21b',
    },
    explorerUrl: 'https://nova.arbiscan.io',
    isArbitrum: true,
    isCustom: false,
    name: 'Arbitrum Nova',
    partnerChainID: 1,
    partnerChainIDs: [],
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    tokenBridge: {
      l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
      l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
      l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
      l1MultiCall: '0x8896D23AfEA159a5e9b72C9Eb3DC4E2684A38EA3',
      l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
      l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
      l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
      l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
      l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
      l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
      l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
      l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
      l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
    },
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    /**
     * Finalisation on mainnet can be up to 2 epochs = 64 blocks on mainnet
     * We add 10 minutes for the system to create and redeem the ticket, plus some extra buffer of time
     * (Total timeout: 30 minutes)
     */
    depositTimeout: 1800000,
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  },
  421614: {
    chainID: 421614,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9',
      inbox: '0xaAe29B0366299461418F5324a79Afc425BE5ae21',
      outbox: '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F',
      rollup: '0xd80810638dbDF9081b72C1B33c65375e807281C8',
      sequencerInbox: '0x6c97864CE4bEf387dE0b3310A44230f7E3F1be0D',
    },
    explorerUrl: 'https://sepolia-explorer.arbitrum.io',
    isArbitrum: true,
    isCustom: false,
    name: 'Arbitrum Rollup Sepolia Testnet',
    partnerChainID: 11155111,
    partnerChainIDs: [23011913],
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    tokenBridge: {
      l1CustomGateway: '0xba2F7B6eAe1F9d174199C5E4867b563E0eaC40F3',
      l1ERC20Gateway: '0x902b3E5f8F19571859F4AB1003B960a5dF693aFF',
      l1GatewayRouter: '0xcE18836b233C83325Cc8848CA4487e94C6288264',
      l1MultiCall: '0xded9AD2E65F3c4315745dD915Dbe0A4Df61b2320',
      l1ProxyAdmin: '0xDBFC2FfB44A5D841aB42b0882711ed6e5A9244b0',
      l1Weth: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      l1WethGateway: '0xA8aD8d7e13cbf556eE75CB0324c13535d8100e1E',
      l2CustomGateway: '0x8Ca1e1AC0f260BC4dA7Dd60aCA6CA66208E642C5',
      l2ERC20Gateway: '0x6e244cD02BBB8a6dbd7F626f05B2ef82151Ab502',
      l2GatewayRouter: '0x9fDD1C4E4AA24EEc1d913FABea925594a20d43C7',
      l2Multicall: '0xA115146782b7143fAdB3065D86eACB54c169d092',
      l2ProxyAdmin: '0x715D99480b77A8d9D603638e593a539E21345FdF',
      l2Weth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      l2WethGateway: '0xCFB1f08A4852699a979909e22c30263ca249556D',
    },
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 1800000,
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  },
  23011913: {
    chainID: 23011913,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x35aa95ac4747D928E2Cd42FE4461F6D9d1826346',
      inbox: '0xe1e3b1CBaCC870cb6e5F4Bdf246feB6eB5cD351B',
      outbox: '0x98fcA8bFF38a987B988E54273Fa228A52b62E43b',
      rollup: '0x94db9E36d9336cD6F9FfcAd399dDa6Cc05299898',
      sequencerInbox: '0x00A0F15b79d1D3e5991929FaAbCF2AA65623530c',
    },
    explorerUrl: 'https://stylus-testnet-explorer.arbitrum.io',
    isArbitrum: true,
    isCustom: false,
    name: 'Stylus Testnet',
    partnerChainID: 421614,
    partnerChainIDs: [],
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    tokenBridge: {
      l1CustomGateway: '0xd624D491A5Bc32de52a2e1481846752213bF7415',
      l1ERC20Gateway: '0x7348Fdf6F3e090C635b23D970945093455214F3B',
      l1GatewayRouter: '0x0057892cb8bb5f1cE1B3C6f5adE899732249713f',
      l1MultiCall: '0xBEbe3BfBF52FFEA965efdb3f14F2101c0264c940',
      l1ProxyAdmin: '0xB9E77732f32831f09e2a50D6E71B2Cca227544bf',
      l1Weth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      l1WethGateway: '0x39845e4a230434D218b907459a305eBA61A790d4',
      l2CustomGateway: '0xF6dbB0e312dF4652d59ce405F5E00CC3430f19c5',
      l2ERC20Gateway: '0xe027f79CE40a1eF8e47B51d0D46Dc4ea658C5860',
      l2GatewayRouter: '0x4c3a1f7011F02Fe4769fC704359c3696a6A60D89',
      l2Multicall: '0xEb4A260FD16aaf18c04B1aeaDFE20E622e549bd3',
      l2ProxyAdmin: '0xE914c0d417E8250d0237d2F4827ed3612e6A9C3B',
      l2Weth: '0x61Dc4b961D2165623A25EB775260785fE78BD37C',
      l2WethGateway: '0x7021B4Edd9f047772242fc948441d6e0b9121175',
    },
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 900000,
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  },
}

/**
 * Determines if a chain is a parent of *any* other chain. Could be an L1 or an L2 chain.
 */
const isParentChain = (chain: L1Network | L2Network): boolean => {
  return chain.partnerChainIDs.length > 0
}

/**
 * Determines if a chain is an Arbitrum chain. Could be an L2 or an L3 chain.
 */
const isArbitrumNetwork = (
  chain: L1Network | L2Network
): chain is L2Network => {
  return chain.isArbitrum
}

/**
 * Determines if a chain is specifically an L1 chain (not L2 or L3).
 */
export const isL1Network = (
  chain: L1Network | L2Network
): chain is L1Network => {
  return !chain.isArbitrum
}

/**
 * Builds an object that is a list of chains filtered by the provided predicate function indexed by their chain id
 * @param filterFn - A predicate function to determine if a chain should be included.
 * @return An object with only the filtered chains.
 */
const getChainsByType = <T extends typeof networks>(
  filterFn: (chain: L1Network | L2Network) => boolean
): T => {
  return Object.entries(networks).reduce<typeof networks>(
    (accumulator, [chainId, chainData]) => {
      if (filterFn(chainData)) {
        accumulator[chainId] = chainData
      }
      return accumulator
    },
    {}
  ) as T
}

const getL1Chains = () => getChainsByType<L1Networks>(isL1Network)
const getArbitrumChains = () => getChainsByType<L2Networks>(isArbitrumNetwork)

/**
 * Returns the parent chain for the given chain.
 */
export const getParentForNetwork = (chain: L1Network | L2Network) => {
  if (!isArbitrumNetwork(chain)) {
    throw new ArbSdkError(`Chain ${chain.chainID} is not an Arbitrum chain.`)
  }

  const parentChain: L1Network | L2Network | undefined =
    networks[chain.partnerChainID]

  if (!parentChain || !isParentChain(parentChain)) {
    throw new ArbSdkError(
      `Parent chain ${chain.partnerChainID} not recognized for chain ${chain.chainID}.`
    )
  }

  return parentChain
}

/**
 * Returns a list of children chains for the given chain.
 */
const getChildrenForNetwork = (chain: L1Network | L2Network): L2Network[] => {
  const arbitrumChains = getArbitrumChains()

  return Object.values(arbitrumChains).filter(
    arbitrumChain => arbitrumChain.partnerChainID === chain.chainID
  )
}

/**
 * Index of *only* L1 chains that have been added.
 */
export let l1Networks: L1Networks = getL1Chains()

/**
 * Index of all Arbitrum chains that have been added.
 */
export let l2Networks: L2Networks = getArbitrumChains()

/**
 * Returns the network associated with the given Signer, Provider or chain id.
 * @note Throws if the chain is not recognized.
 */
export const getNetwork = async (
  signerOrProviderOrChainID: SignerOrProvider | number,
  layer: 1 | 2
) => {
  const chainID = await (async () => {
    if (typeof signerOrProviderOrChainID === 'number') {
      return signerOrProviderOrChainID
    }
    const provider = SignerProviderUtils.getProviderOrThrow(
      signerOrProviderOrChainID
    )

    const { chainId } = await provider.getNetwork()
    return chainId
  })()

  let network: L1Network | L2Network | undefined = undefined

  if (layer === 1) {
    network = getL1Chains()[chainID]
  } else {
    network = getArbitrumChains()[chainID]
  }

  if (!network) {
    throw new ArbSdkError(`Unrecognized network ${chainID}.`)
  }

  return network
}

/**
 * Returns the L1 chain associated with the given signer, provider or chain id.
 *
 * @note Throws if the chain is not an L1 chain.
 */
export const getL1Network = (
  signerOrProviderOrChainID: SignerOrProvider | number
): Promise<L1Network> => {
  return getNetwork(signerOrProviderOrChainID, 1) as Promise<L1Network>
}

/**
 * Returns the Arbitrum chain associated with the given signer, provider or chain id.
 *
 * @note Throws if the chain is not an Arbitrum chain.
 */
export const getL2Network = (
  signerOrProviderOrChainID: SignerOrProvider | number
): Promise<L2Network> => {
  return getNetwork(signerOrProviderOrChainID, 2) as Promise<L2Network>
}

/**
 * Returns the addresses of all contracts that make up the ETH bridge
 * @param rollupContractAddress Address of the Rollup contract
 * @param l1SignerOrProvider A parent chain signer or provider
 * @returns EthBridge object with all information about the ETH bridge
 */
export const getEthBridgeInformation = async (
  rollupContractAddress: string,
  l1SignerOrProvider: SignerOrProvider
): Promise<EthBridge> => {
  const rollup = RollupAdminLogic__factory.connect(
    rollupContractAddress,
    l1SignerOrProvider
  )

  const [bridge, inbox, sequencerInbox, outbox] = await Promise.all([
    rollup.bridge(),
    rollup.inbox(),
    rollup.sequencerInbox(),
    rollup.outbox(),
  ])

  return {
    bridge,
    inbox,
    sequencerInbox,
    outbox,
    rollup: rollupContractAddress,
  }
}

/**
 * Adds any chain to the global index of networks and updates the parent/child relationships.
 */
const addNetwork = (network: L1Network | L2Network) => {
  // store the network with the rest of the networks
  networks[network.chainID] = network

  // if it's a parent chain (L1 or L2), assign it as parent to all the children
  if (isParentChain(network)) {
    const children = getChildrenForNetwork(network)

    children.forEach(child => {
      child.partnerChainID = network.chainID
    })
  }

  // if it's an arbitrum chain, add it to the parent's list of children
  if (isArbitrumNetwork(network)) {
    const parent: L1Network | L2Network | undefined =
      networks[network.partnerChainID]

    if (!parent) {
      throw new ArbSdkError(
        `Network ${network.chainID}'s parent network ${network.partnerChainID} is not recognized`
      )
    }

    parent.partnerChainIDs = [...parent.partnerChainIDs, network.chainID]
  }

  l1Networks = getL1Chains()
  l2Networks = getArbitrumChains()
}

/**
 * Registers a pair of custom L1 and L2 chains, or a single custom Arbitrum chain (L2 or L3).
 *
 * @param customL1Network the custom L1 chain (optional)
 * @param customL2Network the custom L2 or L3 chain
 */
export const addCustomNetwork = ({
  customL1Network,
  customL2Network,
}: {
  customL1Network?: L1Network
  customL2Network: L2Network
}): void => {
  if (customL1Network) {
    if (customL1Network.chainID !== customL2Network.partnerChainID) {
      throw new ArbSdkError(
        `Partner chain id for L2 network ${customL2Network.chainID} doesn't match the provided L1 network. Expected ${customL1Network.chainID} but got ${customL2Network.partnerChainID}.`
      )
    }

    // check the if the parent chain is in any of the lists
    if (l1Networks[customL1Network.chainID]) {
      throw new ArbSdkError(
        `Network ${customL1Network.chainID} already included`
      )
    } else if (!customL1Network.isCustom) {
      throw new ArbSdkError(
        `Custom network ${customL1Network.chainID} must have isCustom flag set to true`
      )
    }

    addNetwork(customL1Network)
  }

  if (l2Networks[customL2Network.chainID]) {
    throw new ArbSdkError(`Network ${customL2Network.chainID} already included`)
  } else if (!customL2Network.isCustom) {
    throw new ArbSdkError(
      `Custom network ${customL2Network.chainID} must have isCustom flag set to true`
    )
  }

  addNetwork(customL2Network)
}

/**
 * Registers a custom network that matches the one created by a Nitro local node. Useful in development.
 *
 * @see {@link https://github.com/OffchainLabs/nitro}
 */
export const addDefaultLocalNetwork = (): {
  l1Network: L1Network
  l2Network: L2Network
} => {
  const defaultLocalL1Network: L1Network = {
    blockTime: 10,
    chainID: 1337,
    explorerUrl: '',
    isCustom: true,
    name: 'EthLocal',
    partnerChainIDs: [412346],
    isArbitrum: false,
  }

  const defaultLocalL2Network: L2Network = {
    chainID: 412346,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x2b360A9881F21c3d7aa0Ea6cA0De2a3341d4eF3C',
      inbox: '0xfF4a24b22F94979E9ba5f3eb35838AA814bAD6F1',
      outbox: '0x49940929c7cA9b50Ff57a01d3a92817A414E6B9B',
      rollup: '0x65a59D67Da8e710Ef9A01eCa37f83f84AEdeC416',
      sequencerInbox: '0xE7362D0787b51d8C72D504803E5B1d6DcdA89540',
    },
    explorerUrl: '',
    isArbitrum: true,
    isCustom: true,
    name: 'ArbLocal',
    partnerChainID: 1337,
    partnerChainIDs: [],
    retryableLifetimeSeconds: 604800,
    nitroGenesisBlock: 0,
    nitroGenesisL1Block: 0,
    depositTimeout: 900000,
    tokenBridge: {
      l1CustomGateway: '0x3DF948c956e14175f43670407d5796b95Bb219D8',
      l1ERC20Gateway: '0x4A2bA922052bA54e29c5417bC979Daaf7D5Fe4f4',
      l1GatewayRouter: '0x525c2aBA45F66987217323E8a05EA400C65D06DC',
      l1MultiCall: '0xDB2D15a3EB70C347E0D2C2c7861cAFb946baAb48',
      l1ProxyAdmin: '0xe1080224B632A93951A7CFA33EeEa9Fd81558b5e',
      l1Weth: '0x408Da76E87511429485C32E4Ad647DD14823Fdc4',
      l1WethGateway: '0xF5FfD11A55AFD39377411Ab9856474D2a7Cb697e',
      l2CustomGateway: '0x525c2aBA45F66987217323E8a05EA400C65D06DC',
      l2ERC20Gateway: '0xe1080224B632A93951A7CFA33EeEa9Fd81558b5e',
      l2GatewayRouter: '0x1294b86822ff4976BfE136cB06CF43eC7FCF2574',
      l2Multicall: '0xDB2D15a3EB70C347E0D2C2c7861cAFb946baAb48',
      l2ProxyAdmin: '0xda52b25ddB0e3B9CC393b0690Ac62245Ac772527',
      l2Weth: '0x408Da76E87511429485C32E4Ad647DD14823Fdc4',
      l2WethGateway: '0x4A2bA922052bA54e29c5417bC979Daaf7D5Fe4f4',
    },
    blockTime: ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  }

  addCustomNetwork({
    customL1Network: defaultLocalL1Network,
    customL2Network: defaultLocalL2Network,
  })

  return {
    l1Network: defaultLocalL1Network,
    l2Network: defaultLocalL2Network,
  }
}

/**
 * Creates a function that resets the networks index to default. Useful in development.
 */
const createNetworkStateHandler = () => {
  const initialState = JSON.parse(JSON.stringify(networks))

  return {
    resetNetworksToDefault: () => {
      Object.keys(networks).forEach(key => delete networks[key])
      Object.assign(networks, JSON.parse(JSON.stringify(initialState)))
      l1Networks = getL1Chains()
      l2Networks = getArbitrumChains()
    },
  }
}

const { resetNetworksToDefault } = createNetworkStateHandler()

export { resetNetworksToDefault }
