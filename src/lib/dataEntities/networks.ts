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

import dotenv from 'dotenv'
import { BigNumber } from 'ethers'
import { SignerOrProvider, SignerProviderUtils } from './signerOrProvider'
import { ArbTsError } from '../dataEntities/errors'
import fs from 'fs'

dotenv.config()

export interface L1Network extends Network {
  partnerChainIDs: number[]
  blockTime: number //seconds
}

export interface L2Network extends Network {
  tokenBridge: TokenBridge
  ethBridge: EthBridge
  partnerChainID: number
  isArbitrum: true
  confirmPeriodBlocks: number
}
export interface Network {
  chainID: number
  name: string
  explorerUrl: string
  rpcURL: string
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
  /**
   * Outbox addresses paired with the first batch number at which they
   * were activated.
   */
  outboxes: { [address: string]: number }
  rollup: string
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
  bridge: '0x9a28e783c47bbeb813f32b861a431d0776681e95',
  inbox: '0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e',
  sequencerInbox: '0xe1ae39e91c5505f7f0ffc9e2bbf1f6e1122dcfa8',
  outboxes: {
    '0xefa1a42D3c4699822eE42677515A64b658be1bFc': 0,
    '0x2360A33905dc1c72b12d975d975F42BaBdcef9F3': 326,
  },
  rollup: '0xFe2c86CF40F89Fe2F726cFBBACEBae631300b50c',
}

const mainnetETHBridge: EthBridge = {
  bridge: '0x011b6e24ffb0b5f5fcc564cf4183c5bbbc96d515',
  inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  sequencerInbox: '0x4c6f947Ae67F572afa4ae0730947DE7C874F95Ef',
  outboxes: {
    '0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a': 0,
    '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40': 30,
  },
  rollup: '0xC12BA48c781F6e392B49Db2E25Cd0c28cD77531A',
}

// CHRIS: TODO: why is it generating two partner chainids?
// CHRIS: TODO: should be able to load these from a file

// check for the env var? or just try to load?

// CHRIS: TODO: remove these later
const locNitro1: L1Network = {
  blockTime: 10,
  chainID: 1337,
  explorerUrl: '',
  isCustom: true,
  name: 'EthLocal',
  partnerChainIDs: [ 421612 ],
  rpcURL: 'http://localhost:8545'
}

const locNitro2: L2Network =   {
  chainID: 421612,
  confirmPeriodBlocks: 20,
  ethBridge: {
    bridge: '0x5de967b6e7f900130f1ce30a128a79ef46ee0ad6',
    inbox: '0x5149d6687abb16f6b2f3ce0f6413d39c584cc9d5',
    outboxes: { '0x575Ed6453F49Af7c1B5ab0A82e551510f9bc65d6': 0 },
    rollup: '0x1c998f5993435d733188cc59f0f75d0a350bec31',
    sequencerInbox: '0x9d70e351ff38accf56591bb1214353769f3cab4f'
  },
  explorerUrl: '',
  isArbitrum: true,
  isCustom: true,
  name: 'ArbLocal',
  partnerChainID: 1337,
  rpcURL: 'http://localhost:7545',
  tokenBridge: {
    l1CustomGateway: '0x72b263CE9f2c16363f788b0a7c267e3366fe2579',
    l1ERC20Gateway: '0x371bBb801Ea1BA99Ba3782e1ce007D006973e1B1',
    l1GatewayRouter: '0x72afa166c5F377DB31E687042aFC33d1c0EAB755',
    l1MultiCall: '0x711a214dFdA9d7632E659c0E7F15d1e1aE2E7564',
    l1ProxyAdmin: '0xd1ED634FaE3ff5cbE05Be0B41ed4ff58ddb6c68c',
    l1Weth: '0xc4559624FC3EF22155cD576705a9d6045ED3879D',
    l1WethGateway: '0xE102772A6F105a9BEcD2c9497F85F5d33bFbB6de',
    l2CustomGateway: '0x5B328f060Ac623A8e9EB9C6F5A7947F3Cdd82b37',
    l2ERC20Gateway: '0x82993066c224A90b6712df2E77CdB7Aa0BD47Eb8',
    l2GatewayRouter: '0x95B63F1d74B04B86226Efb622f7E55C56d068e96',
    l2Multicall: '0xF686e1c5Fc9aE9D1FAE286f7ECCb2ad236829Dc0',
    l2ProxyAdmin: '0xa93366dF17044ed01c3160D2b2cb04f943Ac0D1f',
    l2Weth: '0x6d31A13358286596D1EC30944A7e787fAF1eE757',
    l2WethGateway: '0x3A85e361917180567F6a0fb8c68B2b5065126aCA'
  }
}

export const l1Networks: L1Networks = {
  1: {
    chainID: 1,
    name: 'Mainnet',
    explorerUrl: 'https://etherscan.io',
    partnerChainIDs: [42161],
    blockTime: 14,
    rpcURL: process.env['MAINNET_RPC'] as string,
    isCustom: false,
  },
  1338: {
    chainID: 1338,
    name: 'Hardhat_Mainnet_Fork',
    explorerUrl: 'https://etherscan.io',
    partnerChainIDs: [42161], // TODO: use sequencer fork ID
    blockTime: 1,
    rpcURL: 'http://127.0.0.1:8545/',
    isCustom: false,
  },
  4: {
    chainID: 4,
    name: 'Rinkeby',
    explorerUrl: 'https://rinkeby.etherscan.io',
    partnerChainIDs: [421611],
    blockTime: 15,
    rpcURL: process.env['RINKEBY_RPC'] as string,
    isCustom: false,
  },
  [locNitro1.chainID]: locNitro1,
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
    rpcURL: process.env['ARB_ONE_RPC'] || 'https://arb1.arbitrum.io/rpc',
    isCustom: false,
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
    rpcURL: process.env['RINKARBY_RPC'] || 'https://rinkeby.arbitrum.io/rpc',
    isCustom: false,
  },
  [locNitro2.chainID]: locNitro2,
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
    throw new ArbTsError(`Unrecognized network ${chainID}.`)
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
      throw new Error(`Network ${customL1Network.chainID} already included`)
    } else if (!customL1Network.isCustom) {
      throw new Error(
        `Custom network ${customL1Network.chainID} must have isCustom flag set to true`
      )
    } else {
      l1Networks[customL1Network.chainID] = customL1Network
    }
  }

  if (l2Networks[customL2Network.chainID])
    throw new Error(`Network ${customL2Network.chainID} already included`)
  else if (!customL2Network.isCustom) {
    throw new Error(
      `Custom network ${customL2Network.chainID} must have isCustom flag set to true`
    )
  }

  l2Networks[customL2Network.chainID] = customL2Network

  const l1PartnerChain = l1Networks[customL2Network.partnerChainID]
  if (!l1PartnerChain)
    throw new Error(
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
