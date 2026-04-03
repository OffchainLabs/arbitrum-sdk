import { describe, it, expect } from 'vitest'
import { BigNumber } from 'ethers'
import { hexZeroPad } from '@ethersproject/bytes'
import { getAddress } from '@ethersproject/address'
import { Address } from '../../../src/compat/address'
import { ADDRESS_ALIAS_OFFSET } from '../../../src/lib/dataEntities/constants'

const offset = BigNumber.from(ADDRESS_ALIAS_OFFSET)
const maxAddr = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffff')

describe('Address (compat)', () => {
  const testApplyUndo = (
    addr: string,
    expectedApply: string,
    expectedUndo: string
  ) => {
    const address = new Address(addr)

    const afterApply = address.applyAlias()
    expect(afterApply.value, 'invalid apply alias').to.eq(expectedApply)

    const afterApplyUndo = afterApply.undoAlias()
    expect(afterApplyUndo.value, 'invalid undo after apply alias').to.eq(addr)

    const afterUndo = address.undoAlias()
    expect(afterUndo.value, 'invalid undo alias').to.eq(expectedUndo)

    const afterUndoApply = afterUndo.applyAlias()
    expect(afterUndoApply.value, 'invalid apply after undo alias').to.eq(addr)
  }

  it('constructs with a valid address', () => {
    const addr = new Address('0x0000000000000000000000000000000000000001')
    expect(addr.value).to.eq('0x0000000000000000000000000000000000000001')
  })

  it('throws for invalid address', () => {
    expect(() => new Address('not-an-address')).to.throw()
  })

  it('equals compares case-insensitively', () => {
    const a = new Address('0x0000000000000000000000000000000000000001')
    const b = new Address('0x0000000000000000000000000000000000000001')
    expect(a.equals(b)).to.be.true
  })

  it('does alias correctly below offset', () => {
    const belowOffset = hexZeroPad(
      maxAddr.sub(offset).sub(10).toHexString(),
      20
    )

    testApplyUndo(
      getAddress(belowOffset),
      getAddress('0xfffffffffffffffffffffffffffffffffffffff5'),
      getAddress('0xddddffffffffffffffffffffffffffffffffddd3')
    )
  })

  it('does alias correctly on', () => {
    const onOffset = hexZeroPad(maxAddr.sub(offset).add(0).toHexString(), 20)

    testApplyUndo(
      getAddress(onOffset),
      getAddress('0xffffffffffffffffffffffffffffffffffffffff'),
      getAddress('0xddddffffffffffffffffffffffffffffffffdddd')
    )
  })

  it('does alias correctly above offset', () => {
    const aboveOffset = hexZeroPad(
      maxAddr.sub(offset).add(10).toHexString(),
      20
    )

    testApplyUndo(
      getAddress(aboveOffset),
      getAddress('0x0000000000000000000000000000000000000009'),
      getAddress('0xddddffffffffffffffffffffffffffffffffdde7')
    )
  })

  it('does alias special case', () => {
    const special = '0xFfC98231ef2fd1F77106E10581A1faC14E29d014'

    testApplyUndo(
      getAddress(special),
      getAddress('0x10da8231ef2fd1f77106e10581a1fac14e29e125'),
      getAddress('0xeeb88231ef2fd1f77106e10581a1fac14e29bf03')
    )
  })
})
