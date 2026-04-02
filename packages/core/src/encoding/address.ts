/**
 * Ethereum address utilities — checksumming and validation.
 * Implements EIP-55 checksum using keccak256.
 */
import { keccak256 } from './keccak'

/**
 * Returns the EIP-55 checksummed version of an address.
 * Throws if the input is not a valid 20-byte hex string.
 */
export function getAddress(address: string): string {
  if (typeof address !== 'string') {
    throw new Error(`Invalid address: expected string, got ${typeof address}`)
  }

  // Must be 0x + 40 hex chars
  if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error(`Invalid address: ${address}`)
  }

  const lower = address.slice(2).toLowerCase()
  const hashHex = keccak256(
    '0x' +
      Array.from(lower)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
  ).slice(2)

  let checksummed = '0x'
  for (let i = 0; i < 40; i++) {
    if (parseInt(hashHex[i], 16) >= 8) {
      checksummed += lower[i].toUpperCase()
    } else {
      checksummed += lower[i]
    }
  }
  return checksummed
}

/**
 * Check if a value is a valid Ethereum address (40 hex chars with 0x prefix).
 * Does not validate checksum — any casing is accepted.
 */
export function isAddress(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}
