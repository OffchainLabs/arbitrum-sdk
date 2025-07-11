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

import { BigNumber, ethers, Signer } from 'ethers'
import { InboxTools } from '../../src/lib/inbox/inbox'
import {
  getArbitrumNetwork,
  ArbitrumNetwork,
} from '../../src/lib/dataEntities/networks'
import { testSetup } from '../testSetup'
import { greeter } from './helper/greeter'
import { expect } from 'chai'
import { AdminErc20Bridger } from '../../src/lib/assetBridger/erc20Bridger'

const sendSignedTx = async (testState: any, info?: any) => {
  const { parentDeployer, childDeployer } = testState
  const childChain = await getArbitrumNetwork(await childDeployer.getChainId())
  const inbox = new InboxTools(parentDeployer, childChain)
  const message = {
    ...info,
    value: BigNumber.from(0),
  }
  const signedTx = await inbox.signChildTx(message, childDeployer)

  const parentTx = await inbox.sendChildSignedTx(signedTx)
  return {
    signedMsg: signedTx,
    parentTransactionReceipt: await parentTx?.wait(),
  }
}

describe('Send signedTx to child chain using inbox', async () => {
  // test globals
  let testState: {
    parentDeployer: Signer
    childDeployer: Signer
    adminErc20Bridger: AdminErc20Bridger
    childChain: ArbitrumNetwork
  }

  before('init', async () => {
    testState = await testSetup()
  })

  it('can deploy contract', async () => {
    const childDeployer = testState.childDeployer
    const Greeter = new ethers.ContractFactory(
      greeter.abi,
      greeter.bytecode
    ).connect(childDeployer)

    const info = {
      value: BigNumber.from(0),
    }
    const contractCreationData = Greeter.getDeployTransaction(info)
    const { signedMsg, parentTransactionReceipt } = await sendSignedTx(
      testState,
      contractCreationData
    )
    const parentStatus = parentTransactionReceipt?.status
    expect(parentStatus).to.equal(1, 'parent txn failed')
    const childTx = ethers.utils.parseTransaction(signedMsg)
    const childTxhash = childTx.hash!
    const childTxReceipt = await childDeployer.provider!.waitForTransaction(
      childTxhash
    )
    const childStatus = childTxReceipt.status
    expect(childStatus).to.equal(1, 'child txn failed')
    const contractAddress = ethers.ContractFactory.getContractAddress({
      from: childTx.from!,
      nonce: childTx.nonce,
    })
    const greeterImp = Greeter.attach(contractAddress)
    const greetResult = await greeterImp.greet()
    expect(greetResult).to.equal('hello world', 'contract returns not expected')
  })

  it('should confirm the same tx on child chain', async () => {
    const childDeployer = testState.childDeployer
    const info = {
      data: '0x12',
      to: await childDeployer.getAddress(),
    }
    const { signedMsg, parentTransactionReceipt: parentTransactionReceipt } =
      await sendSignedTx(testState, info)
    const parentStatus = parentTransactionReceipt?.status
    expect(parentStatus).to.equal(1)
    const childTxhash = ethers.utils.parseTransaction(signedMsg).hash!
    const childTxReceipt = await childDeployer.provider!.waitForTransaction(
      childTxhash
    )
    const childStatus = childTxReceipt.status
    expect(childStatus).to.equal(1)
  })

  it('send two tx share the same nonce but with different gas price, should confirm the one which gas price higher than child base price', async () => {
    const childDeployer = testState.childDeployer
    const currentNonce = await childDeployer.getTransactionCount()

    const lowFeeInfo = {
      data: '0x12',
      nonce: currentNonce,
      to: await childDeployer.getAddress(),
      maxFeePerGas: BigNumber.from(10000000), //0.01gwei
      maxPriorityFeePerGas: BigNumber.from(1000000), //0.001gwei
    }
    const lowFeeTx = await sendSignedTx(testState, lowFeeInfo)
    const lowFeeParentStatus = lowFeeTx.parentTransactionReceipt?.status
    expect(lowFeeParentStatus).to.equal(1)
    const info = {
      data: '0x12',
      to: await childDeployer.getAddress(),
      nonce: currentNonce,
    }
    const enoughFeeTx = await sendSignedTx(testState, info)
    const enoughFeeParentStatus = enoughFeeTx.parentTransactionReceipt?.status
    expect(enoughFeeParentStatus).to.equal(1)
    const childLowFeeTxhash = ethers.utils.parseTransaction(lowFeeTx.signedMsg)
      .hash!
    const childEnoughFeeTxhash = ethers.utils.parseTransaction(
      enoughFeeTx.signedMsg
    ).hash!

    const childTEnoughFeeReceipt =
      await childDeployer.provider!.waitForTransaction(childEnoughFeeTxhash)
    const childStatus = childTEnoughFeeReceipt.status
    expect(childStatus).to.equal(1)
    const res = await childDeployer.provider?.getTransactionReceipt(
      childLowFeeTxhash
    )
    expect(res).to.be.null
  })
})
