import { describe, it, expect } from 'vitest'
import {
  getDepositRequest,
  getApproveGasTokenRequest,
} from '../../src/eth/deposit'
import { getArbitrumNetwork } from '../../src/networks'
import type { ArbitrumNetwork } from '../../src/networks'
import { encodeFunctionData, getFunctionSelector } from '../../src/encoding/abi'
import { IInboxAbi } from '../../src/abi/IInbox'
import { ERC20InboxAbi } from '../../src/abi/ERC20Inbox'
import { ERC20Abi } from '../../src/abi/ERC20'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

describe('ETH deposit', () => {
  describe('getDepositRequest', () => {
    it('returns correct request for ETH-native chain (Arbitrum One)', () => {
      const network = getArbitrumNetwork(42161)
      const amount = 1_000_000_000_000_000_000n // 1 ETH

      const result = getDepositRequest({ network, amount, from: SENDER })

      expect(result.to).toBe(network.ethBridge.inbox)
      expect(result.value).toBe(amount)
      expect(result.from).toBe(SENDER)

      // depositEth() selector is 0x0f4d14e9 (no-args version from IInbox)
      const expectedSelector = getFunctionSelector(IInboxAbi, 'depositEth')
      expect(result.data.startsWith(expectedSelector)).toBe(true)
    })

    it('encodes depositEth() with no arguments', () => {
      const network = getArbitrumNetwork(42161)
      const result = getDepositRequest({
        network,
        amount: 100n,
        from: SENDER,
      })

      // The no-args depositEth() should produce just the 4-byte selector
      const expectedData = encodeFunctionData(IInboxAbi, 'depositEth', [])
      expect(result.data).toBe(expectedData)
    })

    it('returns correct request for custom gas token chain', () => {
      // Create a mock network with a custom gas token
      const baseNetwork = getArbitrumNetwork(42161)
      const customNetwork: ArbitrumNetwork = {
        ...baseNetwork,
        chainId: 999999,
        nativeToken: '0x0000000000000000000000000000000000000abc',
        isCustom: true,
      }

      const amount = 500n
      const result = getDepositRequest({
        network: customNetwork,
        amount,
        from: SENDER,
      })

      expect(result.to).toBe(customNetwork.ethBridge.inbox)
      expect(result.value).toBe(0n) // Custom gas token: no ETH value
      expect(result.from).toBe(SENDER)

      // Should encode depositERC20(uint256)
      const expectedData = encodeFunctionData(ERC20InboxAbi, 'depositERC20', [
        amount,
      ])
      expect(result.data).toBe(expectedData)
    })

    it('uses inbox address from the network config', () => {
      const network = getArbitrumNetwork(421614) // Sepolia testnet
      const result = getDepositRequest({
        network,
        amount: 1n,
        from: SENDER,
      })

      expect(result.to).toBe(network.ethBridge.inbox)
    })
  })

  describe('getApproveGasTokenRequest', () => {
    it('throws for ETH-native chains', () => {
      const network = getArbitrumNetwork(42161)

      expect(() =>
        getApproveGasTokenRequest({ network, from: SENDER })
      ).toThrow('chain uses ETH as its native/gas token')
    })

    it('returns correct approve calldata for custom gas token chain', () => {
      const nativeToken = '0x0000000000000000000000000000000000000abc'
      const baseNetwork = getArbitrumNetwork(42161)
      const customNetwork: ArbitrumNetwork = {
        ...baseNetwork,
        chainId: 999999,
        nativeToken,
        isCustom: true,
      }

      const result = getApproveGasTokenRequest({
        network: customNetwork,
        from: SENDER,
      })

      // Should target the native token contract
      expect(result.to).toBe(nativeToken)
      expect(result.value).toBe(0n)
      expect(result.from).toBe(SENDER)

      // Should encode approve(inbox, maxUint256)
      const MAX_UINT256 =
        115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const expectedData = encodeFunctionData(ERC20Abi, 'approve', [
        customNetwork.ethBridge.inbox,
        MAX_UINT256,
      ])
      expect(result.data).toBe(expectedData)
    })

    it('uses custom amount when provided', () => {
      const nativeToken = '0x0000000000000000000000000000000000000abc'
      const baseNetwork = getArbitrumNetwork(42161)
      const customNetwork: ArbitrumNetwork = {
        ...baseNetwork,
        chainId: 999999,
        nativeToken,
        isCustom: true,
      }

      const customAmount = 1000n
      const result = getApproveGasTokenRequest({
        network: customNetwork,
        from: SENDER,
        amount: customAmount,
      })

      const expectedData = encodeFunctionData(ERC20Abi, 'approve', [
        customNetwork.ethBridge.inbox,
        customAmount,
      ])
      expect(result.data).toBe(expectedData)
    })
  })
})
