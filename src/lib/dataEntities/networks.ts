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
import { SEVEN_DAYS_IN_SECONDS } from './constants'

export interface L1Network extends Network {
  partnerChainIDs: number[]
  blockTime: number //seconds
  isArbitrum: false
}

export interface L2Network extends Network {
  tokenBridge: TokenBridge
  ethBridge: EthBridge
  partnerChainID: number
  isArbitrum: true
  confirmPeriodBlocks: number
  retryableLifetimeSeconds: number
  nitroGenesisBlock: number
  /**
   * How long to wait (ms) for a deposit to arrive on l2 before timing out a request
   */
  depositTimeout: number
}
export interface Network {
  chainID: number
  name: string
  explorerUrl: string
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
  classicOutboxes?: {
    [addr: string]: number
  }
}

export interface NetworkList<TNetwork extends Network> {
  [id: string]: TNetwork
}

export type L1Networks = NetworkList<L1Network>

export type L2Networks = NetworkList<L2Network>

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

const rinkebyTokenBridge: TokenBridge = {
  l1GatewayRouter: '0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380',
  l2GatewayRouter: '0x9413AD42910c1eA60c737dB5f58d1C504498a3cD',
  l1ERC20Gateway: '0x91169Dbb45e6804743F94609De50D511C437572E',
  l2ERC20Gateway: '0x195C107F3F75c4C93Eba7d9a1312F19305d6375f',
  l1CustomGateway: '0x917dc9a69F65dC3082D518192cd3725E1Fa96cA2',
  l2CustomGateway: '0x9b014455AcC2Fe90c52803849d0002aeEC184a06',
  l1WethGateway: '0x81d1a19cf7071732D4313c75dE8DD5b8CF697eFD',
  l2WethGateway: '0xf94bc045c4E926CC0b34e8D1c41Cd7a043304ac9',
  l2Weth: '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
  l1Weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  l1ProxyAdmin: '0x0DbAF24efA2bc9Dd1a6c0530DD252BCcF883B89A',
  l2ProxyAdmin: '0x58816566EB91815Cc07f3Ad5230eE0820fe1A19a',
  l1MultiCall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
  l2Multicall: '0x5D6e06d3E154C5DBEC91317f0d04AE03AB49A273',
}

