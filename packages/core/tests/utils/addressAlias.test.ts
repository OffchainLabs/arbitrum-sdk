import { describe, it, expect } from 'vitest'
import { applyAlias, undoAlias } from '../../src/utils/addressAlias'
import { getAddress } from '../../src/encoding/address'

describe('Address Alias', () => {
  /**
   * Helper: apply, undo, and verify round-trip for a given address.
   * Port of the old SDK's testApplyUndo pattern.
   */
  function testApplyUndo(
    addr: string,
    expectedApply: string,
    expectedUndo: string
  ) {
    const afterApply = applyAlias(addr)
    expect(afterApply).toBe(expectedApply)

    const afterApplyUndo = undoAlias(afterApply)
    expect(afterApplyUndo).toBe(addr)

    const afterUndo = undoAlias(addr)
    expect(afterUndo).toBe(expectedUndo)

    const afterUndoApply = applyAlias(afterUndo)
    expect(afterUndoApply).toBe(addr)
  }

  it('aliases correctly below offset', () => {
    // maxAddr - offset - 10 = 0xeeeeffffffffffffffffffffffffffffffffeee4
    const belowOffset = getAddress(
      '0xeeeeffffffffffffffffffffffffffffffffeee4'
    )

    testApplyUndo(
      belowOffset,
      getAddress('0xfffffffffffffffffffffffffffffffffffffff5'),
      getAddress('0xddddffffffffffffffffffffffffffffffffddd3')
    )
  })

  it('aliases correctly on the offset boundary', () => {
    // maxAddr - offset = 0xeeeeffffffffffffffffffffffffffffffffeeee
    const onOffset = getAddress(
      '0xeeeeffffffffffffffffffffffffffffffffeeee'
    )

    testApplyUndo(
      onOffset,
      getAddress('0xffffffffffffffffffffffffffffffffffffffff'),
      getAddress('0xddddffffffffffffffffffffffffffffffffdddd')
    )
  })

  it('aliases correctly above offset (overflow)', () => {
    // maxAddr - offset + 10 = 0xeeeeffffffffffffffffffffffffffffffffeef8
    const aboveOffset = getAddress(
      '0xeeeeffffffffffffffffffffffffffffffffeef8'
    )

    testApplyUndo(
      aboveOffset,
      getAddress('0x0000000000000000000000000000000000000009'),
      getAddress('0xddddffffffffffffffffffffffffffffffffdde7')
    )
  })

  it('aliases special case (overflow bug regression)', () => {
    // This address originally caused the overflow bug
    const special = '0xFfC98231ef2fd1F77106E10581A1faC14E29d014'

    testApplyUndo(
      getAddress(special),
      getAddress('0x10da8231ef2fd1f77106e10581a1fac14e29e125'),
      getAddress('0xeeb88231ef2fd1f77106e10581a1fac14e29bf03')
    )
  })
})
