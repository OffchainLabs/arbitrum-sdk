import { describe, it, expect } from 'vitest'
import {
  hexToBytes,
  bytesToHex,
  concat,
  zeroPad,
  stripZeros,
  hexDataLength,
  isHexString,
  padLeft,
} from '../../src/encoding/hex'

describe('hex utilities', () => {
  describe('hexToBytes', () => {
    it('converts hex string to Uint8Array', () => {
      const result = hexToBytes('0xdeadbeef')
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    })

    it('handles empty hex', () => {
      const result = hexToBytes('0x')
      expect(result).toEqual(new Uint8Array([]))
    })

    it('handles hex without 0x prefix', () => {
      const result = hexToBytes('deadbeef')
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    })

    it('handles single byte', () => {
      const result = hexToBytes('0x01')
      expect(result).toEqual(new Uint8Array([0x01]))
    })

    it('handles zero byte', () => {
      const result = hexToBytes('0x00')
      expect(result).toEqual(new Uint8Array([0x00]))
    })
  })

  describe('bytesToHex', () => {
    it('converts Uint8Array to hex string', () => {
      const result = bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
      expect(result).toBe('0xdeadbeef')
    })

    it('handles empty array', () => {
      const result = bytesToHex(new Uint8Array([]))
      expect(result).toBe('0x')
    })

    it('pads single-digit hex values', () => {
      const result = bytesToHex(new Uint8Array([0x01, 0x0a]))
      expect(result).toBe('0x010a')
    })
  })

  describe('concat', () => {
    it('concatenates hex strings', () => {
      const result = concat(['0x00', '0xff'])
      expect(result).toBe('0x00ff')
    })

    it('concatenates multiple hex strings', () => {
      const result = concat(['0xdead', '0xbeef', '0x01'])
      expect(result).toBe('0xdeadbeef01')
    })

    it('handles empty inputs', () => {
      const result = concat(['0x', '0x'])
      expect(result).toBe('0x')
    })

    it('handles single input', () => {
      const result = concat(['0xdead'])
      expect(result).toBe('0xdead')
    })

    it('handles empty array', () => {
      const result = concat([])
      expect(result).toBe('0x')
    })
  })

  describe('zeroPad', () => {
    it('pads to 32 bytes', () => {
      const result = zeroPad('0x01', 32)
      expect(result).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(hexDataLength(result)).toBe(32)
    })

    it('does not change already correct length', () => {
      const input =
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      const result = zeroPad(input, 32)
      expect(result).toBe(input)
    })

    it('throws if value is longer than target', () => {
      const input =
        '0x000000000000000000000000000000000000000000000000000000000000000001'
      expect(() => zeroPad(input, 32)).toThrow()
    })

    it('pads to 20 bytes (address length)', () => {
      const result = zeroPad('0x01', 20)
      expect(hexDataLength(result)).toBe(20)
    })
  })

  describe('stripZeros', () => {
    it('strips leading zeros', () => {
      const result = stripZeros('0x000001')
      expect(result).toBe('0x01')
    })

    it('handles no leading zeros', () => {
      const result = stripZeros('0xdeadbeef')
      expect(result).toBe('0xdeadbeef')
    })

    it('handles all zeros', () => {
      const result = stripZeros('0x000000')
      expect(result).toBe('0x')
    })

    it('handles empty', () => {
      const result = stripZeros('0x')
      expect(result).toBe('0x')
    })
  })

  describe('hexDataLength', () => {
    it('returns correct byte length', () => {
      expect(hexDataLength('0xdeadbeef')).toBe(4)
    })

    it('returns 0 for empty hex', () => {
      expect(hexDataLength('0x')).toBe(0)
    })

    it('returns 32 for 32-byte value', () => {
      expect(
        hexDataLength(
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        )
      ).toBe(32)
    })

    it('returns 20 for an address', () => {
      expect(
        hexDataLength('0xdE0B295669a9FD93d5F28D9Ec85E40f4cb697BAe')
      ).toBe(20)
    })
  })

  describe('isHexString', () => {
    it('returns true for valid hex', () => {
      expect(isHexString('0xdeadbeef')).toBe(true)
    })

    it('returns true for 0x', () => {
      expect(isHexString('0x')).toBe(true)
    })

    it('returns false for no prefix', () => {
      expect(isHexString('deadbeef')).toBe(false)
    })

    it('returns false for invalid characters', () => {
      expect(isHexString('0xGG')).toBe(false)
    })

    it('returns false for non-string', () => {
      expect(isHexString(123 as unknown as string)).toBe(false)
    })

    it('validates length when specified', () => {
      expect(isHexString('0xdeadbeef', 4)).toBe(true)
      expect(isHexString('0xdeadbeef', 3)).toBe(false)
    })
  })

  describe('padLeft', () => {
    it('pads to specified byte length', () => {
      const result = padLeft('0x1', 4)
      expect(result).toBe('0x00000001')
    })

    it('handles already correct length', () => {
      const result = padLeft('0xdeadbeef', 4)
      expect(result).toBe('0xdeadbeef')
    })
  })
})
