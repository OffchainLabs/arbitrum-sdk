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

import {
  ARB_SYS_ADDRESS,
  NODE_INTERFACE_ADDRESS,
} from '../dataEntities/constants'
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { BigNumber } from '@ethersproject/bignumber'
import { BlockTag } from '@ethersproject/abstract-provider'

import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { RollupUserLogic__factory } from '../abi/factories/RollupUserLogic__factory'
import { Outbox__factory } from '../abi/factories/Outbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

import { L2ToL1TransactionEvent } from '../abi/ArbSys'
import { constants, ContractTransaction, ethers } from 'ethers'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ArbTsError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { wait } from '../utils/lib'
import { getL2Network } from '../dataEntities/networks'
import { NodeCreatedEvent } from '../abi/RollupUserLogic'

export interface MessageBatchProofInfo {
  /**
   * Merkle proof of message inclusion in outbox entry
   */
  proof: string[]

  /**
   * Merkle path to message
   */
  path: BigNumber

  /**
   * Sender of original message (i.e., caller of ArbSys.sendTxToL1)
   */
  l2Sender: string

  /**
   * Destination address for L1 contract call
   */
  l1Dest: string

  /**
   * L2 block number at which sendTxToL1 call was made
   */
  l2Block: BigNumber

  /**
   * L1 block number at which sendTxToL1 call was made
   */
  l1Block: BigNumber

  /**
   * L2 Timestamp at which sendTxToL1 call was made
   */
  timestamp: BigNumber

  /**
   * Value in L1 message in wei
   */
  amount: BigNumber

  /**
   * ABI-encoded L1 message data
   */
  calldataForL1: string
}

export enum L2ToL1MessageStatus {
  /**
   * No corresponding L2ToL1Event emitted
   */
  NOT_FOUND,
  /**
   * ArbSys.sendTxToL1 called, but assertion not yet confirmed
   */
  UNCONFIRMED,
  /**
   * Assertion for outgoing message confirmed, but message not yet executed
   */
  CONFIRMED,
  /**
   * Outgoing message executed (terminal state)
   */
  EXECUTED,
}

// CHRIS: TODO: delete later when we have the proper event
export type L2ToL1Event = {
  caller: string
  destination: string
  hash: BigNumber
  position: BigNumber
  indexInBatch: BigNumber
  arbBlockNum: BigNumber
  ethBlockNum: BigNumber
  timestamp: BigNumber
  callvalue: BigNumber
  data: string
}

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then L2ToL1MessageReaderOrWriter<T> will be of type L2ToL1MessageReader.
 * If T is of type Signer then L2ToL1MessageReaderOrWriter<T> will be of
 * type L2ToL1MessageWriter.
 */
export type L2ToL1MessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? L2ToL1MessageReader : L2ToL1MessageWriter

// expected number of L1 blocks that it takes for an L2 tx to be included in a L1 assertion
const ASSERTION_CREATED_PADDING = 50
// expected number of L1 blocks that it takes for a validator to confirm an L1 block after the node deadline is passed
const ASSERTION_CONFIRMED_PADDING = 20

const parseNodeCreatedAssertion = (event: FetchedEvent<NodeCreatedEvent>) => ({
  afterState: {
    blockHash: event.event.assertion.afterState.globalState.bytes32Vals[0],
    sendRoot: event.event.assertion.afterState.globalState.bytes32Vals[1],
  },
})

export class L2ToL1Message {
  // CHRIS: TODO: docs on these - update the constructor
  protected constructor(
    // CHRIS: TODO: update these params
    public readonly event: L2ToL1Event
  ) {}

  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    outboxAddress: string,
    event: L2ToL1Event
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    outboxAddress: string,
    event: L2ToL1Event
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(l1SignerOrProvider, outboxAddress, event)
      : new L2ToL1MessageReader(l1SignerOrProvider, outboxAddress, event)
  }

  public static async getL2ToL1MessageLogs(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    batchNumber?: BigNumber,
    destination?: string,
    uniqueId?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<L2ToL1TransactionEvent['args'][]> {
    const eventFetcher = new EventFetcher(l2Provider)
    const events = (
      await eventFetcher.getEvents(
        ARB_SYS_ADDRESS,
        ArbSys__factory,
        t =>
          t.filters.L2ToL1Transaction(null, destination, uniqueId, batchNumber),
        filter
      )
    ).map(l => l.event)

    if (indexInBatch) {
      const indexItems = events.filter(b => b.indexInBatch.eq(indexInBatch))
      if (indexItems.length === 1) {
        return indexItems
      } else if (indexItems.length > 1) {
        throw new ArbTsError('More than one indexed item found in batch.')
      } else return []
    } else return events
  }
}

