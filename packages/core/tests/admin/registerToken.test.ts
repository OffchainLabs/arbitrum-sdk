import { describe, it, expect } from 'vitest'
import {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from '../../src/admin/registerToken'
import { getArbitrumNetwork } from '../../src/networks'
import { encodeFunctionData, getFunctionSelector } from '../../src/encoding/abi'
import { ICustomTokenAbi } from '../../src/abi/ICustomToken'
import { L1GatewayRouterAbi } from '../../src/abi/L1GatewayRouter'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const PARENT_TOKEN = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const CHILD_TOKEN = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
const CREDIT_BACK = '0x1234567890AbcdEF1234567890aBcdef12345678'

describe('Admin Token Registration', () => {
  const network = getArbitrumNetwork(42161)

  describe('getRegisterCustomTokenRequest', () => {
    it('targets the parent token contract', () => {
      const result = getRegisterCustomTokenRequest({
        network,
        parentTokenAddress: PARENT_TOKEN,
        childTokenAddress: CHILD_TOKEN,
        from: SENDER,
        maxSubmissionCostForCustomBridge: 1000n,
        maxSubmissionCostForRouter: 1000n,
        maxGasForCustomBridge: 100000n,
        maxGasForRouter: 100000n,
        gasPriceBid: 1000000000n,
        valueForGateway: 200000000000000n,
        valueForRouter: 200000000000000n,
        creditBackAddress: CREDIT_BACK,
      })

      expect(result.to).toBe(PARENT_TOKEN)
    })

    it('encodes registerTokenOnL2 calldata', () => {
      const params = {
        network,
        parentTokenAddress: PARENT_TOKEN,
        childTokenAddress: CHILD_TOKEN,
        from: SENDER,
        maxSubmissionCostForCustomBridge: 1000n,
        maxSubmissionCostForRouter: 2000n,
        maxGasForCustomBridge: 100000n,
        maxGasForRouter: 200000n,
        gasPriceBid: 1000000000n,
        valueForGateway: 200000000000000n,
        valueForRouter: 300000000000000n,
        creditBackAddress: CREDIT_BACK,
      }

      const result = getRegisterCustomTokenRequest(params)

      // Verify function selector
      const selector = getFunctionSelector(
        ICustomTokenAbi,
        'registerTokenOnL2'
      )
      expect(result.data.startsWith(selector)).toBe(true)

      // Verify the full encoded data
      const expectedData = encodeFunctionData(
        ICustomTokenAbi,
        'registerTokenOnL2',
        [
          CHILD_TOKEN,
          1000n,
          2000n,
          100000n,
          200000n,
          1000000000n,
          200000000000000n,
          300000000000000n,
          CREDIT_BACK,
        ]
      )
      expect(result.data).toBe(expectedData)
    })

    it('sets value to valueForGateway + valueForRouter', () => {
      const result = getRegisterCustomTokenRequest({
        network,
        parentTokenAddress: PARENT_TOKEN,
        childTokenAddress: CHILD_TOKEN,
        from: SENDER,
        maxSubmissionCostForCustomBridge: 1000n,
        maxSubmissionCostForRouter: 1000n,
        maxGasForCustomBridge: 100000n,
        maxGasForRouter: 100000n,
        gasPriceBid: 1000000000n,
        valueForGateway: 200000000000000n,
        valueForRouter: 300000000000000n,
        creditBackAddress: CREDIT_BACK,
      })

      expect(result.value).toBe(200000000000000n + 300000000000000n)
    })

    it('sets from to the sender', () => {
      const result = getRegisterCustomTokenRequest({
        network,
        parentTokenAddress: PARENT_TOKEN,
        childTokenAddress: CHILD_TOKEN,
        from: SENDER,
        maxSubmissionCostForCustomBridge: 0n,
        maxSubmissionCostForRouter: 0n,
        maxGasForCustomBridge: 0n,
        maxGasForRouter: 0n,
        gasPriceBid: 0n,
        valueForGateway: 0n,
        valueForRouter: 0n,
        creditBackAddress: CREDIT_BACK,
      })

      expect(result.from).toBe(SENDER)
    })
  })

  describe('getSetGatewaysRequest', () => {
    it('targets the parent gateway router', () => {
      const result = getSetGatewaysRequest({
        network,
        tokenAddresses: [PARENT_TOKEN],
        gatewayAddresses: [
          '0xcEe284F754E854890e311e3280b767F80797180d',
        ],
        maxGas: 100000n,
        gasPriceBid: 1000000000n,
        maxSubmissionCost: 5000n,
        from: SENDER,
      })

      expect(result.to).toBe(network.tokenBridge!.parentGatewayRouter)
    })

    it('encodes setGateways calldata', () => {
      const tokens = [PARENT_TOKEN]
      const gateways = ['0xcEe284F754E854890e311e3280b767F80797180d']
      const maxGas = 100000n
      const gasPriceBid = 1000000000n
      const maxSubmissionCost = 5000n

      const result = getSetGatewaysRequest({
        network,
        tokenAddresses: tokens,
        gatewayAddresses: gateways,
        maxGas,
        gasPriceBid,
        maxSubmissionCost,
        from: SENDER,
      })

      const expectedData = encodeFunctionData(
        L1GatewayRouterAbi,
        'setGateways',
        [tokens, gateways, maxGas, gasPriceBid, maxSubmissionCost]
      )
      expect(result.data).toBe(expectedData)
    })

    it('sets value to maxGas * gasPriceBid + maxSubmissionCost', () => {
      const maxGas = 100000n
      const gasPriceBid = 1000000000n
      const maxSubmissionCost = 5000n

      const result = getSetGatewaysRequest({
        network,
        tokenAddresses: [PARENT_TOKEN],
        gatewayAddresses: [
          '0xcEe284F754E854890e311e3280b767F80797180d',
        ],
        maxGas,
        gasPriceBid,
        maxSubmissionCost,
        from: SENDER,
      })

      expect(result.value).toBe(
        maxGas * gasPriceBid + maxSubmissionCost
      )
    })

    it('throws if network has no token bridge', () => {
      const networkWithoutBridge = {
        ...network,
        tokenBridge: undefined,
      }

      expect(() =>
        getSetGatewaysRequest({
          network: networkWithoutBridge as any,
          tokenAddresses: [],
          gatewayAddresses: [],
          maxGas: 0n,
          gasPriceBid: 0n,
          maxSubmissionCost: 0n,
          from: SENDER,
        })
      ).toThrow('token bridge')
    })
  })
})
