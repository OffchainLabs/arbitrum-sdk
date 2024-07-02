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

import { Provider } from '@ethersproject/abstract-provider'

import { SignerOrProvider, SignerProviderUtils } from './signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { ARB1_NITRO_GENESIS_L2_BLOCK } from './constants'
import { RollupAdminLogic__factory } from '../abi/factories/RollupAdminLogic__factory'
import { Prettify } from '../utils/types'

/**
 * Represents an Arbitrum chain, e.g. Arbitrum One, Arbitrum Sepolia, or an L3 chain.
 */
export interface ArbitrumNetwork {
  /**
   * Name of the chain.
   */
  name: string
  /**
   * Id of the chain.
   */
  chainId: number
  /**
   * Chain id of the parent chain, i.e. the chain on which this chain settles to.
   */
  parentChainId: number
  /**
   * The core contracts
   */
  ethBridge: EthBridge
  /**
   * The token bridge contracts.
   */
  tokenBridge?: TokenBridge
  /**
   * The teleporter contracts.
   */
  teleporter?: Teleporter
  /**
   * The time allowed for validators to dispute or challenge state assertions. Measured in L1 blocks.
   */
  confirmPeriodBlocks: number
  /**
   * Represents how long a retryable ticket lasts for before it expires (in seconds). Defaults to 7 days.
   */
  retryableLifetimeSeconds?: number
  /**
   * In case of a chain that uses ETH as its native/gas token, this is either `undefined` or the zero address
   *
   * In case of a chain that uses an ERC-20 token from the parent chain as its native/gas token, this is the address of said token on the parent chain
   */
  nativeToken?: string
  /**
   * Whether or not the chain was registered by the user.
   */
  isCustom: boolean
  /**
   * Has the network been upgraded to bold. True if yes, otherwise undefined
   * This is a temporary property and will be removed in future if Bold is widely adopted and
   * the legacy challenge protocol is deprecated
   */
  isBold?: boolean
}

/**
 * This type is only here for when you want to achieve backwards compatibility between SDK v3 and v4.
 *
 * Please see {@link ArbitrumNetwork} for the latest type.
 *
 * @deprecated since v4
 */
export type L2Network = Prettify<
  Omit<ArbitrumNetwork, 'chainId' | 'parentChainId' | 'tokenBridge'> & {
    chainID: number
    partnerChainID: number
    tokenBridge: L2NetworkTokenBridge
  }
>

export interface Teleporter {
  l1Teleporter: string
  l2ForwarderFactory: string
}

export interface TokenBridge {
  parentGatewayRouter: string
  childGatewayRouter: string
  parentErc20Gateway: string
  childErc20Gateway: string
  parentCustomGateway: string
  childCustomGateway: string
  parentWethGateway: string
  childWethGateway: string
  parentWeth: string
  childWeth: string
  parentProxyAdmin: string
  childProxyAdmin: string
  parentMultiCall: string
  childMulticall: string
}

/**
 * This type is only here for when you want to achieve backwards compatibility between SDK v3 and v4.
 *
 * Please see {@link TokenBridge} for the latest type.
 *
 * @deprecated since v4
 */
