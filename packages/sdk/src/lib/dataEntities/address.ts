import { getAddress } from '@ethersproject/address'
import { utils } from 'ethers'
import { ADDRESS_ALIAS_OFFSET } from './constants'
import { ArbSdkError } from './errors'

/**
 * Ethereum/Arbitrum address class
 */
export class Address {
  private readonly ADDRESS_ALIAS_OFFSET_BIG_INT = BigInt(ADDRESS_ALIAS_OFFSET)
  private readonly ADDRESS_BIT_LENGTH = 160
  private readonly ADDRESS_NIBBLE_LENGTH = this.ADDRESS_BIT_LENGTH / 4

  /**
   * Ethereum/Arbitrum address class
   * @param value A valid Ethereum address. Doesn't need to be checksum cased.
   */
  constructor(public readonly value: string) {
    if (!utils.isAddress(value))
      throw new ArbSdkError(`'${value}' is not a valid address`)
  }

  private alias(address: string, forward: boolean) {
    // we use BigInts in here to allow for proper under/overflow behaviour
    // BigInt.asUintN calculates the correct positive modulus
    return getAddress(
      '0x' +
        BigInt.asUintN(
          this.ADDRESS_BIT_LENGTH,
          forward
            ? BigInt(address) + this.ADDRESS_ALIAS_OFFSET_BIG_INT
            : BigInt(address) - this.ADDRESS_ALIAS_OFFSET_BIG_INT
        )
          .toString(16)
          .padStart(this.ADDRESS_NIBBLE_LENGTH, '0')
    )
  }

  /**
   * Find the L2 alias of an L1 address
   * @returns
   */
  public applyAlias(): Address {
    return new Address(this.alias(this.value, true))
  }

  /**
   * Find the L1 alias of an L2 address
   * @returns
   */
  public undoAlias(): Address {
    return new Address(this.alias(this.value, false))
  }

  public equals(other: Address): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase()
  }
}
