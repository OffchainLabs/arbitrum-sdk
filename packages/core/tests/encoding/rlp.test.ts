import { describe, it, expect } from 'vitest'
import { rlpEncode } from '../../src/encoding/rlp'

describe('RLP encoder', () => {
  describe('single values', () => {
    it('encodes empty string (0x80)', () => {
      expect(rlpEncode('0x')).toBe('0x80')
    })

    it('encodes single byte < 0x80', () => {
      expect(rlpEncode('0x7f')).toBe('0x7f')
    })

    it('encodes single zero byte', () => {
      // 0x00 is a single byte < 0x80 so it's returned as-is
      expect(rlpEncode('0x00')).toBe('0x00')
    })

    it('encodes single byte >= 0x80', () => {
      // 0x80 gets encoded as [0x81, 0x80]
      expect(rlpEncode('0x80')).toBe('0x8180')
    })

    it('encodes short string (1-55 bytes)', () => {
      // "dog" = 0x646f67 (3 bytes)
      // RLP: 0x83 0x64 0x6f 0x67
      expect(rlpEncode('0x646f67')).toBe('0x83646f67')
    })

    it('encodes 55-byte string', () => {
      // 55 bytes: 0x80 + 55 = 0xb7 prefix
      const data = '0x' + 'ab'.repeat(55)
      const result = rlpEncode(data)
      expect(result).toBe('0xb7' + 'ab'.repeat(55))
    })

    it('encodes long string (>55 bytes)', () => {
      // 56 bytes: length prefix 0xb8, 0x38 (56)
      const data = '0x' + 'ab'.repeat(56)
      const result = rlpEncode(data)
      expect(result).toBe('0xb838' + 'ab'.repeat(56))
    })
  })

  describe('lists', () => {
    it('encodes empty list', () => {
      expect(rlpEncode([])).toBe('0xc0')
    })

    it('encodes list with single element', () => {
      // ["dog"] = [0x646f67]
      // Inner: 0x83646f67 (4 bytes)
      // List prefix: 0xc0 + 4 = 0xc4
      expect(rlpEncode(['0x646f67'])).toBe('0xc483646f67')
    })

    it('encodes list with multiple elements', () => {
      // ["cat", "dog"]
      // "cat" = 0x636174 -> 0x83636174 (4 bytes)
      // "dog" = 0x646f67 -> 0x83646f67 (4 bytes)
      // Total inner: 8 bytes
      // List prefix: 0xc0 + 8 = 0xc8
      expect(rlpEncode(['0x636174', '0x646f67'])).toBe(
        '0xc883636174' + '83646f67'
      )
    })

    it('encodes nested lists', () => {
      // [[], [[]], [[], [[]]]]
      // [] -> 0xc0
      // [[]] -> 0xc1c0
      // [[], [[]]] -> 0xc3c0c1c0
      // Outer: 0xc0 + 0xc1c0 + 0xc3c0c1c0 = 1 + 2 + 4 = 7 bytes
      // List prefix: 0xc0 + 7 = 0xc7
      expect(rlpEncode([[], [[]], [[], [[]]]])).toBe('0xc7c0c1c0c3c0c1c0')
    })

    it('encodes list with empty strings', () => {
      // ['', ''] as empty byte strings
      // Each empty string encodes to 0x80
      // Inner: 0x80 0x80 = 2 bytes
      // List prefix: 0xc0 + 2 = 0xc2
      expect(rlpEncode(['0x', '0x'])).toBe('0xc28080')
    })
  })

  describe('integration: retryable ticket style encoding', () => {
    it('encodes a structure similar to calculateSubmitRetryableId', () => {
      // This mimics the RLP encoding done in calculateSubmitRetryableId:
      // [chainId, msgNum, fromAddress, destAddress, l2CallValue,
      //  l1Value, maxSubmissionFee, excessFeeRefundAddress,
      //  callValueRefundAddress, gasLimit, maxFeePerGas, data]
      const fields = [
        '0x66eee', // chainId (421614 = 0x66eee) — need to verify stripped zeros
        '0x01', // msgNum
        '0x0000000000000000000000000000000000000000', // from
        '0x0000000000000000000000000000000000000001', // dest
        '0x', // l2CallValue = 0
        '0x', // l1Value = 0
        '0x', // maxSubmissionFee = 0
        '0x0000000000000000000000000000000000000000', // excessFeeRefundAddress
        '0x0000000000000000000000000000000000000000', // callValueRefundAddress
        '0x', // gasLimit = 0
        '0x', // maxFeePerGas = 0
        '0x', // data = empty
      ]
      const result = rlpEncode(fields)
      // Should be a valid RLP-encoded list
      expect(result.startsWith('0x')).toBe(true)
      expect(result.length).toBeGreaterThan(4)
    })
  })

  describe('bigint encoding via hex', () => {
    it('encodes zero correctly', () => {
      // Zero should be encoded as empty string in RLP
      expect(rlpEncode('0x')).toBe('0x80')
    })

    it('encodes small number', () => {
      // 1 = 0x01, single byte < 0x80
      expect(rlpEncode('0x01')).toBe('0x01')
    })

    it('encodes larger number', () => {
      // 1024 = 0x0400
      expect(rlpEncode('0x0400')).toBe('0x820400')
    })
  })
})
