import { describe, it, expect } from 'vitest'
import { getAddress, isAddress } from '../../src/encoding/address'

describe('address utilities', () => {
  describe('getAddress', () => {
    it('checksums a lowercase address', () => {
      expect(getAddress('0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae')).toBe(
        '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'
      )
    })

    it('checksums an uppercase address', () => {
      expect(getAddress('0xDE0B295669A9FD93D5F28D9EC85E40F4CB697BAE')).toBe(
        '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'
      )
    })

    it('preserves already checksummed address', () => {
      const addr = '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'
      expect(getAddress(addr)).toBe(addr)
    })

    it('checksums the zero address', () => {
      expect(
        getAddress('0x0000000000000000000000000000000000000000')
      ).toBe('0x0000000000000000000000000000000000000000')
    })

    it('checksums various known addresses', () => {
      // Vitalik's address
      expect(getAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      )
      // USDT contract
      expect(getAddress('0xdac17f958d2ee523a2206206994597c13d831ec7')).toBe(
        '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      )
    })

    it('throws on invalid address (wrong length)', () => {
      expect(() => getAddress('0x123')).toThrow()
    })

    it('throws on invalid address (not hex)', () => {
      expect(() => getAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow()
    })

    it('throws on non-string', () => {
      expect(() => getAddress(123 as unknown as string)).toThrow()
    })
  })

  describe('isAddress', () => {
    it('returns true for valid checksummed address', () => {
      expect(isAddress('0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe')).toBe(true)
    })

    it('returns true for valid lowercase address', () => {
      expect(isAddress('0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae')).toBe(true)
    })

    it('returns true for valid uppercase address', () => {
      expect(isAddress('0xDE0B295669A9FD93D5F28D9EC85E40F4CB697BAE')).toBe(true)
    })

    it('returns false for short string', () => {
      expect(isAddress('0x123')).toBe(false)
    })

    it('returns false for non-hex', () => {
      expect(isAddress('not-an-address')).toBe(false)
    })

    it('returns false for non-string', () => {
      expect(isAddress(123 as unknown as string)).toBe(false)
    })

    it('returns true for zero address', () => {
      expect(isAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    })
  })
})
