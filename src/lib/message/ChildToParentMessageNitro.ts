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

import { L2ToL1TxEvent as ChildToParentTxEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides } from 'ethers'
import { Mutex } from 'async-mutex'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { getBlockRangesForL1Block, isArbitrumChain, wait } from '../utils/lib'
import { getArbitrumNetwork } from '../dataEntities/networks'
import { NodeCreatedEvent, RollupUserLogic } from '../abi/RollupUserLogic'
import { ArbitrumProvider } from '../utils/arbProvider'
import { ArbBlock } from '../dataEntities/rpc'
import { JsonRpcProvider } from '@ethersproject/providers'
import { EventArgs } from '../dataEntities/event'
import { ChildToParentMessageStatus } from '../dataEntities/message'

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then ChildToParentMessageReaderOrWriter<T> will be of type ChildToParentMessageReader.
 * If T is of type Signer then ChildToParentMessageReaderOrWriter<T> will be of
 * type ChildToParentMessageWriter.
 */
export type ChildToParentMessageReaderOrWriterNitro<
  T extends SignerOrProvider
> = T extends Provider
  ? ChildToParentMessageReaderNitro
  : ChildToParentMessageWriterNitro

// expected number of parent chain blocks that it takes for a Child chain tx to be included in a parent chain assertion
const ASSERTION_CREATED_PADDING = 50
// expected number of parent chain blocks that it takes for a validator to confirm a parent chain block after the node deadline is passed
const ASSERTION_CONFIRMED_PADDING = 20

const childBlockRangeCache: { [key in string]: (number | undefined)[] } = {}
const mutex = new Mutex()

function getChildBlockRangeCacheKey({
  childChainId,
  parentBlockNumber,
}: {
  childChainId: number
  parentBlockNumber: number
}) {
  return `${childChainId}-${parentBlockNumber}`
}

function setChildBlockRangeCache(key: string, value: (number | undefined)[]) {
  childBlockRangeCache[key] = value
}

async function getBlockRangesForL1BlockWithCache({
  parentProvider,
  childProvider,
  forParentBlock,
}: {
  parentProvider: JsonRpcProvider
  childProvider: JsonRpcProvider
  forParentBlock: number
}) {
  const childChainId = (await childProvider.getNetwork()).chainId
  const key = getChildBlockRangeCacheKey({
    childChainId,
    parentBlockNumber: forParentBlock,
  })

  if (childBlockRangeCache[key]) {
    return childBlockRangeCache[key]
  }

  // implements a lock that only fetches cache once
  const release = await mutex.acquire()

  // if cache has been acquired while awaiting the lock
  if (childBlockRangeCache[key]) {
    release()
    return childBlockRangeCache[key]
  }

  try {
    const childBlockRange = await getBlockRangesForL1Block({
      forL1Block: forParentBlock,
      provider: parentProvider,
    })
    setChildBlockRangeCache(key, childBlockRange)
  } finally {
    release()
  }

  return childBlockRangeCache[key]
}

/**
 * Base functionality for nitro Child->Parent messages
 */
export class ChildToParentMessageNitro {
  protected constructor(
    public readonly event: EventArgs<ChildToParentTxEvent>
  ) {}

  /**
   * Instantiates a new `ChildToParentMessageWriterNitro` or `ChildToParentMessageReaderNitro` object.
   *
   * @param {SignerOrProvider} parentSignerOrProvider Signer or provider to be used for executing or reading the Child-to-Parent message.
   * @param {EventArgs<ChildToParentTxEvent>} event The event containing the data of the Child-to-Parent message.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `parentSignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: EventArgs<ChildToParentTxEvent>,
    parentProvider?: Provider
  ): ChildToParentMessageReaderOrWriterNitro<T>
  public static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: EventArgs<ChildToParentTxEvent>,
    parentProvider?: Provider
  ): ChildToParentMessageReaderNitro | ChildToParentMessageWriterNitro {
    return SignerProviderUtils.isSigner(parentSignerOrProvider)
      ? new ChildToParentMessageWriterNitro(
          parentSignerOrProvider,
          event,
          parentProvider
        )
      : new ChildToParentMessageReaderNitro(parentSignerOrProvider, event)
  }

  public static async getChildToParentEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: BigNumber,
    destination?: string,
    hash?: BigNumber
  ): Promise<
    (EventArgs<ChildToParentTxEvent> & { transactionHash: string })[]
  > {
    const eventFetcher = new EventFetcher(childProvider)
    return (
      await eventFetcher.getEvents(
        ArbSys__factory,
        t => t.filters.L2ToL1Tx(null, destination, hash, position),
        { ...filter, address: ARB_SYS_ADDRESS }
      )
    ).map(l => ({ ...l.event, transactionHash: l.transactionHash }))
  }
}

/**
 * Provides read-only access nitro for child-to-parent-messages
 */
export class ChildToParentMessageReaderNitro extends ChildToParentMessageNitro {
  protected sendRootHash?: string
  protected sendRootSize?: BigNumber
  protected sendRootConfirmed?: boolean
  protected outboxAddress?: string
  protected l1BatchNumber?: number

