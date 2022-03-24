import { getAddress as getAddress } from '@ethersproject/address'
import { utils } from 'ethers'
import { ADDRESS_ALIAS_OFFSET } from '../dataEntities/constants'
import { ArbTsError } from '../dataEntities/errors'

export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

const ADDRESS_ALIAS_OFFSET_BIG_INT = BigInt(ADDRESS_ALIAS_OFFSET)

export const throwIfNotAddress = (address: string) => {
  if (!utils.isAddress(address))
    throw new ArbTsError(`The supplied '${address}' is not a valid address`)
}

/**
 * Find the L2 alias of an L1 address
 * @param l1Address
 * @returns
 */
export const applyL1ToL2Alias = (l1Address: string): string => {
  throwIfNotAddress(l1Address)

  // we use BigInts in here and undo to allow for proper under/overflow behaviour
  // BigInt.asUintN calculates the correct positive modulus

  return getAddress(
    '0x' +
      BigInt.asUintN(160, BigInt(l1Address) + ADDRESS_ALIAS_OFFSET_BIG_INT)
        .toString(16)
        .padStart(40, '0')
  )
}

/**
 * Find the L1 alias of an L2 address
 * @param l2Address
 * @returns
 */
export const undoL1ToL2Alias = (l2Address: string): string => {
  throwIfNotAddress(l2Address)

  // we use BigInts in here and apply to allow for proper under/overflow behaviour
  // BigInt.asUintN calculates the correct positive modulus
  return getAddress(
    '0x' +
      BigInt.asUintN(160, BigInt(l2Address) - ADDRESS_ALIAS_OFFSET_BIG_INT)
        .toString(16)
        .padStart(40, '0')
  )
}
