/**
 * Address alias utilities for L1 <-> L2 address mapping.
 *
 * When a contract on L1 sends a message to L2, its address is aliased
 * by adding ADDRESS_ALIAS_OFFSET. This module provides functions to
 * apply and reverse that aliasing.
 */
import { ADDRESS_ALIAS_OFFSET } from '../constants'
import { getAddress } from '../encoding/address'

const ADDRESS_ALIAS_OFFSET_BIGINT = BigInt(ADDRESS_ALIAS_OFFSET)
const ADDRESS_BIT_LENGTH = 160
const ADDRESS_NIBBLE_LENGTH = ADDRESS_BIT_LENGTH / 4

/**
 * Apply the L2 alias to an L1 address.
 *
 * @param address - A valid Ethereum address (0x-prefixed, 40 hex chars)
 * @returns The aliased address, checksummed
 */
export function applyAlias(address: string): string {
  return getAddress(
    '0x' +
      BigInt.asUintN(
        ADDRESS_BIT_LENGTH,
        BigInt(address) + ADDRESS_ALIAS_OFFSET_BIGINT
      )
        .toString(16)
        .padStart(ADDRESS_NIBBLE_LENGTH, '0')
  )
}

/**
 * Reverse the L2 alias to recover the original L1 address.
 *
 * @param address - An aliased Ethereum address (0x-prefixed, 40 hex chars)
 * @returns The original un-aliased address, checksummed
 */
export function undoAlias(address: string): string {
  return getAddress(
    '0x' +
      BigInt.asUintN(
        ADDRESS_BIT_LENGTH,
        BigInt(address) - ADDRESS_ALIAS_OFFSET_BIGINT
      )
        .toString(16)
        .padStart(ADDRESS_NIBBLE_LENGTH, '0')
  )
}
