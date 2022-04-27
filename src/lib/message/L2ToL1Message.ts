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
import { Contract, ContractTransaction, Overrides } from 'ethers'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { wait } from '../utils/lib'
import { getL2Network, getOutboxAddr } from '../dataEntities/networks'
import { NodeCreatedEvent, RollupUserLogic } from '../abi/RollupUserLogic'
import { L2TransactionReceipt } from './L2Transaction'
import { getArbBlockByHash } from '../utils/arbProvider'
import { ArbBlock } from '../dataEntities/rpc'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Interface } from 'ethers/lib/utils'

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
   * ArbSys.sendTxToL1 called, but assertion not yet confirmed
   */
  UNCONFIRMED = 1,
  /**
   * Assertion for outgoing message confirmed, but message not yet executed
   */
  CONFIRMED = 2,
  /**
   * Outgoing message executed (terminal state)
   */
  EXECUTED = 3,
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

/**
 * Base functionality for L2->L1 messages
 */
export class L2ToL1Message {
  protected constructor(
    public readonly event: L2ToL1TransactionEvent['args']
  ) {}

  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent['args']
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent['args']
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(l1SignerOrProvider, event)
      : new L2ToL1MessageReader(l1SignerOrProvider, event)
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
        throw new ArbSdkError('More than one indexed item found in batch.')
      } else return []
    } else return events
  }

  public static async getL2ToL1Events(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    batchNumber?: BigNumber,
    destination?: string,
    uniqueId?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<L2ToL1TransactionEvent['args'][]> {
    const eventFetcher = new EventFetcher(l2Provider)
    const events = await eventFetcher.getEvents(
      ARB_SYS_ADDRESS,
      ArbSys__factory,
      t =>
        t.filters.L2ToL1Transaction(null, destination, uniqueId, batchNumber),
      filter
    )

    const l2ToL1Events = await Promise.all(
      events.map(e =>
        l2Provider
          .getTransactionReceipt(e.transactionHash)
          .then(receipt => new L2TransactionReceipt(receipt).getL2ToL1Events())
      )
    ).then(res => res.flat())

    if (indexInBatch) {
      const indexItems = l2ToL1Events.filter(b =>
        b.indexInBatch.eq(indexInBatch)
      )
      if (indexItems.length === 1) {
        return indexItems
      } else if (indexItems.length > 1) {
        throw new ArbSdkError('More than one indexed item found in batch.')
      } else return []
    }

    return l2ToL1Events
  }
}

/**
 * Provides read-only access for l2-to-l1-messages
 */
export class L2ToL1MessageReader extends L2ToL1Message {
  protected sendRootHash?: string
  protected sendRootSize?: BigNumber
  protected outboxAddress?: string
  protected l1BatchNumber?: number

  constructor(
    protected readonly l1Provider: Provider,
    event: L2ToL1TransactionEvent['args']
  ) {
    super(event)
  }

  public async getOutboxProof(l2Provider: Provider) {
    const { sendRootSize } = await this.getSendProps(l2Provider)
    if (!sendRootSize)
      throw new ArbSdkError('Node not yet confirmed, cannot get proof.')

    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
    )

    const outboxProofParams =
      await nodeInterface.callStatic.constructOutboxProof(
        sendRootSize.toNumber(),
        this.event.position.toNumber()
      )

    // CHRIS: TODO: check these from the return vals to make sure they're expected ones
    // this.event.hash,
    //   this.sendRootHash,
    // console.log(outboxProofParams)

