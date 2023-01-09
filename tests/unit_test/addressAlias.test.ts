/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { expect } from 'chai'

import { Address } from '../../src/lib/dataEntities/address'
import { BigNumber } from 'ethers'
import { ADDRESS_ALIAS_OFFSET } from '../../src/lib/dataEntities/constants'
import { hexZeroPad } from '@ethersproject/bytes'
import { getAddress } from '@ethersproject/address'
const offset = BigNumber.from(ADDRESS_ALIAS_OFFSET)
const maxAddr = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffff')

describe('Address', () => {
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

  it('does alias correctly below offset', async () => {
    // 0xeeeeffffffffffffffffffffffffffffffffeee4
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

  it('does alias correctly on', async () => {
    // 0xeeeeffffffffffffffffffffffffffffffffeeee
    const onOffset = hexZeroPad(maxAddr.sub(offset).add(0).toHexString(), 20)

    testApplyUndo(
      getAddress(onOffset),
      getAddress('0xffffffffffffffffffffffffffffffffffffffff'),
      getAddress('0xddddffffffffffffffffffffffffffffffffdddd')
    )
  })

  it('does alias correctly above offset', async () => {
    // 0xeeeeffffffffffffffffffffffffffffffffeef8
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

  it('does alias special case', async () => {
    // this is the address that initially caused the overflow bug in
    // in address aliasing, so we just keep it here as a test case
    const special = '0xFfC98231ef2fd1F77106E10581A1faC14E29d014'

    testApplyUndo(
      getAddress(special),
      getAddress('0x10da8231ef2fd1f77106e10581a1fac14e29e125'),
      getAddress('0xeeb88231ef2fd1f77106e10581a1fac14e29bf03')
    )
  })
})
