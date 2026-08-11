import { describe, it, expect, vi } from 'vitest'
import {
  Erc20L1L3Bridger,
  EthL1L3Bridger,
} from '../../../src/compat/l1l3Bridger'
import { ArbitrumNetwork } from '../../../src/lib/dataEntities/networks'

function makeL2Network(): ArbitrumNetwork {
  return {
    chainId: 42161,
    name: 'Arbitrum One',
    parentChainId: 1,
    confirmPeriodBlocks: 45818,
    isCustom: false,
    isTestnet: false,
    ethBridge: {
      bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
      outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
      rollup: '0x4DCeB440657f21083db8aDd07665f8ddBe1DCfc0',
    },
    teleporter: {
      l1Teleporter: '0xCBd9c6e310D6AaDeF9F025f716284162F0158992',
      l2ForwarderFactory: '0x791d2AbC6c3A459E13B9AdF54Fb5e97B7Af38f87',
    },
    tokenBridge: {
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
      childMultiCall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
    },
  }
}

function makeL3Network(): ArbitrumNetwork {
  return {
    chainId: 660279,
    name: 'Xai',
    parentChainId: 42161,
    confirmPeriodBlocks: 45818,
    isCustom: false,
    isTestnet: false,
    ethBridge: {
      bridge: '0x7dd8A76bdAeBE3BBBaCD7Aa87f1D4FDa1E60f94f',
      inbox: '0xaE21fDA3de92dE2FDAF606233b2863782Ba046F9',
      sequencerInbox: '0x995a9d3ca121D48d21087eDE20bc8acb2398c8B1',
      outbox: '0x1E400568AD4840dbE215AF0552dbe9ecB8B3B2ab',
      rollup: '0xC47DacFbAa80Bd9D8112F4e8069482c2A3221336',
    },
    tokenBridge: {
      parentGatewayRouter: '0x22CCA5Dc96a4Ac1EC32c9c7C5ad4D03766A6935b',
      childGatewayRouter: '0xd096e8dE90D34de758B0E0bA4a796eA2e1e272cF',
      parentErc20Gateway: '0xb591cE747CF19cF30e11d656EB94134F523A9e77',
      childErc20Gateway: '0x5f9AaFB95dB6420f5A45906538D5E84b42BaEFC5',
      parentCustomGateway: '0xb15A0826d312feA4952F67Ec133e47040Ea0e45F',
      childCustomGateway: '0x6e244cD02BBB8a6dbd7F626f05B2ef82151Ab502',
      parentWethGateway: '0x0000000000000000000000000000000000000000',
      childWethGateway: '0x0000000000000000000000000000000000000000',
      childWeth: '0x0000000000000000000000000000000000000000',
      parentWeth: '0x0000000000000000000000000000000000000000',
      parentMultiCall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
      childMultiCall: '0x0000000000000000000000000000000000000000',
    },
  }
}

describe('EthL1L3Bridger (compat)', () => {
  it('constructs with L3 network', () => {
    const l3Network = makeL3Network()
    const bridger = new EthL1L3Bridger(l3Network)
    expect(bridger.l3Network).to.deep.equal(l3Network)
  })

  it('has getDepositRequest method', () => {
    const bridger = new EthL1L3Bridger(makeL3Network())
    expect(typeof bridger.getDepositRequest).to.eq('function')
  })
})

describe('Erc20L1L3Bridger (compat)', () => {
  it('constructs with L3 network', () => {
    const l3Network = makeL3Network()
    const bridger = new Erc20L1L3Bridger(l3Network)
    expect(bridger.l3Network).to.deep.equal(l3Network)
  })

  it('has getDepositRequest method', () => {
    const bridger = new Erc20L1L3Bridger(makeL3Network())
    expect(typeof bridger.getDepositRequest).to.eq('function')
  })

  it('has getApproveTokenRequest method', () => {
    const bridger = new Erc20L1L3Bridger(makeL3Network())
    expect(typeof bridger.getApproveTokenRequest).to.eq('function')
  })
})