/**
 * Provides read-only access for l2-to-l1-messages
 */
export class L2ToL1MessageReader extends L2ToL1Message {
  // CHRIS: TODO: shouldnt be public
  public sendRootHash?: string
  public sendRootSize?: BigNumber

  constructor(
    protected readonly l1Provider: Provider,
    protected readonly outboxAddress: string,
    event: L2ToL1Event
  ) {
    super(event)
  }

  public async getOutboxProof(l2Provider: Provider) {
    await this.updateSendRoot(this.l1Provider, l2Provider)
    // CHRIS: TODO: update to proper error message
    if (!this.sendRootSize)
      throw new ArbTsError('Node not confirmed, cannot get proof.')

    // CHRIS: TODO: proper ABI
    const nodeInterface = new ethers.Contract(
      NODE_INTERFACE_ADDRESS,
      [
        'function constructOutboxProof(uint64 size, uint64 leaf) external view returns (bytes32 sendAtLeaf, bytes32 rootAtSize, bytes32[] memory proof)',
      ],
      l2Provider
    )

    const outboxProofParams = await nodeInterface.callStatic[
      'constructOutboxProof'
    ](this.sendRootSize.toNumber(), this.event.position.toNumber())

    // CHRIS: TODO: check these from the return vals
    // this.event.hash,
    //   this.sendRootHash,
    // console.log(outboxProofParams)

    return outboxProofParams['proof'] as string[]
  }

  /**
   * Check if this message has already been executed in the Outbox
   */
  private async hasExecuted(): Promise<boolean> {
    const outbox = Outbox__factory.connect(this.outboxAddress, this.l1Provider)

    return outbox['spent'](this.event.position)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    // CHRIS: TODO: this is quite an ugly way to do this
    await this.updateSendRoot(this.l1Provider, l2Provider)
    if (!this.sendRootHash) return L2ToL1MessageStatus.UNCONFIRMED
    return (await this.hasExecuted())
      ? L2ToL1MessageStatus.EXECUTED
      : L2ToL1MessageStatus.CONFIRMED
  }