export interface L2NetworkTokenBridge {
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

export interface Networks {
  [id: string]: ArbitrumNetwork
}

const mainnetTokenBridge: TokenBridge = {
  parentGatewayRouter: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
  childGatewayRouter: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
  parentErc20Gateway: '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
  childErc20Gateway: '0x09e9222E96E7B4AE2a407B98d48e330053351EEe',
  parentCustomGateway: '0xcEe284F754E854890e311e3280b767F80797180d',
  childCustomGateway: '0x096760F208390250649E3e8763348E783AEF5562',
  parentWethGateway: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
  childWethGateway: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
  childWeth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  parentWeth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  parentProxyAdmin: '0x9aD46fac0Cf7f790E5be05A0F15223935A0c0aDa',
  childProxyAdmin: '0xd570aCE65C43af47101fC6250FD6fC63D1c22a86',
  parentMultiCall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  childMulticall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
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
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    parentChainId: 1,
    tokenBridge: mainnetTokenBridge,
    ethBridge: mainnetETHBridge,
    teleporter: {
      l1Teleporter: '0xCBd9c6e310D6AaDeF9F025f716284162F0158992',
      l2ForwarderFactory: '0x791d2AbC6c3A459E13B9AdF54Fb5e97B7Af38f87',
    },
    confirmPeriodBlocks: 45818,
    isCustom: false,
  },
  42170: {
    chainId: 42170,
    confirmPeriodBlocks: 45818,
    ethBridge: {
      bridge: '0xC1Ebd02f738644983b6C4B2d440b8e77DdE276Bd',
      inbox: '0xc4448b71118c9071Bcb9734A0EAc55D18A153949',
      outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
      rollup: '0xFb209827c58283535b744575e11953DCC4bEAD88',
      sequencerInbox: '0x211E1c4c7f1bF5351Ac850Ed10FD68CFfCF6c21b',
    },
    isCustom: false,
    name: 'Arbitrum Nova',
    parentChainId: 1,
    tokenBridge: {
      parentCustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
      parentErc20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
      parentGatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
      parentMultiCall: '0x8896D23AfEA159a5e9b72C9Eb3DC4E2684A38EA3',
      parentProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
      parentWeth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      parentWethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
      childCustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
      childErc20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
      childGatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
      childMulticall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
      childProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
      childWeth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
      childWethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
    },
    teleporter: {
      l1Teleporter: '0xCBd9c6e310D6AaDeF9F025f716284162F0158992',
      l2ForwarderFactory: '0x791d2AbC6c3A459E13B9AdF54Fb5e97B7Af38f87',
    },
  },
  421614: {
    chainId: 421614,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9',
      inbox: '0xaAe29B0366299461418F5324a79Afc425BE5ae21',
      outbox: '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F',
      rollup: '0xd80810638dbDF9081b72C1B33c65375e807281C8',
      sequencerInbox: '0x6c97864CE4bEf387dE0b3310A44230f7E3F1be0D',
    },
    isCustom: false,
    name: 'Arbitrum Rollup Sepolia Testnet',
    parentChainId: 11155111,
    tokenBridge: {
      parentCustomGateway: '0xba2F7B6eAe1F9d174199C5E4867b563E0eaC40F3',
      parentErc20Gateway: '0x902b3E5f8F19571859F4AB1003B960a5dF693aFF',
      parentGatewayRouter: '0xcE18836b233C83325Cc8848CA4487e94C6288264',
      parentMultiCall: '0xded9AD2E65F3c4315745dD915Dbe0A4Df61b2320',
      parentProxyAdmin: '0xDBFC2FfB44A5D841aB42b0882711ed6e5A9244b0',
      parentWeth: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      parentWethGateway: '0xA8aD8d7e13cbf556eE75CB0324c13535d8100e1E',
      childCustomGateway: '0x8Ca1e1AC0f260BC4dA7Dd60aCA6CA66208E642C5',
      childErc20Gateway: '0x6e244cD02BBB8a6dbd7F626f05B2ef82151Ab502',
      childGatewayRouter: '0x9fDD1C4E4AA24EEc1d913FABea925594a20d43C7',
      childMulticall: '0xA115146782b7143fAdB3065D86eACB54c169d092',
      childProxyAdmin: '0x715D99480b77A8d9D603638e593a539E21345FdF',
      childWeth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      childWethGateway: '0xCFB1f08A4852699a979909e22c30263ca249556D',
    },
  },
  23011913: {
    chainId: 23011913,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x35aa95ac4747D928E2Cd42FE4461F6D9d1826346',
      inbox: '0xe1e3b1CBaCC870cb6e5F4Bdf246feB6eB5cD351B',
      outbox: '0x98fcA8bFF38a987B988E54273Fa228A52b62E43b',
      rollup: '0x94db9E36d9336cD6F9FfcAd399dDa6Cc05299898',
      sequencerInbox: '0x00A0F15b79d1D3e5991929FaAbCF2AA65623530c',
    },
    isCustom: false,
    name: 'Stylus Testnet v1',
    parentChainId: 421614,
    tokenBridge: {
      parentCustomGateway: '0xd624D491A5Bc32de52a2e1481846752213bF7415',
      parentErc20Gateway: '0x7348Fdf6F3e090C635b23D970945093455214F3B',
      parentGatewayRouter: '0x0057892cb8bb5f1cE1B3C6f5adE899732249713f',
      parentMultiCall: '0xBEbe3BfBF52FFEA965efdb3f14F2101c0264c940',
      parentProxyAdmin: '0xB9E77732f32831f09e2a50D6E71B2Cca227544bf',
      parentWeth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      parentWethGateway: '0x39845e4a230434D218b907459a305eBA61A790d4',
      childCustomGateway: '0xF6dbB0e312dF4652d59ce405F5E00CC3430f19c5',
      childErc20Gateway: '0xe027f79CE40a1eF8e47B51d0D46Dc4ea658C5860',
      childGatewayRouter: '0x4c3a1f7011F02Fe4769fC704359c3696a6A60D89',
      childMulticall: '0xEb4A260FD16aaf18c04B1aeaDFE20E622e549bd3',
      childProxyAdmin: '0xE914c0d417E8250d0237d2F4827ed3612e6A9C3B',
      childWeth: '0x61Dc4b961D2165623A25EB775260785fE78BD37C',
      childWethGateway: '0x7021B4Edd9f047772242fc948441d6e0b9121175',
    },
    teleporter: {
      l1Teleporter: '0x9E86BbF020594D7FFe05bF32EEDE5b973579A968',
      l2ForwarderFactory: '0x88feBaFBb4E36A4E7E8874E4c9Fd73A9D59C2E7c',
    },
  },
  13331371: {
    chainId: 13331371,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x024a10506f8a27E4CfEDeB18fd30AA1529A2960E',
      inbox: '0xcdCF1F59f5d4A65a3c67E1341f8b85Cba50E0a7C',
      outbox: '0xf731Fc4F7B70A0a6F9915f452d88Dc405a59D8b1',
      rollup: '0x01a8a2b32aa5328466Be47A1808a03aC6c35d94f',
      sequencerInbox: '0x1Ea8B3853355604673e1301A501766EbB2987a09',
    },
    isCustom: false,
    name: 'Stylus Testnet v2',
    parentChainId: 421614,
    tokenBridge: {
      parentCustomGateway: '0x093353B9f723047abf37Ebe01cE48d7dDA8320F4',
      parentErc20Gateway: '0xD2C4693Dd8d44703af5CF9484fa8faAD6e33E392',
      parentGatewayRouter: '0xAC4F454320A253267C6Ae95e4784b9A4f9F78359',
      parentMultiCall: '0xce1CAd780c529e66e3aa6D952a1ED9A6447791c1',
      parentProxyAdmin: '0xBD76fd3fB5F3CD7165fB6e0DB895FFE1d81463e3',
      parentWeth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      parentWethGateway: '0x4FEbc93233aAc1523f36Abe297de9323f6C8ce79',
      childCustomGateway: '0xE102D94df0179082B39Ddcad58c9430dedc89aE3',
      childErc20Gateway: '0xCf3a4aF3c48Ba19c5FccFB44FA3E3A0F2A6e60dA',
      childGatewayRouter: '0xD60FD4c5D335b00287202C93C5B4EE0478D92686',
      childMulticall: '0x39E068582873B2011F5a1e8E0F7D9D993c8111BC',
      childProxyAdmin: '0x9DC4Da9a940AFEbBC8329aA6534aD767b60d968c',
      childWeth: '0xa3bD1fdeEb903142d16B3bd22f2aC9A82C714D62',
      childWethGateway: '0xec018E81eE818b04CFb1E013D91F1b779a2AC440',
    },
  },
}

