import { describe, it, expect } from 'vitest'
import { getWithdrawalRequest } from '../../src/eth/withdraw'
import { getArbitrumNetwork } from '../../src/networks'
import { ARB_SYS_ADDRESS } from '../../src/constants'
import { encodeFunctionData } from '../../src/encoding/abi'
import { ArbSysAbi } from '../../src/abi/ArbSys'

const SENDER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const DESTINATION = '0x1234567890AbcdEF1234567890aBcdef12345678'

describe('ETH withdrawal', () => {
  describe('getWithdrawalRequest', () => {
    it('targets ArbSys precompile', () => {
      const network = getArbitrumNetwork(42161)
      const result = getWithdrawalRequest({
        network,
        amount: 1n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.to).toBe(ARB_SYS_ADDRESS)
    })

    it('sets value to the withdrawal amount', () => {
      const network = getArbitrumNetwork(42161)
      const amount = 1_000_000_000_000_000_000n

      const result = getWithdrawalRequest({
        network,
        amount,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.value).toBe(amount)
    })

    it('encodes withdrawEth(address) with destination', () => {
      const network = getArbitrumNetwork(42161)
      const result = getWithdrawalRequest({
        network,
        amount: 1n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      const expectedData = encodeFunctionData(ArbSysAbi, 'withdrawEth', [
        DESTINATION,
      ])
      expect(result.data).toBe(expectedData)
    })

    it('sets from to the sender', () => {
      const network = getArbitrumNetwork(42161)
      const result = getWithdrawalRequest({
        network,
        amount: 1n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.from).toBe(SENDER)
    })

    it('works with zero amount', () => {
      const network = getArbitrumNetwork(42161)
      const result = getWithdrawalRequest({
        network,
        amount: 0n,
        destinationAddress: DESTINATION,
        from: SENDER,
      })

      expect(result.value).toBe(0n)
    })
  })
})