  // CHRIS: TODO: tidy up this function - it's also very inefficient
  private async updateSendRoot(l1Provider: Provider, l2Provider: Provider) {
    if (this.sendRootHash) return

    const l2Network = await getL2Network(l2Provider)

    const rollup = RollupUserLogic__factory.connect(
      l2Network.ethBridge.rollup,
      this.l1Provider
    )

    // CHRIS: TODO: could confirm in between these calls
    const latestConfirmedNodeNum = await rollup['latestConfirmed']()
    const latestConfirmedNode = await rollup.getNode(latestConfirmedNodeNum)

    // now get the block hash and sendroot for that node
    const eventFetcher = new EventFetcher(l1Provider)
    const logs = await eventFetcher.getEvents(
      rollup.address,
      RollupUserLogic__factory,
      t => t.filters.NodeCreated(latestConfirmedNodeNum),
      {
        fromBlock: latestConfirmedNode.createdAtBlock.toNumber(),
        toBlock: latestConfirmedNode.createdAtBlock.toNumber(),
      }
    )

    if (logs.length !== 1) throw new ArbTsError('No NodeConfirmed events found')

    const parsedLog = parseNodeCreatedAssertion(logs[0])

    const l2Block = await (
      l2Provider! as ethers.providers.JsonRpcProvider
    ).send('eth_getBlockByHash', [parsedLog.afterState.blockHash, false])
    if (l2Block['sendRoot'] !== parsedLog.afterState.sendRoot) {
      // CHRIS: TODO: handle this case
      console.log(l2Block['sendRoot'], parsedLog.afterState.sendRoot)
      throw new ArbTsError("L2 block send root doesn't match parsed log")
    }

    const sendRootSize = BigNumber.from(l2Block['sendCount'])
    if (sendRootSize.gt(this.event.position)) {
      this.sendRootSize = sendRootSize
      this.sendRootHash = parsedLog.afterState.sendRoot
    }
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns
   */
  public async waitUntilReadyToExecute(
    l2Provider: Provider,
    retryDelay = 500
  ): Promise<void> {
    const status = await this.status(l2Provider)
    if (
      status === L2ToL1MessageStatus.CONFIRMED ||
      status === L2ToL1MessageStatus.EXECUTED
    ) {
      return
    } else {
      await wait(retryDelay)
      await this.waitUntilReadyToExecute(l2Provider, retryDelay)
    }
  }

  /**
   * Estimates the L1 block number in which this L2 to L1 tx will be available for execution
   * @param l2Provider
   * @returns expected L1 block number where the L2 to L1 message will be executable. Returns null if already executed
   */
  public async getFirstExecutableBlock(
    l2Provider: Provider
  ): Promise<BigNumber | null> {
    // TODO: create version that queries multiple L2 to L1 txs, so a single multicall can make all requests
    // we assume the L2 to L1 tx is valid, but we could check that on the constructor that the L2 to L1 msg is valid
    const l2Network = await getL2Network(l2Provider)

    const rollup = RollupUserLogic__factory.connect(
      l2Network.ethBridge.rollup,
      this.l1Provider
    )

    const status = await this.status(l2Provider)
    if (status === L2ToL1MessageStatus.EXECUTED) return null
    if (status === L2ToL1MessageStatus.CONFIRMED) {
      const latestConfirmed = await rollup.callStatic.latestConfirmed()
      const node = await rollup.getNode(latestConfirmed)
      return node.deadlineBlock
    }
    if (status === L2ToL1MessageStatus.NOT_FOUND)
      throw new ArbTsError('L2ToL1Msg not found')

    // consistency check in case we change the enum in the future
    if (status !== L2ToL1MessageStatus.UNCONFIRMED)
      throw new ArbTsError('L2ToL1Msg expected to be unconfirmed')

    const latestBlock = await this.l1Provider.getBlockNumber()

    const eventFetcher = new EventFetcher(this.l1Provider)

    const logs = (
      await eventFetcher.getEvents(
        rollup.address,
        RollupUserLogic__factory,
        t => t.filters.NodeCreated(),
        {
          fromBlock: Math.max(
            latestBlock -
              BigNumber.from(l2Network.confirmPeriodBlocks)
                .add(ASSERTION_CONFIRMED_PADDING)
                .toNumber(),
            0
          ),
          toBlock: 'latest',
        }
      )
    ).sort((a, b) => a.event.nodeNum.toNumber() - b.event.nodeNum.toNumber())

    let found = false
    let logIndex = 0
    while (!found) {
      const log = logs[logIndex]
      const l2Block = await (
        l2Provider! as ethers.providers.JsonRpcProvider
      ).send('eth_getBlockByHash', [
        parseNodeCreatedAssertion(log).afterState.blockHash,
        false,
      ])

      const sendCount = BigNumber.from(l2Block['sendCount'])

      if (sendCount.gte(this.event.position)) {
        found = true
      } else {
        // TODO: optimise with a binary search
        logIndex++
      }
    }

    // here we assume the L2 to L1 tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending node that includes this message yet
    if (!found)
      return BigNumber.from(l2Network.confirmPeriodBlocks)
        .add(ASSERTION_CREATED_PADDING)
        .add(ASSERTION_CONFIRMED_PADDING)
        .add(latestBlock)

    const earliestNodeWithExit = logs[logIndex].event.nodeNum
    const node = await rollup.getNode(earliestNodeWithExit)
    return node.deadlineBlock.add(ASSERTION_CONFIRMED_PADDING)
  }
}

/**
 * Provides read and write access for l2-to-l1-messages
 */
export class L2ToL1MessageWriter extends L2ToL1MessageReader {
  constructor(
    private readonly l1Signer: Signer,
    outboxAddress: string,
    event: L2ToL1Event
  ) {
    super(l1Signer.provider!, outboxAddress, event)
  }

  /**
   * Executes the L2ToL1Message on L1.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(l2Provider: Provider): Promise<ContractTransaction> {
    const status = await this.status(l2Provider)
    if (status !== L2ToL1MessageStatus.CONFIRMED) {
      throw new ArbTsError(
        `Cannot execute message. Status is: ${status} but must be ${L2ToL1MessageStatus.CONFIRMED}.`
      )
    }
    const proof = await this.getOutboxProof(l2Provider)

    const outbox = Outbox__factory.connect(this.outboxAddress, this.l1Signer)

    // CHRIS: TODO: provide gas override options?
    return await outbox['executeTransaction'](
      proof,
      this.event.position,
      this.event.caller,
      this.event.destination,
      this.event.arbBlockNum,
      this.event.ethBlockNum,
      this.event.timestamp,
      this.event.callvalue,
      this.event.data
    )
  }
}