const rinkebyETHBridge: EthBridge = {
  bridge: '0x85C720444e436E1F9407E0C3895d3fE149f41168',
  inbox: '0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e',
  sequencerInbox: '0x957C9c64f7c2cE091E56aF3F33AB20259096355F',
  outbox: '0x36648F69cEb55Ce1B2920Bf2de321FBc9c378f0E',
  rollup: '0x71c6093C564EDDCFAf03481C3F59F88849F1e644',
  classicOutboxes: {
    '0xefa1a42D3c4699822eE42677515A64b658be1bFc': 0,
    '0x2360A33905dc1c72b12d975d975F42BaBdcef9F3': 326,
  },
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

export const l1Networks: L1Networks = {
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
  4: {
    chainID: 4,
    name: 'Rinkeby',
    explorerUrl: 'https://rinkeby.etherscan.io',
    partnerChainIDs: [421611],
    blockTime: 15,
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
}

export const l2Networks: L2Networks = {
  42161: {
    chainID: 42161,
    name: 'Arbitrum One',
    explorerUrl: 'https://arbiscan.io',
    partnerChainID: 1,
    isArbitrum: true,
    tokenBridge: mainnetTokenBridge,
    ethBridge: mainnetETHBridge,
    confirmPeriodBlocks: 45818,
    isCustom: false,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    nitroGenesisBlock: 22207817,
    /**
     * Finalisation on mainnet can be up to 2 epochs = 64 blocks on mainnet
     */
    depositTimeout: 888000,
  },
  421611: {
    chainID: 421611,
    name: 'ArbRinkeby',
    explorerUrl: 'https://testnet.arbiscan.io',
    partnerChainID: 4,
    isArbitrum: true,
    tokenBridge: rinkebyTokenBridge,
    ethBridge: rinkebyETHBridge,
    confirmPeriodBlocks: 6545, // TODO
    isCustom: false,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    nitroGenesisBlock: 13919179,
    depositTimeout: 9000000,
  },
  421613: {
    chainID: 421613,
    confirmPeriodBlocks: 960,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    ethBridge: {
      bridge: '0xaf4159a80b6cc41ed517db1c453d1ef5c2e4db72',
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
    /**
     * Low validator participation on goerli means that it can take a long time to finalise
     * Wait 10 epochs there on goerli = 320 blocks. Each block is 12 seconds.
     */
    depositTimeout: 3960000,
  },
  42170: {
    chainID: 42170,
    confirmPeriodBlocks: 45818,
    ethBridge: {
      bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
      inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
      outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
      rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
      sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
    },
    explorerUrl: 'https://nova.arbiscan.io',
    isArbitrum: true,
    isCustom: false,
    name: 'Arbitrum Nova',
    partnerChainID: 1,
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
    tokenBridge: {
      l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
      l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
      l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
      l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
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
    depositTimeout: 888000,
  },
}

const getNetworkByChainID = <TNetwork extends Network>(
  chainID: number,
  networks: NetworkList<TNetwork>
) => {
  if (networks[chainID]) {
    return networks[chainID]
  }
  throw new ArbSdkError(`Unrecognized network ${chainID}.`)
}

const getChainIDfromSignerOrProvider = async (
  signerOrProvider: SignerOrProvider
) => {
  const provider = SignerProviderUtils.getProviderOrThrow(signerOrProvider)
  const { chainId } = await provider.getNetwork()
  return chainId
}

type NetworkOrPromiseOfNetwork<
  TNetwork extends Network,
  TSignerOrProviderOrNumber extends SignerOrProvider | number
> = TSignerOrProviderOrNumber extends SignerOrProvider
  ? Promise<TNetwork>
  : TNetwork

function getNetwork<
  TNetwork extends Network,
  TSignerOrProviderOrNumber extends SignerOrProvider | number
>(
  signerOrProviderOrChainID: TSignerOrProviderOrNumber,
  networks: NetworkList<TNetwork>
): NetworkOrPromiseOfNetwork<TNetwork, TSignerOrProviderOrNumber>
function getNetwork<
  TNetwork extends Network,
  TSignerOrProviderOrNumber extends SignerOrProvider | number
>(
  signerOrProviderOrChainID: TSignerOrProviderOrNumber,
  networks: NetworkList<TNetwork>
): Promise<TNetwork> | TNetwork {
  if (typeof signerOrProviderOrChainID === 'number') {
    return getNetworkByChainID(signerOrProviderOrChainID, networks)
  }
  return getChainIDfromSignerOrProvider(signerOrProviderOrChainID).then(
    chainID => getNetworkByChainID(chainID, networks)
  )
}

export const getL1Network = <
  TSignerOrProviderOrNumber extends SignerOrProvider | number
>(
  signerOrProviderOrChainID: TSignerOrProviderOrNumber
) => getNetwork(signerOrProviderOrChainID, l1Networks)

export const getL2Network = <
  TSignerOrProviderOrNumber extends SignerOrProvider | number
>(
  signerOrProviderOrChainID: TSignerOrProviderOrNumber
) => getNetwork(signerOrProviderOrChainID, l2Networks)

export const addCustomNetwork = ({
  customL1Network,
  customL2Network,
}: {
  customL1Network?: L1Network
  customL2Network: L2Network
}): void => {
  if (customL1Network) {
    if (l1Networks[customL1Network.chainID]) {
      throw new ArbSdkError(
        `Network ${customL1Network.chainID} already included`
      )
    } else if (!customL1Network.isCustom) {
      throw new ArbSdkError(
        `Custom network ${customL1Network.chainID} must have isCustom flag set to true`
      )
    } else {
      l1Networks[customL1Network.chainID] = customL1Network
    }
  }

  if (l2Networks[customL2Network.chainID])
    throw new ArbSdkError(`Network ${customL2Network.chainID} already included`)
  else if (!customL2Network.isCustom) {
    throw new ArbSdkError(
      `Custom network ${customL2Network.chainID} must have isCustom flag set to true`
    )
  }

  l2Networks[customL2Network.chainID] = customL2Network

  const l1PartnerChain = l1Networks[customL2Network.partnerChainID]
  if (!l1PartnerChain)
    throw new ArbSdkError(
      `Network ${customL2Network.chainID}'s partner network, ${customL2Network.partnerChainID}, not recognized`
    )

  if (!l1PartnerChain.partnerChainIDs.includes(customL2Network.chainID)) {
    l1PartnerChain.partnerChainIDs.push(customL2Network.chainID)
  }
}

export const isL1Network = (
  network: L1Network | L2Network
): network is L1Network => {
  if ((network as L1Network).partnerChainIDs) return true
  else return false
}
