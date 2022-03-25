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
  outboxes: { [address: string]: BigNumber }
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
    '0xefa1a42D3c4699822eE42677515A64b658be1bFc': BigNumber.from(0),
    '0x2360A33905dc1c72b12d975d975F42BaBdcef9F3': BigNumber.from(326),
  },
  rollup: '0xFe2c86CF40F89Fe2F726cFBBACEBae631300b50c',
}

const mainnetETHBridge: EthBridge = {
  bridge: '0x011b6e24ffb0b5f5fcc564cf4183c5bbbc96d515',
  inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  sequencerInbox: '0x4c6f947Ae67F572afa4ae0730947DE7C874F95Ef',
  outboxes: {
    '0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a': BigNumber.from(0),
    '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40': BigNumber.from(30),
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

const locNitro2: L2Network =  {
  chainID: 421612,
  confirmPeriodBlocks: 20,
  ethBridge: {
    bridge: '0x5de967b6e7f900130f1ce30a128a79ef46ee0ad6',
    inbox: '0x5149d6687abb16f6b2f3ce0f6413d39c584cc9d5',
    outboxes: { '0x575Ed6453F49Af7c1B5ab0A82e551510f9bc65d6': BigNumber.from(0) },
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
    l1CustomGateway: '0x1967F2Fe8E438F0281C48E101f6B706E7D8220e7',
    l1ERC20Gateway: '0x8fc2dD9a4c78d8754E0f30747a2A63a264028fF0',
    l1GatewayRouter: '0xdB9dB6eCfd5E005EE76a7DEAD898c56Ba4C2d195',
    l1MultiCall: '0x45d087A0fa5c21B67777B44B075011667b75f3bE',
    l1ProxyAdmin: '0xF24e7667E5D62921B5e2fa9F78DFEE09a9260Cb8',
    l1Weth: '0x5dec0c90fbBE3aF4C0bEeE12b71d99ae19B65Aa7',
    l1WethGateway: '0xc4e0757cFaEb01d8493E4CA90FD02EF4e969A011',
    l2CustomGateway: '0xF0B003F9247f2DC0e874710eD55e55f8C63B14a3',
    l2ERC20Gateway: '0x78a6dC8D17027992230c112432E42EC3d6838d74',
    l2GatewayRouter: '0x7b650845242a96595f3a9766D4e8e5ab0887936A',
    l2Multicall: '0x9b890cA9dE3D317b165afA7DFb8C65f2e4c95C20',
    l2ProxyAdmin: '0x7F85fB7f42A0c0D40431cc0f7DFDf88be6495e67',
    l2Weth: '0x36BeF5fD671f2aA8686023dE4797A7dae3082D5F',
    l2WethGateway: '0x2E76efCC2518CB801E5340d5f140B1c1911b4F4B'
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
  // [locNitro1.chainID]: locNitro1,
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
  // [locNitro2.chainID]: locNitro2,
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