/**
 * Determines if a chain is a parent of *any* other chain. Could be an L1 or an L2 chain.
 */
export const isParentNetwork = (
  parentChainOrChainId: ArbitrumNetwork | number
): boolean => {
  const parentChainId =
    typeof parentChainOrChainId === 'number'
      ? parentChainOrChainId
      : parentChainOrChainId.chainId

  // Check if there are any chains that have this chain as its parent chain
  return [...Object.values(l2Networks)].some(
    c => c.parentChainId === parentChainId
  )
}

const getArbitrumChains = () => networks

/**
 * Returns a list of children chains for the given chain or chain id.
 */
export const getChildrenForNetwork = (
  parentChainOrChainId: ArbitrumNetwork | number
): ArbitrumNetwork[] => {
  const parentChainId =
    typeof parentChainOrChainId === 'number'
      ? parentChainOrChainId
      : parentChainOrChainId.chainId

  return Object.values(getArbitrumChains()).filter(
    arbitrumChain => arbitrumChain.parentChainId === parentChainId
  )
}

/**
 * Index of all Arbitrum chains that have been added.
 */
export let l2Networks = getArbitrumChains()

/**
 * Returns the Arbitrum chain associated with the given signer, provider or chain id.
 *
 * @note Throws if the chain is not an Arbitrum chain.
 */
export const getArbitrumNetwork = async (
  signerOrProviderOrChainId: SignerOrProvider | number
): Promise<ArbitrumNetwork> => {
  const chainId = await (async () => {
    if (typeof signerOrProviderOrChainId === 'number') {
      return signerOrProviderOrChainId
    }
    const provider = SignerProviderUtils.getProviderOrThrow(
      signerOrProviderOrChainId
    )

    return (await provider.getNetwork()).chainId
  })()

  const network: ArbitrumNetwork | undefined = getArbitrumChains()[chainId]

  if (!network) {
    throw new ArbSdkError(`Unrecognized network ${chainId}.`)
  }

  return network
}

