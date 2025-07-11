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
import { BigNumber } from 'ethers'

import { skipIfMainnet } from './testHelpers'
import { testSetup } from '../testSetup'
import { ParentToChildMessageGasEstimator } from '../../src/lib/message/ParentToChildMessageGasEstimator'
import {
  itOnlyWhenEth,
  itOnlyWhenCustomGasToken,
} from './custom-fee-token/mochaExtensions'

describe('ParentToChildMessageGasEstimator', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  itOnlyWhenEth(
    `"estimateSubmissionFee" returns non-0 for eth chain`,
    async () => {
      const { parentProvider, childProvider } = await testSetup()

      const submissionFee = await new ParentToChildMessageGasEstimator(
        childProvider
      ).estimateSubmissionFee(
        parentProvider,
        await parentProvider.getGasPrice(),
        123456
      )

      expect(submissionFee.toString()).to.not.eq(BigNumber.from(0).toString())
    }
  )

  itOnlyWhenCustomGasToken(
    `"estimateSubmissionFee" returns 0 for custom gas token chain`,
    async () => {
      const { parentProvider, childProvider } = await testSetup()

      const submissionFee = await new ParentToChildMessageGasEstimator(
        childProvider
      ).estimateSubmissionFee(
        parentProvider,
        await parentProvider.getGasPrice(),
        123456
      )

      expect(submissionFee.toString()).to.eq(BigNumber.from(0).toString())
    }
  )
})