    return outboxProofParams.proof
  }

  /**
   * Check if this message has already been executed in the Outbox
   */
  protected async hasExecuted(l2Provider: Provider): Promise<boolean> {
    const outboxAddr = await this.getOutboxAddress(l2Provider)
    // if the outbox address cannot be found then the withdrawal
    // cannot have been executed
    if (!outboxAddr) return false

    const outbox = Outbox__factory.connect(outboxAddr, this.l1Provider)

    return outbox.callStatic.spent(this.event.position)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    const { sendRootHash } = await this.getSendProps(l2Provider)
    if (!sendRootHash) return L2ToL1MessageStatus.UNCONFIRMED
    return (await this.hasExecuted(l2Provider))
      ? L2ToL1MessageStatus.EXECUTED
      : L2ToL1MessageStatus.CONFIRMED
  }

  private parseNodeCreatedAssertion(event: FetchedEvent<NodeCreatedEvent>) {
    return {
      afterState: {
        blockHash: event.event.assertion.afterState.globalState.bytes32Vals[0],
        sendRoot: event.event.assertion.afterState.globalState.bytes32Vals[1],
      },
    }
  }

  private async getBlockFromNodeLog(
    l2Provider: JsonRpcProvider,
    log: FetchedEvent<NodeCreatedEvent>
  ) {
    const parsedLog = this.parseNodeCreatedAssertion(log)
    const l2Block = await getArbBlockByHash(
      l2Provider,
      parsedLog.afterState.blockHash
    )
    if (!l2Block) {
      throw new ArbSdkError(
        `Block not found. ${parsedLog.afterState.blockHash}`
      )
    }
    if (l2Block.sendRoot !== parsedLog.afterState.sendRoot) {
      throw new ArbSdkError(
        `L2 block send root doesn't match parsed log. ${l2Block.sendRoot} ${parsedLog.afterState.sendRoot}`
      )
    }
    return l2Block
  }

  private async getBlockFromNodeNum(
    rollup: RollupUserLogic,
    nodeNum: BigNumber,
    l2Provider: Provider
  ): Promise<ArbBlock> {
    const node = await rollup.getNode(nodeNum)

    // now get the block hash and sendroot for that node
    const eventFetcher = new EventFetcher(rollup.provider)
    const logs = await eventFetcher.getEvents(
      rollup.address,
      RollupUserLogic__factory,
      t => t.filters.NodeCreated(nodeNum),
      {
        fromBlock: node.createdAtBlock.toNumber(),
        toBlock: node.createdAtBlock.toNumber(),
      }
    )

    if (logs.length !== 1)
      throw new ArbSdkError('No NodeConfirmed events found')
    return await this.getBlockFromNodeLog(
      l2Provider as JsonRpcProvider,
      logs[0]
    )
  }

  protected async getBatchNumber(l2Provider: Provider) {
    if (this.l1BatchNumber == undefined) {
      // CHRIS: TODO: use correct abis
      // findBatchContainingBlock errors if block number does not exist
      try {
        const iface = new Interface([
          'function findBatchContainingBlock(uint64 block) external view returns (uint64 batch)',
          'function getL1Confirmations(bytes32 blockHash) external view returns (uint64 confirmations)',
        ])
        const nodeInterface = new Contract(
          NODE_INTERFACE_ADDRESS,
          iface,
          l2Provider
        )
        const res = (
          await nodeInterface.functions['findBatchContainingBlock'](
            this.event.arbBlockNum
          )
        )[0] as BigNumber
        this.l1BatchNumber = res.toNumber()
      } catch (err) {
        // do nothing - errors are expected here
      }
    }

    return this.l1BatchNumber
  }

  protected async getOutboxAddress(l2Provider: Provider) {
    if (!this.outboxAddress) {
      const batchNumber = await this.getBatchNumber(l2Provider)
      if (batchNumber != undefined) {
        const l2Network = await getL2Network(l2Provider)
        const outboxAddr = getOutboxAddr(l2Network, batchNumber)

        this.outboxAddress = outboxAddr
      }
    }

    return this.outboxAddress
  }

  protected async getSendProps(l2Provider: Provider) {
    if (!this.sendRootHash) {
      const l2Network = await getL2Network(l2Provider)

      const rollup = RollupUserLogic__factory.connect(
        l2Network.ethBridge.rollup,
        this.l1Provider
      )

      const latestConfirmedNodeNum = await rollup.callStatic.latestConfirmed()
      const l2Block = await this.getBlockFromNodeNum(
        rollup,
        latestConfirmedNodeNum,
        l2Provider
      )

      const sendRootSize = BigNumber.from(l2Block.sendCount)
      if (sendRootSize.gt(this.event.position)) {
        this.sendRootSize = sendRootSize
        this.sendRootHash = l2Block.sendRoot
      }
    }
    return {
      sendRootSize: this.sendRootSize,
      sendRootHash: this.sendRootHash,
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
   * Estimates the L1 block number in which this L2 to L1 tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param l2Provider
   * @returns expected L1 block number where the L2 to L1 message will be executable. Returns null if the message can or already has been executed
   */
  public async getFirstExecutableBlock(
    l2Provider: Provider
  ): Promise<BigNumber | null> {
    const l2Network = await getL2Network(l2Provider)

    const rollup = RollupUserLogic__factory.connect(
      l2Network.ethBridge.rollup,
      this.l1Provider
    )

    const status = await this.status(l2Provider)
    if (status === L2ToL1MessageStatus.EXECUTED) return null
    if (status === L2ToL1MessageStatus.CONFIRMED) return null

    // consistency check in case we change the enum in the future
    if (status !== L2ToL1MessageStatus.UNCONFIRMED)
      throw new ArbSdkError('L2ToL1Msg expected to be unconfirmed')

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

    // here we assume the L2 to L1 tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending node that includes this message yet
    if (logs.length === 0)
      return BigNumber.from(l2Network.confirmPeriodBlocks)
        .add(ASSERTION_CREATED_PADDING)
        .add(ASSERTION_CONFIRMED_PADDING)
        .add(latestBlock)

    let foundLog: FetchedEvent<NodeCreatedEvent> | undefined = undefined
    for (const log of logs) {
      const l2Block = await this.getBlockFromNodeLog(
        l2Provider as JsonRpcProvider,
        log
      )
      const sendCount = BigNumber.from(l2Block.sendCount)
      if (sendCount.gte(this.event.position)) {
        foundLog = log
        break
      }
    }

    // here we assume the L2 to L1 tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending node that includes this message yet
    if (!foundLog)
      return BigNumber.from(l2Network.confirmPeriodBlocks)
        .add(ASSERTION_CREATED_PADDING)
        .add(ASSERTION_CONFIRMED_PADDING)
        .add(latestBlock)

    const earliestNodeWithExit = foundLog.event.nodeNum
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
    event: L2ToL1TransactionEvent['args']
  ) {
    l1Signer.sendTransaction
    super(l1Signer.provider!, event)
  }

  /**
   * Executes the L2ToL1Message on L1.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(
    l2Provider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    const status = await this.status(l2Provider)
    if (status !== L2ToL1MessageStatus.CONFIRMED) {
      throw new ArbSdkError(
        `Cannot execute message. Status is: ${status} but must be ${L2ToL1MessageStatus.CONFIRMED}.`
      )
    }
    const proof = await this.getOutboxProof(l2Provider)
    const outboxAddr = await this.getOutboxAddress(l2Provider)
    if (!outboxAddr) {
      throw new ArbSdkError(
        `Outbox address not found but node is confirmed. ${this.event.hash.toHexString()}`
      )
    }
    const outbox = Outbox__factory.connect(outboxAddr, this.l1Signer)

    return await outbox.executeTransaction(
      proof,
      this.event.position,
      this.event.caller,
      this.event.destination,
      this.event.arbBlockNum,
      this.event.ethBlockNum,
      this.event.timestamp,
      this.event.callvalue,
      this.event.data,
      overrides || {}
    )
  }
}
