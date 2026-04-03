/**
 * Compat layer: Address class
 *
 * Delegates to @arbitrum/core applyAlias/undoAlias but wraps in the
 * old class-based API that the v3/v4 SDK exposed.
 */
import { utils } from 'ethers'
import { applyAlias, undoAlias } from '@arbitrum/core'
import { ArbSdkError } from '../lib/dataEntities/errors'

export class Address {
  constructor(public readonly value: string) {
    if (!utils.isAddress(value)) {
      throw new ArbSdkError(`'${value}' is not a valid address`)
    }
  }

  public applyAlias(): Address {
    return new Address(applyAlias(this.value))
  }

  public undoAlias(): Address {
    return new Address(undoAlias(this.value))
  }

  public equals(other: Address): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase()
  }
}