  constructor(
    protected readonly parentProvider: Provider,
    event: EventArgs<ChildToParentTxEvent>
  ) {
    super(event)
  }

  public async getOutboxProof(childProvider: Provider) {
    const { sendRootSize } = await this.getSendProps(childProvider)
    if (!sendRootSize)
      throw new ArbSdkError('Node not yet created, cannot get proof.')
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )

    const outboxProofParams =
      await nodeInterface.callStatic.constructOutboxProof(
        sendRootSize.toNumber(),
        this.event.position.toNumber()
      )

    return outboxProofParams.proof
  }

  /**
   * Check if this message has already been executed in the Outbox
   */
  protected async hasExecuted(childProvider: Provider): Promise<boolean> {
    const childChain = await getArbitrumNetwork(childProvider)
    const outbox = Outbox__factory.connect(
      childChain.ethBridge.outbox,
      this.parentProvider
    )

    return outbox.callStatic.isSpent(this.event.position)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(
    childProvider: Provider
  ): Promise<ChildToParentMessageStatus> {
    const { sendRootConfirmed } = await this.getSendProps(childProvider)
    if (!sendRootConfirmed) return ChildToParentMessageStatus.UNCONFIRMED
    return (await this.hasExecuted(childProvider))
      ? ChildToParentMessageStatus.EXECUTED
      : ChildToParentMessageStatus.CONFIRMED
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
    childProvider: JsonRpcProvider,
    log: FetchedEvent<NodeCreatedEvent> | undefined
  ) {
    const arbitrumProvider = new ArbitrumProvider(childProvider)

    if (!log) {
      console.warn('No NodeCreated events found, defaulting to block 0')
      return arbitrumProvider.getBlock(0)
    }

    const parsedLog = this.parseNodeCreatedAssertion(log)
    const childBlock = await arbitrumProvider.getBlock(
      parsedLog.afterState.blockHash
    )
    if (!childBlock) {
      throw new ArbSdkError(
        `Block not found. ${parsedLog.afterState.blockHash}`
      )
    }
    if (childBlock.sendRoot !== parsedLog.afterState.sendRoot) {
      throw new ArbSdkError(
        `Child chain block send root doesn't match parsed log. ${childBlock.sendRoot} ${parsedLog.afterState.sendRoot}`
      )
    }
    return childBlock
  }

  private async getBlockFromNodeNum(
    rollup: RollupUserLogic,
    nodeNum: BigNumber,
    childProvider: Provider
  ): Promise<ArbBlock> {
    const { createdAtBlock } = await rollup.getNode(nodeNum)

    let createdFromBlock = createdAtBlock
    let createdToBlock = createdAtBlock

    // If L1 is Arbitrum, then L2 is an Orbit chain.
    if (await isArbitrumChain(this.parentProvider)) {
      try {
        const nodeInterface = NodeInterface__factory.connect(
          NODE_INTERFACE_ADDRESS,
          this.parentProvider
        )

        const l2BlockRangeFromNode = await nodeInterface.l2BlockRangeForL1(
          createdAtBlock
        )

        createdFromBlock = l2BlockRangeFromNode.firstBlock
        createdToBlock = l2BlockRangeFromNode.lastBlock
      } catch {
        // defaults to binary search
        try {
          const l2BlockRange = await getBlockRangesForL1BlockWithCache({
            parentProvider: this.parentProvider as JsonRpcProvider,
            childProvider: childProvider as JsonRpcProvider,
            forParentBlock: createdAtBlock.toNumber(),
          })
          const startBlock = l2BlockRange[0]
          const endBlock = l2BlockRange[1]
          if (!startBlock || !endBlock) {
            throw new Error()
          }
          createdFromBlock = BigNumber.from(startBlock)
          createdToBlock = BigNumber.from(endBlock)
        } catch {
          // fallback to the original method
          createdFromBlock = createdAtBlock
          createdToBlock = createdAtBlock
        }
      }
    }

    // now get the block hash and sendroot for that node
    const eventFetcher = new EventFetcher(rollup.provider)
    const logs = await eventFetcher.getEvents(
      RollupUserLogic__factory,
      t => t.filters.NodeCreated(nodeNum),
      {
        fromBlock: createdFromBlock.toNumber(),
        toBlock: createdToBlock.toNumber(),
        address: rollup.address,
      }
    )

    if (logs.length > 1)
      throw new ArbSdkError(
        `Unexpected number of NodeCreated events. Expected 0 or 1, got ${logs.length}.`
      )

    return await this.getBlockFromNodeLog(
      childProvider as JsonRpcProvider,
      logs[0]
    )
  }

  protected async getBatchNumber(childProvider: Provider) {
    if (this.l1BatchNumber == undefined) {
      // findBatchContainingBlock errors if block number does not exist
      try {
        const nodeInterface = NodeInterface__factory.connect(
          NODE_INTERFACE_ADDRESS,
          childProvider
        )
        const res = await nodeInterface.findBatchContainingBlock(
          this.event.arbBlockNum
        )
        this.l1BatchNumber = res.toNumber()
      } catch (err) {
        // do nothing - errors are expected here
      }
    }

    return this.l1BatchNumber
  }

  protected async getSendProps(childProvider: Provider) {
    if (!this.sendRootConfirmed) {
      const childChain = await getArbitrumNetwork(childProvider)

      const rollup = RollupUserLogic__factory.connect(
        childChain.ethBridge.rollup,
        this.parentProvider
      )

      const latestConfirmedNodeNum = await rollup.callStatic.latestConfirmed()
      const childBlockConfirmed = await this.getBlockFromNodeNum(
        rollup,
        latestConfirmedNodeNum,
        childProvider
      )

      const sendRootSizeConfirmed = BigNumber.from(
        childBlockConfirmed.sendCount
      )
      if (sendRootSizeConfirmed.gt(this.event.position)) {
        this.sendRootSize = sendRootSizeConfirmed
        this.sendRootHash = childBlockConfirmed.sendRoot
        this.sendRootConfirmed = true
      } else {
        // if the node has yet to be confirmed we'll still try to find proof info from unconfirmed nodes
        const latestNodeNum = await rollup.callStatic.latestNodeCreated()
        if (latestNodeNum.gt(latestConfirmedNodeNum)) {
          // In rare case latestNodeNum can be equal to latestConfirmedNodeNum
          // eg immediately after an upgrade, or at genesis, or on a chain where confirmation time = 0 like AnyTrust may have
          const childBlock = await this.getBlockFromNodeNum(
            rollup,
            latestNodeNum,
            childProvider
          )

          const sendRootSize = BigNumber.from(childBlock.sendCount)
          if (sendRootSize.gt(this.event.position)) {
            this.sendRootSize = sendRootSize
            this.sendRootHash = childBlock.sendRoot
          }
        }
      }
    }
    return {
      sendRootSize: this.sendRootSize,
      sendRootHash: this.sendRootHash,
      sendRootConfirmed: this.sendRootConfirmed,
    }
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns outbox entry status (either executed or confirmed but not pending)
   */
  public async waitUntilReadyToExecute(
    childProvider: Provider,
    retryDelay = 500
  ): Promise<
    ChildToParentMessageStatus.EXECUTED | ChildToParentMessageStatus.CONFIRMED
  > {
    const status = await this.status(childProvider)
    if (
      status === ChildToParentMessageStatus.CONFIRMED ||
      status === ChildToParentMessageStatus.EXECUTED
    ) {
      return status
    } else {
      await wait(retryDelay)
      return await this.waitUntilReadyToExecute(childProvider, retryDelay)
    }
  }

  /**
   * Estimates the parent chain block number in which this child chain to parent chain tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param childProvider
   * @returns expected parent chain block number where the child chain to parent chain message will be executable. Returns null if the message can be or already has been executed
   */
  public async getFirstExecutableBlock(
    childProvider: Provider
  ): Promise<BigNumber | null> {
    const childChain = await getArbitrumNetwork(childProvider)

    const rollup = RollupUserLogic__factory.connect(
      childChain.ethBridge.rollup,
      this.parentProvider
    )

    const status = await this.status(childProvider)
    if (status === ChildToParentMessageStatus.EXECUTED) return null
    if (status === ChildToParentMessageStatus.CONFIRMED) return null

    // consistency check in case we change the enum in the future
    if (status !== ChildToParentMessageStatus.UNCONFIRMED)
      throw new ArbSdkError('ChildToParentMsg expected to be unconfirmed')

    const latestBlock = await this.parentProvider.getBlockNumber()
    const eventFetcher = new EventFetcher(this.parentProvider)
    const logs = (
      await eventFetcher.getEvents(
        RollupUserLogic__factory,
        t => t.filters.NodeCreated(),
        {
          fromBlock: Math.max(
            latestBlock -
              BigNumber.from(childChain.confirmPeriodBlocks)
                .add(ASSERTION_CONFIRMED_PADDING)
                .toNumber(),
            0
          ),
          toBlock: 'latest',
          address: rollup.address,
        }
      )
    ).sort((a, b) => a.event.nodeNum.toNumber() - b.event.nodeNum.toNumber())

    const lastChildBlock =
      logs.length === 0
        ? undefined
        : await this.getBlockFromNodeLog(
            childProvider as JsonRpcProvider,
            logs[logs.length - 1]
          )
    const lastSendCount = lastChildBlock
      ? BigNumber.from(lastChildBlock.sendCount)
      : BigNumber.from(0)

    // here we assume the Child to Parent tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending node that includes this message yet
    if (lastSendCount.lte(this.event.position))
      return BigNumber.from(childChain.confirmPeriodBlocks)
        .add(ASSERTION_CREATED_PADDING)
        .add(ASSERTION_CONFIRMED_PADDING)
        .add(latestBlock)

    // use binary search to find the first node with sendCount > this.event.position
    // default to the last node since we already checked above
    let foundLog: FetchedEvent<NodeCreatedEvent> = logs[logs.length - 1]
    let left = 0
    let right = logs.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const log = logs[mid]
      const childBlock = await this.getBlockFromNodeLog(
        childProvider as JsonRpcProvider,
        log
      )
      const sendCount = BigNumber.from(childBlock.sendCount)
      if (sendCount.gt(this.event.position)) {
        foundLog = log
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    const earliestNodeWithExit = foundLog.event.nodeNum
    const node = await rollup.getNode(earliestNodeWithExit)
    return node.deadlineBlock.add(ASSERTION_CONFIRMED_PADDING)
  }
}

/**
 * Provides read and write access for nitro child-to-Parent-messages
 */
export class ChildToParentMessageWriterNitro extends ChildToParentMessageReaderNitro {
  /**
   * Instantiates a new `ChildToParentMessageWriterNitro` object.
   *
   * @param {Signer} parentSigner The signer to be used for executing the Child-to-Parent message.
   * @param {EventArgs<ChildToParentTxEvent>} event The event containing the data of the Child-to-Parent message.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `parentSigner` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    private readonly parentSigner: Signer,
    event: EventArgs<ChildToParentTxEvent>,
    parentProvider?: Provider
  ) {
    super(parentProvider ?? parentSigner.provider!, event)
  }

  /**
   * Executes the ChildToParentMessage on Parent Chain.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(
    childProvider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    const status = await this.status(childProvider)
    if (status !== ChildToParentMessageStatus.CONFIRMED) {
      throw new ArbSdkError(
        `Cannot execute message. Status is: ${status} but must be ${ChildToParentMessageStatus.CONFIRMED}.`
      )
    }
    const proof = await this.getOutboxProof(childProvider)
    const childChain = await getArbitrumNetwork(childProvider)
    const outbox = Outbox__factory.connect(
      childChain.ethBridge.outbox,
      this.parentSigner
    )

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
