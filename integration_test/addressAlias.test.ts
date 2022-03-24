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

import { applyL1ToL2Alias, undoL1ToL2Alias } from '../src/lib/utils/lib'
import { BigNumber } from 'ethers'
import { ADDRESS_ALIAS_OFFSET } from '../src/lib/dataEntities/constants'
const offset = BigNumber.from(ADDRESS_ALIAS_OFFSET)
const maxAddr = BigNumber.from("0xffffffffffffffffffffffffffffffffffffffff");

describe.only('Address alias', () => {
  it('does alias correctly below offset', async () => {
    const belowOffset = maxAddr.sub(offset).sub(10)
    const afterApply = applyL1ToL2Alias(belowOffset.toHexString())
    expect(afterApply, "invalid apply alias").to.eq("0xfffffffffffffffffffffffffffffffffffffff5")

    const afterUndo = undoL1ToL2Alias(afterApply);
    expect(afterUndo, "invalid undo alias").to.eq(belowOffset.toHexString())
  })

  it('does alias correctly on', async () => {
    const belowOffset = maxAddr.sub(offset).add(0)
    const afterApply = applyL1ToL2Alias(belowOffset.toHexString())
    expect(afterApply, "invalid apply alias").to.eq("0xffffffffffffffffffffffffffffffffffffffff")

    const afterUndo = undoL1ToL2Alias(afterApply);
    expect(afterUndo, "invalid undo alias").to.eq(belowOffset.toHexString())
  })

  it('does alias correctly above offset', async () => {
    const belowOffset = maxAddr.sub(offset).add(10)
    const afterApply = applyL1ToL2Alias(belowOffset.toHexString())
    expect(afterApply, "invalid apply alias").to.eq("0x0000000000000000000000000000000000000009")
                                                                   
    const afterUndo = undoL1ToL2Alias(afterApply);
    expect(afterUndo, "invalid undo alias").to.eq(belowOffset.toHexString())
  })
})