export type ArbitrumNetworkInformationFromRollup = Pick<
  ArbitrumNetwork,
  'parentChainId' | 'confirmPeriodBlocks' | 'ethBridge'
>

/**
 * Returns all the information about an Arbitrum network that can be fetched from its Rollup contract.
 *
 * @param rollupAddress Address of the Rollup contract on the parent chain
 * @param parentProvider Provider for the parent chain
 *
 * @returns An {@link ArbitrumNetworkInformationFromRollup} object
 */
export async function getArbitrumNetworkInformationFromRollup(
  rollupAddress: string,
  parentProvider: Provider
): Promise<ArbitrumNetworkInformationFromRollup> {
  const rollup = RollupAdminLogic__factory.connect(
    rollupAddress,
    parentProvider
  )

  const [bridge, inbox, sequencerInbox, outbox, confirmPeriodBlocks] =
    await Promise.all([
      rollup.bridge(),
      rollup.inbox(),
      rollup.sequencerInbox(),
      rollup.outbox(),
      rollup.confirmPeriodBlocks(),
    ])

  return {
    parentChainId: (await parentProvider.getNetwork()).chainId,
    confirmPeriodBlocks: confirmPeriodBlocks.toNumber(),
    ethBridge: {
      bridge,
      inbox,
      sequencerInbox,
      outbox,
      rollup: rollupAddress,
    },
  }
}

/**
 * Registers a custom Arbitrum network.
 *
 * @param network {@link ArbitrumNetwork} to be registered
 * @param options Additional options
 * @param options.throwIfAlreadyRegistered Whether or not the function should throw if the network is already registered, defaults to `false`
 */
export function registerCustomArbitrumNetwork(
  network: ArbitrumNetwork,
  options?: { throwIfAlreadyRegistered?: boolean }
): ArbitrumNetwork {
  const throwIfAlreadyRegistered = options?.throwIfAlreadyRegistered ?? false

  if (!network.isCustom) {
    throw new ArbSdkError(
      `Custom network ${network.chainId} must have isCustom flag set to true`
    )
  }

  if (typeof networks[network.chainId] !== 'undefined') {
    const message = `Network ${network.chainId} already included`

    if (throwIfAlreadyRegistered) {
      throw new ArbSdkError(message)
    }

    console.warn(message)
  }

  // store the network with the rest of the networks
  networks[network.chainId] = network
  l2Networks = getArbitrumChains()

  return network
}

/**
 * Registers a custom network that matches the one created by a Nitro local node. Useful in development.
 *
 * @see {@link https://github.com/OffchainLabs/nitro}
 */
export const addDefaultLocalNetwork = (): ArbitrumNetwork => {
  const defaultLocalL2Network: ArbitrumNetwork = {
    chainId: 412346,
    confirmPeriodBlocks: 20,
    ethBridge: {
      bridge: '0x2b360A9881F21c3d7aa0Ea6cA0De2a3341d4eF3C',
      inbox: '0xfF4a24b22F94979E9ba5f3eb35838AA814bAD6F1',
      outbox: '0x49940929c7cA9b50Ff57a01d3a92817A414E6B9B',
      rollup: '0x65a59D67Da8e710Ef9A01eCa37f83f84AEdeC416',
      sequencerInbox: '0xE7362D0787b51d8C72D504803E5B1d6DcdA89540',
    },
    isCustom: true,
    name: 'ArbLocal',
    parentChainId: 1337,
    tokenBridge: {
      parentCustomGateway: '0x3DF948c956e14175f43670407d5796b95Bb219D8',
      parentErc20Gateway: '0x4A2bA922052bA54e29c5417bC979Daaf7D5Fe4f4',
      parentGatewayRouter: '0x525c2aBA45F66987217323E8a05EA400C65D06DC',
      parentMultiCall: '0xDB2D15a3EB70C347E0D2C2c7861cAFb946baAb48',
      parentProxyAdmin: '0xe1080224B632A93951A7CFA33EeEa9Fd81558b5e',
      parentWeth: '0x408Da76E87511429485C32E4Ad647DD14823Fdc4',
      parentWethGateway: '0xF5FfD11A55AFD39377411Ab9856474D2a7Cb697e',
      childCustomGateway: '0x525c2aBA45F66987217323E8a05EA400C65D06DC',
      childErc20Gateway: '0xe1080224B632A93951A7CFA33EeEa9Fd81558b5e',
      childGatewayRouter: '0x1294b86822ff4976BfE136cB06CF43eC7FCF2574',
      childMulticall: '0xDB2D15a3EB70C347E0D2C2c7861cAFb946baAb48',
      childProxyAdmin: '0xda52b25ddB0e3B9CC393b0690Ac62245Ac772527',
      childWeth: '0x408Da76E87511429485C32E4Ad647DD14823Fdc4',
      childWethGateway: '0x4A2bA922052bA54e29c5417bC979Daaf7D5Fe4f4',
    },
  }

  return registerCustomArbitrumNetwork(defaultLocalL2Network)
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
      l2Networks = getArbitrumChains()
    },
  }
}

