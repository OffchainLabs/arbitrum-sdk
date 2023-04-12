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
  nitroGenesisL1Block: number
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

export interface L1Networks {
  [id: string]: L1Network
}

export interface L2Networks {
  [id: string]: L2Network
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
    nitroGenesisL1Block: 15447158,
    /**
     * Finalisation on mainnet can be up to 2 epochs = 64 blocks on mainnet
     * We add 10 minutes for the system to create and redeem the ticket, plus some extra buffer of time
     * (Total timeout: 30 minutes)
     */
    depositTimeout: 1800000,
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
    nitroGenesisL1Block: 0,
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
    nitroGenesisL1Block: 0,
    /**
     * Finalisation on mainnet can be up to 2 epochs = 64 blocks on mainnet
     * We add 10 minutes for the system to create and redeem the ticket, plus some extra buffer of time
     * (Total timeout: 30 minutes)
     */
    depositTimeout: 1800000,
  },
}

const getNetwork = async (
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

  const networks = layer === 1 ? l1Networks : l2Networks
  if (networks[chainID]) {
    return networks[chainID]
  } else {
    throw new ArbSdkError(`Unrecognized network ${chainID}.`)
  }
}

export const getL1Network = (
  signerOrProviderOrChainID: SignerOrProvider | number
): Promise<L1Network> => {
  return getNetwork(signerOrProviderOrChainID, 1) as Promise<L1Network>
}
export const getL2Network = (
  signerOrProviderOrChainID: SignerOrProvider | number
): Promise<L2Network> => {
  return getNetwork(signerOrProviderOrChainID, 2) as Promise<L2Network>
}

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
      bridge: '0x2b360a9881f21c3d7aa0ea6ca0de2a3341d4ef3c',
      inbox: '0xff4a24b22f94979e9ba5f3eb35838aa814bad6f1',
      outbox: '0x49940929c7cA9b50Ff57a01d3a92817A414E6B9B',
      rollup: '0x65a59d67da8e710ef9a01eca37f83f84aedec416',
      sequencerInbox: '0xe7362d0787b51d8c72d504803e5b1d6dcda89540',
    },
    explorerUrl: '',
    isArbitrum: true,
    isCustom: true,
    name: 'ArbLocal',
    partnerChainID: 1337,
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

export const isL1Network = (
  network: L1Network | L2Network
): network is L1Network => {
  if ((network as L1Network).partnerChainIDs) return true
  else return false
}
