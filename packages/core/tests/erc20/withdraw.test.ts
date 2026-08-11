import { describe, it, expect } from 'vitest'
import { getErc20WithdrawalRequest } from '../../src/erc20/withdraw'
import { getArbitrumNetwork } from '../../src/networks'
import { encodeFunctionData } from '../../src/encoding/abi'
import { L2GatewayRouterAbi } from '../../src/abi/L2GatewayRouter'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const DESTINATION = '0x1234567890AbcdEF1234567890aBcdef12345678'
const TOKEN_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

describe('ERC-20 Withdrawal', () => {
  const network = getArbitrumNetwork(42161)

  describe('getErc20WithdrawalRequest', () => {
    it('targets the child gateway router', () => {
      const result = getErc20WithdrawalRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount: 1000000n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.to).toBe(network.tokenBridge!.childGatewayRouter)
    })

    it('sets value to 0 (no ETH needed for token withdrawal)', () => {
      const result = getErc20WithdrawalRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount: 1000000n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.value).toBe(0n)
    })

    it('encodes outboundTransfer(address,address,uint256,bytes)', () => {
      const amount = 1000000n
      const result = getErc20WithdrawalRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      // The 4-arg outboundTransfer is the first overload in L2GatewayRouterAbi
      const expectedData = encodeFunctionData(
        L2GatewayRouterAbi,
        'outboundTransfer',
        [TOKEN_ADDRESS, DESTINATION, amount, '0x']
      )
      expect(result.data).toBe(expectedData)
    })

    it('sets from to the sender', () => {
      const result = getErc20WithdrawalRequest({
        network,
        erc20ParentAddress: TOKEN_ADDRESS,
        amount: 1n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.from).toBe(SENDER)
    })

    it('throws if network has no token bridge', () => {
      const networkWithoutBridge = {
        ...getArbitrumNetwork(42161),
        tokenBridge: undefined,
      }

      expect(() =>
        getErc20WithdrawalRequest({
          network: networkWithoutBridge as any,
          erc20ParentAddress: TOKEN_ADDRESS,
          amount: 1n,
          destinationAddress: DESTINATION,
          from: SENDER,
        })
      ).toThrow('token bridge')
    })
  })
})
