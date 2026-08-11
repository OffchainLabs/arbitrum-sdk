/**
 * Hex string encoding/decoding utilities.
 * Zero external dependencies.
 */

const HEX_CHARS = '0123456789abcdef'

/**
 * Check if a value is a valid hex string with 0x prefix.
 * Optionally check that it represents `length` bytes.
 */
export function isHexString(value: unknown, length?: number): boolean {
  if (typeof value !== 'string') return false
  if (!value.match(/^0x[0-9a-fA-F]*$/)) return false
  if (length !== undefined && (value.length - 2) / 2 !== length) return false
  return true
}

/**
 * Convert a hex string to a Uint8Array.
 * Accepts with or without 0x prefix.
 */
export function hexToBytes(hex: string): Uint8Array {
  let h = hex.startsWith('0x') ? hex.slice(2) : hex
  // Ensure even length
  if (h.length % 2 !== 0) {
    h = '0' + h
  }
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert a Uint8Array to a 0x-prefixed lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '0x'
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_CHARS[bytes[i] >> 4]
    hex += HEX_CHARS[bytes[i] & 0x0f]
  }
  return hex
}

/**
 * Concatenate multiple hex strings into one.
 */
export function concat(hexStrings: string[]): string {
  let result = '0x'
  for (const h of hexStrings) {
    result += h.startsWith('0x') ? h.slice(2) : h
  }
  return result
}

/**
 * Left-pad a hex string with zeros to reach `byteLength` bytes.
 * Throws if the value is already longer than the target.
 */
export function zeroPad(hex: string, byteLength: number): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  const currentByteLen = Math.ceil(stripped.length / 2)
  if (currentByteLen > byteLength) {
    throw new Error(
      `Value ${hex} is ${currentByteLen} bytes, exceeds target ${byteLength} bytes`
    )
  }
  return '0x' + stripped.padStart(byteLength * 2, '0')
}

/**
 * Alias for zeroPad - left-pad a hex value with zeros.
 */
export function padLeft(hex: string, byteLength: number): string {
  return zeroPad(hex, byteLength)
}

/**
 * Strip leading zero bytes from a hex string.
 */
export function stripZeros(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  let i = 0
  while (i < stripped.length - 1 && stripped[i] === '0' && stripped[i + 1] === '0') {
    i += 2
  }
  const result = stripped.slice(i)
  // If we stripped everything, return 0x
  if (result === '' || result === '0' || result === '00') {
    // Check if the original was all zeros
    if (/^0*$/.test(stripped)) return '0x'
  }
  return '0x' + result
}

/**
 * Get the byte length of a hex string.
 */
export function hexDataLength(hex: string): number {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  return stripped.length / 2
}
