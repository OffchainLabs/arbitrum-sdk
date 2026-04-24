/**
 * Minimal RLP (Recursive Length Prefix) encoder.
 * Implements the encoding spec from the Ethereum Yellow Paper, Appendix B.
 *
 * Input can be:
 * - A hex string (0x-prefixed) representing a byte sequence
 * - An array of RLP-encodable items (recursive)
 */
import { hexToBytes, bytesToHex } from './hex'

export type RlpInput = string | readonly RlpInput[]

/**
 * RLP-encode a value and return the result as a 0x-prefixed hex string.
 */
export function rlpEncode(input: RlpInput): string {
  return bytesToHex(rlpEncodeBytes(input))
}

function rlpEncodeBytes(input: RlpInput): Uint8Array {
  if (typeof input === 'string') {
    return encodeString(hexToBytes(input))
  }
  return encodeList(input)
}

function encodeString(bytes: Uint8Array): Uint8Array {
  // Single byte in range [0x00, 0x7f]: returned as-is
  if (bytes.length === 1 && bytes[0] < 0x80) {
    return bytes
  }

  // 0-55 bytes: prefix is 0x80 + length
  if (bytes.length <= 55) {
    const result = new Uint8Array(1 + bytes.length)
    result[0] = 0x80 + bytes.length
    result.set(bytes, 1)
    return result
  }

  // >55 bytes: prefix is 0xb7 + length-of-length, then the length in big-endian
  const lenBytes = encodeBigEndian(bytes.length)
  const result = new Uint8Array(1 + lenBytes.length + bytes.length)
  result[0] = 0xb7 + lenBytes.length
  result.set(lenBytes, 1)
  result.set(bytes, 1 + lenBytes.length)
  return result
}

function encodeList(items: readonly RlpInput[]): Uint8Array {
  // Encode each item, then concatenate
  const encoded: Uint8Array[] = []
  let totalLength = 0
  for (const item of items) {
    const e = rlpEncodeBytes(item)
    encoded.push(e)
    totalLength += e.length
  }

  // Short list (total payload 0-55 bytes): prefix is 0xc0 + totalLength
  if (totalLength <= 55) {
    const result = new Uint8Array(1 + totalLength)
    result[0] = 0xc0 + totalLength
    let offset = 1
    for (const e of encoded) {
      result.set(e, offset)
      offset += e.length
    }
    return result
  }

  // Long list (total payload > 55 bytes): prefix is 0xf7 + length-of-length, then the length
  const lenBytes = encodeBigEndian(totalLength)
  const result = new Uint8Array(1 + lenBytes.length + totalLength)
  result[0] = 0xf7 + lenBytes.length
  result.set(lenBytes, 1)
  let offset = 1 + lenBytes.length
  for (const e of encoded) {
    result.set(e, offset)
    offset += e.length
  }
  return result
}

/**
 * Encode a non-negative integer as big-endian bytes with no leading zeros.
 */
function encodeBigEndian(value: number): Uint8Array {
  if (value === 0) return new Uint8Array([0])

  const bytes: number[] = []
  let v = value
  while (v > 0) {
    bytes.unshift(v & 0xff)
    v = v >> 8
  }
  return new Uint8Array(bytes)
}
