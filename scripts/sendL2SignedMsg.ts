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
;('use strict')

import { BigNumber } from 'ethers'
import { InboxTools } from '../src/lib/inbox/inbox'
import { getL2Network } from '../src/lib/dataEntities/networks'
import { testSetup } from '../scripts/testSetup'
const sendSignedMsg = async () => {
  const { l1Deployer, l2Deployer } = await testSetup()
  const l2Network = await getL2Network(await l2Deployer.getChainId())
  const inbox = new InboxTools(l1Deployer, l2Network)
  const message = {
    to: await l2Deployer.getAddress(),
    value: BigNumber.from(0),
    data: '0x12',
  }
  const signedTx = await inbox.signL2Tx(message, l2Deployer)
  await inbox.sendL2SignedTx(signedTx)
}

sendSignedMsg()
  .then(() => {
    console.log('done')
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
