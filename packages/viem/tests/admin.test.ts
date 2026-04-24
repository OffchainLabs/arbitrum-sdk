/**
 * Tests for viem admin function re-exports.
 */
import { describe, it, expect } from 'vitest'
import { getRegisterCustomTokenRequest, getSetGatewaysRequest } from '../src/admin'
import type { ArbitrumNetwork } from '@arbitrum/core'

const testNetwork: ArbitrumNetwork = {
  name: 'Arbitrum One',
  chainId: 42161,
  parentChainId: 1,
  ethBridge: {
    bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
    rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
    sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
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
    parentWeth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    childWeth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  confirmPeriodBlocks: 45818,
  isTestnet: false,
  isCustom: false,
}

describe('viem admin functions', () => {
  describe('getRegisterCustomTokenRequest', () => {
    it('builds a register custom token request', () => {
      const result = getRegisterCustomTokenRequest({
        network: testNetwork,
        parentTokenAddress: '0x1111111111111111111111111111111111111111',
        childTokenAddress: '0x2222222222222222222222222222222222222222',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        maxSubmissionCostForCustomBridge: 100000000000000n,
        maxSubmissionCostForRouter: 100000000000000n,
        maxGasForCustomBridge: 200000n,
        maxGasForRouter: 200000n,
        gasPriceBid: 100000000n,
        valueForGateway: 120000000000000n,
        valueForRouter: 120000000000000n,
        creditBackAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe('0x1111111111111111111111111111111111111111')
      expect(result.value).toBe(240000000000000n) // valueForGateway + valueForRouter
      expect(result.data).toBeDefined()
    })
  })

  describe('getSetGatewaysRequest', () => {
    it('builds a set gateways request', () => {
      const result = getSetGatewaysRequest({
        network: testNetwork,
        tokenAddresses: ['0x1111111111111111111111111111111111111111'],
        gatewayAddresses: ['0x2222222222222222222222222222222222222222'],
        maxGas: 200000n,
        gasPriceBid: 100000000n,
        maxSubmissionCost: 100000000000000n,
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })

      expect(result.to).toBe(testNetwork.tokenBridge!.parentGatewayRouter)
      expect(result.data).toBeDefined()
      // value = maxGas * gasPriceBid + maxSubmissionCost
      expect(result.value).toBe(200000n * 100000000n + 100000000000000n)
    })
  })
})
