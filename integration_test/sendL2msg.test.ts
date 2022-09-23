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
// import { instantiateBridge } from './instantiate_bridge'
;('use strict')

import { BigNumber, ethers, providers, Wallet } from "ethers";
import { InboxTools } from "../src/lib/inbox/inbox"
import { getL2Network } from '../src/lib/dataEntities/networks'
import { testSetup } from '../scripts/testSetup'
import { expect } from "chai";

const sendSignedTx = async () => {
    const { l1Deployer,l2Deployer } = await testSetup()
    const l2Network = await getL2Network(await l2Deployer.getChainId())
    const inbox = new InboxTools(l1Deployer, l2Network)
    const message = {
        to: await l2Deployer.getAddress(),
        value: BigNumber.from(0),
        data: "0x12"
    }
    const signedTx = await inbox.signL2Tx(message, false, l2Deployer)
   // const l1TxReceipt = await inbox.sendL2SignedTx(signedTx)
    return {
        signedMsg: signedTx,
        l1TransactionReceipt: null
    }
}

describe("Send signedTx to l2 using inbox", () => {
    it("should confirm the same tx on l2", async () => {
        const { l2Deployer } = await testSetup()
        const { signedMsg, l1TransactionReceipt } = await sendSignedTx()
        const l2Txhash = ethers.utils.parseTransaction(signedMsg).hash!
        const l2TxReceipt = await l2Deployer.provider!.waitForTransaction(l2Txhash)
        const status = l2TxReceipt.status
        expect(status).to.equal(1)
    })
})



