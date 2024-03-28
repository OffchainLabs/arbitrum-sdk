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
  getChildChain,
  ArbitrumNetwork,
} from '../../src/lib/dataEntities/networks'
import { testSetup } from '../../scripts/testSetup'
import { greeter } from './helper/greeter'
import { expect } from 'chai'
import { AdminErc20Bridger } from '../../src/lib/assetBridger/erc20Bridger'

const sendSignedTx = async (testState: any, info?: any) => {
  const { parentDeployer, childDeployer } = testState
  const childChain = await getChildChain(await childDeployer.getChainId())
  const inbox = new InboxTools(parentDeployer, childChain)
  const message = {
    ...info,
    value: BigNumber.from(0),
  }
  const signedTx = await inbox.signChildChainTx(message, childDeployer)

  const l1Tx = await inbox.sendChildChainSignedTx(signedTx)
  return {
    signedMsg: signedTx,
    l1TransactionReceipt: await l1Tx?.wait(),
  }
}

describe('Send signedTx to l2 using inbox', async () => {
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
    const { signedMsg, l1TransactionReceipt } = await sendSignedTx(
      testState,
      contractCreationData
    )
    const l1Status = l1TransactionReceipt?.status
    expect(l1Status).to.equal(1, 'l1 txn failed')
    const l2Tx = ethers.utils.parseTransaction(signedMsg)
    const l2Txhash = l2Tx.hash!
    const l2TxReceipt = await childDeployer.provider!.waitForTransaction(
      l2Txhash
    )
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
    const childDeployer = testState.childDeployer
    const info = {
      data: '0x12',
      to: await childDeployer.getAddress(),
    }
    const { signedMsg, l1TransactionReceipt } = await sendSignedTx(
      testState,
      info
    )
    const l1Status = l1TransactionReceipt?.status
    expect(l1Status).to.equal(1)
    const l2Txhash = ethers.utils.parseTransaction(signedMsg).hash!
    const l2TxReceipt = await childDeployer.provider!.waitForTransaction(
      l2Txhash
    )
    const l2Status = l2TxReceipt.status
    expect(l2Status).to.equal(1)
  })

  it('send two tx share the same nonce but with different gas price, should confirm the one which gas price higher than l2 base price', async () => {
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
    const lowFeeL1Status = lowFeeTx.l1TransactionReceipt?.status
    expect(lowFeeL1Status).to.equal(1)
    const info = {
      data: '0x12',
      to: await childDeployer.getAddress(),
      nonce: currentNonce,
    }
    const enoughFeeTx = await sendSignedTx(testState, info)
    const enoughFeeL1Status = enoughFeeTx.l1TransactionReceipt?.status
    expect(enoughFeeL1Status).to.equal(1)
    const l2LowFeeTxhash = ethers.utils.parseTransaction(lowFeeTx.signedMsg)
      .hash!
    const l2EnoughFeeTxhash = ethers.utils.parseTransaction(
      enoughFeeTx.signedMsg
    ).hash!

    const l2TEnoughFeeReceipt =
      await childDeployer.provider!.waitForTransaction(l2EnoughFeeTxhash)
    const l2Status = l2TEnoughFeeReceipt.status
    expect(l2Status).to.equal(1)
    const res = await childDeployer.provider?.getTransactionReceipt(
      l2LowFeeTxhash
    )
    expect(res).to.be.null
  })
})
