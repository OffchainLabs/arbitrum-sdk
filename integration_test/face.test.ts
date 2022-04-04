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
import dotenv from 'dotenv'

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'
import { Provider } from '@ethersproject/abstract-provider'

import { ArbGasInfo__factory } from '../src/lib/abi/factories/ArbGasInfo__factory'
import { fundL1, fundL2, prettyLog, skipIfMainnet, wait } from './testHelpers'
import {
  ARB_GAS_INFO,
  ARB_SYS_ADDRESS,
} from '../src/lib/dataEntities/constants'
import {
  L2ToL1Message,
  L2ToL1MessageStatus,
} from '../src/lib/message/L2ToL1Message'
import { L1ToL2MessageStatus } from '../src/lib/message/L1ToL2Message'
import { TestERC20__factory } from '../src/lib/abi/factories/TestERC20__factory'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Contract } from 'ethers'
import { testSetup } from '../scripts/testSetup'
import { hexZeroPad } from '@ethersproject/bytes'
import { L2TransactionReceipt } from '../src'
import { Interface, solidityKeccak256 } from 'ethers/lib/utils'
dotenv.config()

describe('outbox proof', () => {
  const fs = require('fs')

  // the smallest power of two greater than the input
  const nextPowerOf2 = (value: number) => {
    return 1 << log2ceil(value)
  }

  // the log2 of the int, rounded up
  const log2ceil = (value: number) => {
    let result = 0
    while (value >= 1) {
      value = ~~(value / 2)
      result += 1
    }
    return result
  }

  let cases = [0, 1, 2, 3, 4, 7, 13, 28, 64]
  let expectedPower = [1, 2, 4, 4, 8, 8, 16, 32, 128]
  let expectedLog = [0, 1, 2, 2, 3, 3, 4, 5, 7]
  let computedPower = cases.map(x => nextPowerOf2(x))
  let computedLog = cases.map(x => log2ceil(x))

  if (computedPower.join('') !== expectedPower.join('')) {
    console.log(
      'wrong: \ncomputed: ',
      computedPower,
      'expected:',
      expectedPower
    )
  }
  if (computedLog.join('') !== expectedLog.join('')) {
    console.log('wrong: \ncomputed: ', computedLog, 'expected:', expectedLog)
  }

  class LevelAndLeaf {
    level: number
    leaf: number

    constructor(level: number, leaf: number) {
      this.level = level
      this.leaf = leaf
    }

    asBytes32() {
      let result = BigInt(this.level) << BigInt(192) // set level in the upper uint64
      return '0x' + (result + BigInt(this.leaf)).toString(16).padStart(64, '0') // set leaf in the lower uint64
    }

    static fromBytes32(encoded: string) {
      let level = BigNumber.from(encoded.substring(0, 18)).toNumber()
      let leaf = BigNumber.from('0x' + encoded.substring(18)).toNumber()
      return new LevelAndLeaf(level, leaf)
    }
  }

  const constructOutboxProof = async (
    l2Provider: Provider,
    item: bigint,
    leaf: number,
    root: bigint,
    size: number
  ) => {
    // CHRIS: TODO: should be >=?
    if (leaf > size) {
      throw 'Cannot prove: leaf ' + leaf + ' is newer than root ' + size
    }

    const balanced = size == nextPowerOf2(size) / 2
    const treeLevels = log2ceil(size) // # of levels in the tree
    const proofLevels = treeLevels - 1 // # of levels where a hash is needed (all but root)
    const walkLevels = balanced ? treeLevels - 1 : treeLevels // # of levels we need to consider when building walks

    console.log('Proving leaf #', leaf)

    console.log('Tree stats', balanced, treeLevels, proofLevels, walkLevels)

    // balanced
    //             011             111
    //     001     011     101     111
    // 000 001 010 011 100 101 110 111

    // round 1 = (place = 11, which = 01, sibling = 10)
    // round 2 = (place = 11, which = 10, sibling = 01)
    //
    // round 1 = (place = 00, which = 01, sibling = 01)
    // round 2 = (place = 01, which = 10, sibling = 11)

    // round 1 = (place = 001, which = 001, sibling = 000)
    // round 2 = (place = 001, which = 010, sibling = 011)
    // round 3 = (place = 011, which = 100, sibling = 111)

    // each level has items in positions separated by s=2^n, where n is the level ( starting at 0)
    // we find the sibling to our current position (xor)
    // then move up a level n = n + 1 (or s = s*2), and find the closest position (or)
    // now find the sibling on this new level (xor again)
    // we continue up the tree, and do nothing at the root

    // unbalanced
    //                     r
    //             011         a                        111
    //     001     011     101                          111
    // 000 001 010 011 100 101 110                      111

    // round 1 = (place = 001, which = 001, sibling = 000)
    // round 2 = (place = 001, which = 010, sibling = 011)
    // round 3 = (place = 011, which = 100, sibling = 111)

    // 011
    // 101
    // 110

    // find which nodes we'll want in our proof up to a partial
    let query = [] // the nodes we'll query for
    let nodes: LevelAndLeaf[] = [] // the nodes needed (might not be found from query)
    let which = 1 // which bit to flip & set
    let place = leaf // where we are in the tree
    for (let level = 0; level < walkLevels; level++) {
      let sibling = place ^ which
      console.log('sibling', place, which, sibling)

      let position = new LevelAndLeaf(level, sibling)

      if (sibling < size) {
        // is the sibling within our subtree?
        // the sibling must not be newer than the root
        // otherwise, we'll construct it in a later walk
        console.log('balanced add', level, sibling)
        query.push(position.asBytes32())
      }
      nodes.push(position)
      place = place | which // set the bit so that we approach from the right
      which = which << 1 // advance to the next bit // CHRIS: TODO: ( which = which * 2 )
    }

    // console.log('0x' + (query[0] as BigInt).toString(16).padStart(64, '0'))
    console.log('query', query)

    // find all the partials (we don't need any if the root is itself a partial)
    let partials = new Map()
    if (!balanced) {
      let power = 1 << proofLevels
      let total = 0
      for (let level = proofLevels; level >= 0; level--) {
        if ((power & size) > 0) {
          // The partials map to the binary representation of the tree size
          total += power // The actual leaf for a given partial is the sum of the powers of 2
          let leaf = total - 1 // preceding it. We subtract 1 since we count from 0

          let partial = new LevelAndLeaf(level, leaf)

          console.log('unblanced add', level, leaf)

          query.push(partial.asBytes32())
          // CHRIS: TODO: partials should be a mapping of string to val
          partials.set(partial, null)
        }
        power >>= 1
      }
    }

    // CHRIS: TODO: remove all any

    let logs: any[] = []
    if (query.length > 0) {
      // in one lookup, query the RPC for all the data we need to construct a proof

      let withdrawTopic =
        '0x5baaa87db386365b5c161be377bc3d8e317e8d98d71a3ca7ed7d555340c8f767'
      let merkleTopic =
        '0xe9e13da364699fb5b0496ff5a0fc70760ad5836e93ba96568a4e42b9914a8b95'
      let arbSys = '0x0000000000000000000000000000000000000064'

      let rpcQuery = {
        address: arbSys,
        fromBlock: 0,
        toBlock: 'latest',
        topics: [[withdrawTopic, merkleTopic], null, null, query],
      }
      logs = await l2Provider.getLogs(rpcQuery)
    }

    console.log('Querried for', query.length, 'positions')
    console.log('Found', logs.length, 'logs for proof', leaf, 'of', size)

    let known = new Map() // all values in the tree we know
    let partialsByLevel = new Map() // the partial, if one exists, a level has
    let minPartialPlace = null // the lowest-level partial

    for (const log of logs) {
      const [_, __, hash, position] = log.topics
      const place = LevelAndLeaf.fromBytes32(position)

      if (partials.get(place)) {
        throw (
          'Internal error: found a 2nd partial at the same level ' + place.level
        )
      }

      known.set(place.asBytes32(), hash)
      partials.set(place.asBytes32(), hash)
      partialsByLevel.set(place.level, hash)
      if (
        !minPartialPlace ||
        (minPartialPlace && place.level < minPartialPlace.level)
      ) {
        minPartialPlace = place
      }
    }

    if (!balanced) {
      // This tree isn't balanced, so we'll need to use the partials to recover the missing info.
      // To do this, we'll walk the boundry of what's known, computing hashes along the way.

      let zero =
        '0x0000000000000000000000000000000000000000000000000000000000000000'

      // CHRIS: TODO: nullability
      let step = minPartialPlace!
      step.leaf += 1 << step.level // we start on the min partial's zero-hash sibling
      known.set(step.asBytes32(), zero)

      while (step.level < treeLevels) {
        const curr = known.get(step.asBytes32())
        if (!curr) {
          throw "internal error: walk should know the current node's value"
        }

        let left = curr
        let right = curr

        let levelHasPartial = partialsByLevel.get(step.level) !== undefined
        if (levelHasPartial) {
          // A partial on the frontier can only appear on the left.
          // Moving leftward for a level l skips 2^l leaves.
          step.leaf -= 1 << step.level
          let partial = known.get(step.asBytes32())
          if (!partial) {
            throw 'internal error: walk should have a partial here'
          }
          left = partial
        } else {
          // Getting to the next partial means covering its mirror subtree, so we look right.
          // Moving rightward for a level l skips 2^l leaves.
          step.leaf += 1 << step.level
          known.set(step.asBytes32(), zero)
          right = zero
        }

        // move to the parent
        step.level += 1
        step.leaf |= 1 << (step.level - 1)
        //known[step] = crypto.Keccak256Hash(left.Bytes(), right.Bytes())
      }

      let finalKnown = known.get(step.asBytes32()).toString(16)
      let rootString = root.toString(16)
      if (finalKnown != rootString) {
        // a correct walk of the frontier should end with resolving the root
        throw (
          "internal error: walking up the tree didn't re-create the root " +
          finalKnown +
          ' vs ' +
          rootString
        )
      }
    }

    console.log('Complete proof of leaf', leaf)

    const orderedNodes = Array.from(nodes.values()).sort(n => n.level)

    console.log(orderedNodes.map(o => o.asBytes32()))

    let hashes: string[] = []
    for (let place of orderedNodes) {
      let hash = known.get(place.asBytes32())
      if (!hash) {
        throw (
          'internal error: missing data for the node at position ' +
          place.asBytes32()
        )
      }
      hashes.push(hash)
      console.log('node', place.asBytes32(), hash)
    }

    return hashes

    // test by recomputing the hash?

    // hash with each other? do i need to test that? would be nice?
  }

  it('run withdrawal', async () => {
    const { l2Signer, ethBridger, l2Network, l1Signer } = await testSetup()
    const arbSysInterface = new Interface([
      'event L2ToL1Transaction(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 indexInBatch, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
      'event SendMerkleUpdate(uint256 indexed reserved, bytes32 indexed hash, uint256 indexed position)',
    ])
    const bridgeInterface = new Interface([
      'event BridgeCallTriggered( address indexed outbox, address indexed to, uint256 value, bytes data)',
    ])

    await fundL1(l1Signer)

    await fundL2(l2Signer)
    // const ethToWithdraw = parseEther('0.00000002')
    // // let l2Tx: L2TransactionReceipt
    // for (let index = 0; index < 8; index++) {
    //   const withdrawEthRes = await ethBridger.withdraw({
    //     destinationAddress: await l1Signer.getAddress(),
    //     amount: ethToWithdraw,
    //     l2Signer: l2Signer,
    //   })
    //   const withdrawEthRec = await withdrawEthRes.wait()
    //   const l2WithdrawRec = new L2TransactionReceipt(withdrawEthRec)
    //   // l2Tx = l2WithdrawRec

    //   const events = l2WithdrawRec.getL2ToL1Events()
    //   console.log(
    //     'events',
    //     l2WithdrawRec.transactionHash,
    //     events.map(e => e.position.toHexString()),
    //     events.map(e => e.hash.toHexString())
    //   )
    // }

    const txHash = "0x27279eba4dc77da7cc85b734c1b43107a42c61bf775459458aee889c722c3a3b";
    const l2Tx = new L2TransactionReceipt(await l2Signer.provider!.getTransactionReceipt(txHash))

    const message = (
      await l2Tx!.getL2ToL1Messages(l1Signer, l2Signer.provider!)
    )[0]
    console.log('waiting for ready', new Date(Date.now()).toUTCString())
    await message.waitUntilReadyForExecute(5000)
    console.log('ready executing')
    console.log('bal before', (await l1Signer.getBalance()).toString())
    const tx = await message.execute()
    const withdrawRec = await tx.wait()
    console.log(withdrawRec)
    console.log('bal after', (await l1Signer.getBalance()).toString())
  })

  it('setup withdrawals', async () => {
    // withdrawals have been set up
    const { l2Signer, ethBridger, l2Network, l1Signer } = await testSetup()
    const arbSysInterface = new Interface([
      'event L2ToL1Transaction(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 indexInBatch, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
      'event SendMerkleUpdate(uint256 indexed reserved, bytes32 indexed hash, uint256 indexed position)',
    ])

    const bridgeInterface = new Interface([
      'event BridgeCallTriggered( address indexed outbox, address indexed to, uint256 value, bytes data)',
    ])

    const txHashy =
      '0x988ee78f268e32581b3eedb8e5074bac039011017e1e72d2c79bd58d134ac975'
    const receipt2 = await l1Signer.provider!.getTransactionReceipt(txHashy)
    const log = bridgeInterface.parseLog(receipt2.logs[1]).args
    console.log(log['value'].toString())

    return

    // await fundL1(l1Signer)

    // await fundL2(l2Signer)
    // const ethToWithdraw = parseEther('0.00000002')

    // for (let index = 0; index < 8; index++) {
    //   const withdrawEthRes = await ethBridger.withdraw({
    //     destinationAddress: await l1Signer.getAddress(),
    //     amount: ethToWithdraw,
    //     l2Signer: l2Signer,
    //   })
    //   const withdrawEthRec = await withdrawEthRes.wait()
    //   const l2WithdrawRec = new L2TransactionReceipt(withdrawEthRec)

    //   const events = l2WithdrawRec.getL2ToL1Events()
    //   console.log(
    //     'events',
    //     l2WithdrawRec.transactionHash,
    //     events.map(e => e.position.toHexString()),
    //     events.map(e => e.hash.toHexString())
    //   )
    // }
    // console.log("address", await l1Signer.getAddress(), await l2Signer.getAddress())
    // return

    const transactionHash =
      '0x825e6aa8c1fee50282d4384f735afa2d39558fd297d7bae961255e804eabcb6b'
    const transactionReceipt = new L2TransactionReceipt(
      await l2Signer.provider!.getTransactionReceipt(transactionHash)
    )
    const l2ToL1Event = transactionReceipt.getL2ToL1Events()[0]

    // the block will be in a transaction
    // const exitBlock = await l2Signer.provider!.getBlock(
    //   transactionReceipt.blockHash
    // )
    const block = await (l2Signer.provider! as JsonRpcProvider).send(
      'eth_getBlockByHash',
      [transactionReceipt.blockHash, false]
    )
    const sendRoot = block.sendRoot
    const sendCount = BigNumber.from(block.sendCount).toNumber()
    const outboxAddr = Object.keys(l2Network.ethBridge.outboxes)[0]

    const proof = await constructOutboxProof(
      l2Signer.provider!,
      BigInt(0),
      l2ToL1Event.position.toNumber(),
      BigInt(0),
      sendCount
    )

    // CHRIS: TODO: is the l2Sender the tx origin or the actual sender?
    const outboxInterface = new Interface([
      'function executeTransaction(bytes32[] calldata proof,  uint256 index,  address l2Sender,  address to,  uint256 l2Block,  uint256 l1Block,  uint256 l2Timestamp,  uint256 value,  bytes calldata data)',
      'function calculateItemHash( address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes calldata data) public pure returns (bytes32)',
      'function calculateMerkleRoot( bytes32[] memory proof, uint256 path, bytes32 item) public pure returns (bytes32)',
    ])
    const contract = new Contract(outboxAddr, outboxInterface, l1Signer)

    const calculatedItemHash = await contract.callStatic['calculateItemHash'](
      l2ToL1Event.caller,
      l2ToL1Event.destination,
      l2ToL1Event.arbBlockNum,
      l2ToL1Event.ethBlockNum,
      l2ToL1Event.timestamp,
      l2ToL1Event.callvalue,
      l2ToL1Event.data
    )
    expect(calculatedItemHash, 'invalid hash').to.eq(
      l2ToL1Event.hash.toHexString()
    )

    console.log(
      'input',
      proof,
      l2ToL1Event.position.toHexString(),
      l2ToL1Event.hash.toHexString()
    )
    const calculatedMerkleRoot = await contract.callStatic[
      'calculateMerkleRoot'
    ](proof, l2ToL1Event.position, l2ToL1Event.hash.toHexString())
    console.log('merkle root', calculatedMerkleRoot, sendRoot)

    console.log('bal before', (await l1Signer.getBalance()).toString())
    const execute = await contract.functions['executeTransaction'](
      proof,
      l2ToL1Event.position,
      l2ToL1Event.caller,
      l2ToL1Event.destination,
      l2ToL1Event.arbBlockNum,
      l2ToL1Event.ethBlockNum,
      l2ToL1Event.timestamp,
      l2ToL1Event.callvalue,
      l2ToL1Event.data
    )
    console.log(execute)
    const receipt = await execute.wait()
    console.log(receipt)

    // 100000000000000000
    // 0x59682f07 (1500000007) * 0x02cd2c (183596)

    // 1500000007 * 183596
    //  99724605998714828
    //  99724606
    //  275394000000000

    console.log('bal after', (await l1Signer.getBalance()).toString())

    // send tx input 0x84A3d273Fc70b92ce28be0993366E12C621CeAAf 0x84A3d273Fc70b92ce28be0993366E12C621CeAAf  � bF�� 0x00000000000000000000000000000000000000000000000000000004a817c800  0x99a6a5c8d34a7b7a7650192a78b52be622a5132912e2fd93614adc65906cb1d7 [132 163 210 115 252 112 185 44 226 139 224 153 51 102 225 44 98 28 234 175] [132 163 210 115 252 112 185 44 226 139 224 153 51 102 225 44 98 28 234 175] [0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 25] [0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 26] [0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 98 70 248 204] [0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4 168 23 200 0] [] 0x99a6a5c8d34a7b7a7650192a78b52be622a5132912e2fd93614adc65906cb1d7

    // // uint256 l2Timestamp,  uint256 value,  bytes calldata data)
    // const execData = outboxInterface.encodeFunctionData('executeTransaction', [
    //   proof,
    //   l2ToL1Event.position,
    //   l2ToL1Event.caller,
    //   l2ToL1Event.destination,
    //   l2ToL1Event.arbBlockNum,
    //   l2ToL1Event.ethBlockNum,
    //   l2ToL1Event.timestamp,
    //   l2ToL1Event.callvalue,
    //   l2ToL1Event.data,
    // ])

    // const callRes = await l2Signer.provider!.call({
    //   to: outboxAddr,
    //   data: execData,
    // })

    // console.log('cal res', callRes)

    // const l2ToL1TransactionEvents = await l2Signer.provider!.getLogs({
    //   address: ARB_SYS_ADDRESS,
    //   fromBlock: 0,
    //   toBlock: 'latest',
    //   topics: [
    //     [
    //       arbSysInterface.getEventTopic('L2ToL1Transaction'),
    //     ],
    //   ],
    // })
    // console.log(l2ToL1TransactionEvents[l2ToL1TransactionEvents.length - 1]);

    // const curBlockNumber = await l2Signer.provider!.getBlockNumber()
    // // console.log(curBlockNumber);

    // for (let index = curBlockNumber; index >=curBlockNumber; index--) {
    //     // const block2 = await l2Signer.provider!.getBlock(index);
    //     const block = await (l2Signer.provider! as JsonRpcProvider).send("eth_getBlockByNumber", [
    //         "latest", // "0x" + BigInt(index).toString(16),
    //         false
    //     ])
    //     console.log(block)
    // }

    // const logs = await l2Signer.provider!.getLogs({
    //   address: ARB_SYS_ADDRESS,
    //   fromBlock: 0,
    //   toBlock: 'latest',
    //   topics: [
    //     [
    //       arbSysInterface.getEventTopic('L2ToL1Transaction'),
    //       arbSysInterface.getEventTopic('SendMerkleUpdate'),
    //     ],
    //   ],
    // })
    // logs
    //   .map(l => ({
    //     hash: l.topics[2],
    //     position: l.topics[3],
    //   }))
    //   .forEach(l => console.log(l.hash, l.position))

    // console.log(
    //   logs[0],
    //   logs[1],
    //   logs[2],
    //   logs[3],
    //   logs[4],
    //   logs[5],
    //   logs[6],
    //   logs[7],
    //   logs[8],
    //   logs[9],
    //   logs[10],
    //   logs[11],
    //   logs[12],
    //   logs[13]
    // )
  })

  it('proof', async () => {
    const { l2Signer } = await testSetup()
    await constructOutboxProof(l2Signer.provider!, BigInt(0), 5, BigInt(0), 8)
  })
})
