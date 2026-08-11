/**
 * Keccak256 hashing using @noble/hashes.
 */
import { keccak_256 } from '@noble/hashes/sha3'
import { hexToBytes, bytesToHex } from './hex'

/**
 * Compute the keccak256 hash of hex string or Uint8Array input.
 * Returns a 0x-prefixed hex string.
 */
export function keccak256(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? hexToBytes(data) : data
  return bytesToHex(keccak_256(bytes))
}