export function getNitroGenesisBlock(
  arbitrumChainOrChainId: ArbitrumNetwork | number
) {
  const arbitrumChainId =
    typeof arbitrumChainOrChainId === 'number'
      ? arbitrumChainOrChainId
      : arbitrumChainOrChainId.chainId

  // all networks except Arbitrum One started off with Nitro
  if (arbitrumChainId === 42161) {
    return ARB1_NITRO_GENESIS_L2_BLOCK
  }

  return 0
}

export async function getMulticallAddress(
  providerOrChainId: Provider | number
): Promise<string> {
  const chains = [...Object.values(l2Networks)]

  const chainId =
    typeof providerOrChainId === 'number'
      ? providerOrChainId
      : (await providerOrChainId.getNetwork()).chainId
  const chain = chains.find(c => c.chainId === chainId)

  // The provided chain is found in the list
  if (typeof chain !== 'undefined') {
    assertArbitrumNetworkHasTokenBridge(chain)
    // Return the address of Multicall on the chain
    return chain.tokenBridge.childMulticall
  }

  // The provided chain is not found in the list
  // Try to find a chain that references this chain as its parent
  const childChain = chains.find(c => c.parentChainId === chainId)

  // No chains reference this chain as its parent
  if (typeof childChain === 'undefined') {
    throw new Error(
      `Failed to retrieve Multicall address for chain: ${chainId}`
    )
  }

  assertArbitrumNetworkHasTokenBridge(childChain)
  // Return the address of Multicall on the parent chain
  return childChain.tokenBridge.parentMultiCall
}

/**
 * Maps the old {@link L2Network.tokenBridge} (from SDK v3) to {@link ArbitrumNetwork.tokenBridge} (from SDK v4).
 */
export function mapL2NetworkTokenBridgeToTokenBridge(
  input: L2NetworkTokenBridge
): TokenBridge {
  return {
    parentGatewayRouter: input.l1GatewayRouter,
    childGatewayRouter: input.l2GatewayRouter,
    parentErc20Gateway: input.l1ERC20Gateway,
    childErc20Gateway: input.l2ERC20Gateway,
    parentCustomGateway: input.l1CustomGateway,
    childCustomGateway: input.l2CustomGateway,
    parentWethGateway: input.l1WethGateway,
    childWethGateway: input.l2WethGateway,
    parentWeth: input.l1Weth,
    childWeth: input.l2Weth,
    parentProxyAdmin: input.l1ProxyAdmin,
    childProxyAdmin: input.l2ProxyAdmin,
    parentMultiCall: input.l1MultiCall,
    childMulticall: input.l2Multicall,
  }
}

/**
 * Maps the old {@link L2Network} (from SDK v3) to {@link ArbitrumNetwork} (from SDK v4).
 */
export function mapL2NetworkToArbitrumNetwork(
  l2Network: L2Network
): ArbitrumNetwork {
  return {
    // Spread properties
    ...l2Network,
    // Map properties that were changed
    chainId: l2Network.chainID,
    parentChainId: l2Network.partnerChainID,
    tokenBridge: mapL2NetworkTokenBridgeToTokenBridge(l2Network.tokenBridge),
  }
}

/**
 * Asserts that the given object has a token bridge. This is useful because not all Arbitrum network
 * operations require a token bridge.
 *
 * @param network {@link ArbitrumNetwork} object
 * @throws ArbSdkError if the object does not have a token bridge
 */
export function assertArbitrumNetworkHasTokenBridge<T extends ArbitrumNetwork>(
  network: T
): asserts network is T & { tokenBridge: TokenBridge } {
  if (
    typeof network === 'undefined' ||
    !('tokenBridge' in network) ||
    typeof network.tokenBridge === 'undefined'
  ) {
    throw new ArbSdkError(
      `The ArbitrumNetwork object with chainId ${network.chainId} is missing the token bridge contracts addresses. Please add them in the "tokenBridge" property.`
    )
  }
}

const { resetNetworksToDefault } = createNetworkStateHandler()

export { resetNetworksToDefault }
