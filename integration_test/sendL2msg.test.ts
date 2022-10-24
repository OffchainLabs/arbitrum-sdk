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

import { BigNumber, ethers, providers, Wallet } from 'ethers'
import { InboxTools } from '../src/lib/inbox/inbox'
import { getL2Network } from '../src/lib/dataEntities/networks'
import { testSetup } from '../scripts/testSetup'
import { greeter } from './helper/greeter'
import { expect } from 'chai'
import { isBytes } from '@ethersproject/bytes'

const sendSignedTx = async (contractCreation: boolean, info?: any) => {
  const { l1Deployer, l2Deployer } = await testSetup()
  const l2Network = await getL2Network(await l2Deployer.getChainId())
  const inbox = new InboxTools(l1Deployer, l2Network)
  const message = {
    ...info,
    to: await l2Deployer.getAddress(),
    value: BigNumber.from(0),
  }
  const signedTx = await inbox.signL2Tx(message, l2Deployer)

  const l1Tx = await inbox.sendL2SignedTx(signedTx)
  return {
    signedMsg: signedTx,
    l1TransactionReceipt: await l1Tx?.wait(),
  }
}

describe('Send signedTx to l2 using inbox', () => {
  it('can deploy contract', async () => {
    const { l2Deployer } = await testSetup()
    const Greeter = new ethers.ContractFactory(
      greeter.abi,
      greeter.bytecode
    ).connect(l2Deployer)

    const info = {
      value: BigNumber.from(0),
    }
    const contractCreationData = Greeter.getDeployTransaction(info)

    const { signedMsg, l1TransactionReceipt } = await sendSignedTx(
      true,
      contractCreationData
    )
    const l1Status = l1TransactionReceipt?.status
    expect(l1Status).to.equal(1, 'l1 txn failed')
    const l2Tx = ethers.utils.parseTransaction(signedMsg)
    const l2Txhash = l2Tx.hash!
    const l2TxReceipt = await l2Deployer.provider!.waitForTransaction(l2Txhash)
    const l2Status = l2TxReceipt.status
    expect(l2Status).to.equal(1, 'l2 txn failed')
    const contractAddress = ethers.ContractFactory.getContractAddress({
      from: l2Tx.from!,
      nonce: l2Tx.nonce,
    })
    const greeterImp = Greeter.attach(contractAddress)
    const greetResult = await greeterImp.greet()
    expect(greetResult).to.equal('hello world', 'contract returns not expected')
  })

  it('should confirm the same tx on l2', async () => {
    const { l2Deployer } = await testSetup()
    const info = {
      data: '0x12',
    }
    const { signedMsg, l1TransactionReceipt } = await sendSignedTx(false, info)
    const l1Status = l1TransactionReceipt?.status
    expect(l1Status).to.equal(1)
    const l2Txhash = ethers.utils.parseTransaction(signedMsg).hash!
    const l2TxReceipt = await l2Deployer.provider!.waitForTransaction(l2Txhash)
    const l2Status = l2TxReceipt.status
    expect(l2Status).to.equal(1)
  })
})
