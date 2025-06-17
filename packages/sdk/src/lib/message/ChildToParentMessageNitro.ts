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
import { ErrorCode, Logger } from '@ethersproject/logger'

import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { RollupUserLogic__factory } from '../abi/factories/RollupUserLogic__factory'
import { BoldRollupUserLogic__factory } from '../abi-bold/factories/BoldRollupUserLogic__factory'
import { Outbox__factory } from '../abi/factories/Outbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

import { L2ToL1TxEvent as ChildToParentTxEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides, PopulatedTransaction } from 'ethers'
import { Mutex } from 'async-mutex'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { getBlockRangesForL1Block, isArbitrumChain, wait } from '../utils/lib'
import { ArbitrumNetwork, getArbitrumNetwork } from '../dataEntities/networks'
import { NodeCreatedEvent, RollupUserLogic } from '../abi/RollupUserLogic'
import {
  AssertionCreatedEvent,
  BoldRollupUserLogic,
} from '../abi-bold/BoldRollupUserLogic'
import { ArbitrumProvider } from '../utils/arbProvider'
import { ArbBlock } from '../dataEntities/rpc'
import { JsonRpcProvider } from '@ethersproject/providers'
import { EventArgs } from '../dataEntities/event'
import { ChildToParentMessageStatus } from '../dataEntities/message'
import { Bridge__factory } from '../abi/factories/Bridge__factory'

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
// expected number of parent blocks that it takes for a validator to confirm a parent block after the assertion deadline is passed
const ASSERTION_CONFIRMED_PADDING = 20

const childBlockRangeCache: { [key in string]: (number | undefined)[] } = {}
const mutex = new Mutex()

function getChildBlockRangeCacheKey({
  childChainId,
  l1BlockNumber,
}: {
  childChainId: number
  l1BlockNumber: number
}) {
  return `${childChainId}-${l1BlockNumber}`
}

function setChildBlockRangeCache(key: string, value: (number | undefined)[]) {
  childBlockRangeCache[key] = value
}

async function getBlockRangesForL1BlockWithCache({
  parentProvider,
  childProvider,
  forL1Block,
}: {
  parentProvider: JsonRpcProvider
  childProvider: JsonRpcProvider
  forL1Block: number
}) {
  const childChainId = (await childProvider.getNetwork()).chainId
  const key = getChildBlockRangeCacheKey({
    childChainId,
    l1BlockNumber: forL1Block,
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
      forL1Block,
      arbitrumProvider: parentProvider,
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
      throw new ArbSdkError('Assertion not yet created, cannot get proof.')
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

  private parseAssertionCreatedEvent(e: FetchedEvent<AssertionCreatedEvent>) {
    return {
      afterState: {
        blockHash: (e as FetchedEvent<AssertionCreatedEvent>).event.assertion
          .afterState.globalState.bytes32Vals[0],
        sendRoot: (e as FetchedEvent<AssertionCreatedEvent>).event.assertion
          .afterState.globalState.bytes32Vals[1],
      },
    }
  }

  private isAssertionCreatedLog(
    log: FetchedEvent<NodeCreatedEvent> | FetchedEvent<AssertionCreatedEvent>
  ): log is FetchedEvent<AssertionCreatedEvent> {
    return (
      (log as FetchedEvent<AssertionCreatedEvent>).event.challengeManager !=
      undefined
    )
  }

  private async getBlockFromAssertionLog(
    childProvider: JsonRpcProvider,
    log: FetchedEvent<NodeCreatedEvent> | FetchedEvent<AssertionCreatedEvent>
  ) {
    const arbitrumProvider = new ArbitrumProvider(childProvider)

    if (!log) {
      console.warn('No AssertionCreated events found, defaulting to block 0')
      return arbitrumProvider.getBlock(0)
    }

    const parsedLog = this.isAssertionCreatedLog(log)
      ? this.parseAssertionCreatedEvent(log)
      : this.parseNodeCreatedAssertion(log)

    // if the chain is freshly deployed and latest confirmed/created is the genesis assertion that contains a empty block hash
    if (
      parsedLog.afterState.blockHash ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return arbitrumProvider.getBlock(0)
    }

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

  private isBoldRollupUserLogic(
    rollup: RollupUserLogic | BoldRollupUserLogic
  ): rollup is BoldRollupUserLogic {
    return (rollup as BoldRollupUserLogic).getAssertion !== undefined
  }

  private async getBlockFromAssertionId(
    rollup: RollupUserLogic | BoldRollupUserLogic,
    assertionId: BigNumber | string,
    childProvider: Provider
  ): Promise<ArbBlock> {
    const createdAtBlock: BigNumber = this.isBoldRollupUserLogic(rollup)
      ? (
          await (rollup as BoldRollupUserLogic).getAssertion(
            assertionId as string
          )
        ).createdAtBlock
      : (await (rollup as RollupUserLogic).getNode(assertionId)).createdAtBlock
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
            forL1Block: createdAtBlock.toNumber(),
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

    const logs:
      | FetchedEvent<NodeCreatedEvent>[]
      | FetchedEvent<AssertionCreatedEvent>[] = this.isBoldRollupUserLogic(
      rollup
    )
      ? await eventFetcher.getEvents(
          BoldRollupUserLogic__factory,
          t => t.filters.AssertionCreated(assertionId as string),
          {
            fromBlock: createdFromBlock.toNumber(),
            toBlock: createdToBlock.toNumber(),
            address: rollup.address,
          }
        )
      : await eventFetcher.getEvents(
          RollupUserLogic__factory,
          t => t.filters.NodeCreated(assertionId),
          {
            fromBlock: createdFromBlock.toNumber(),
            toBlock: createdToBlock.toNumber(),
            address: rollup.address,
          }
        )

    if (logs.length > 1)
      throw new ArbSdkError(
        `Unexpected number of AssertionCreated events. Expected 0 or 1, got ${logs.length}.`
      )
    return await this.getBlockFromAssertionLog(
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
      const rollup = await this.getRollupAndUpdateNetwork(childChain)

      const latestConfirmedAssertionId =
        await rollup.callStatic.latestConfirmed()
      const childBlockConfirmed = await this.getBlockFromAssertionId(
        rollup,
        latestConfirmedAssertionId,
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
        let latestCreatedAssertionId: BigNumber | string
        if (this.isBoldRollupUserLogic(rollup)) {
          const latestConfirmed = await rollup.latestConfirmed()
          const latestConfirmedAssertion = await rollup.getAssertion(
            latestConfirmed
          )
          const eventFetcher = new EventFetcher(rollup.provider)

          const assertionCreatedEvents = await eventFetcher.getEvents(
            BoldRollupUserLogic__factory,
            t => t.filters.AssertionCreated(),
            {
              fromBlock: latestConfirmedAssertion.createdAtBlock.toNumber(),
              toBlock: 'latest',
              address: rollup.address,
            }
          )
          if (assertionCreatedEvents.length !== 0) {
            latestCreatedAssertionId =
              assertionCreatedEvents[assertionCreatedEvents.length - 1].event
                .assertionHash
          } else {
            latestCreatedAssertionId = latestConfirmedAssertionId
          }
        } else {
          latestCreatedAssertionId = await rollup.callStatic.latestNodeCreated()
        }

        const latestEquals =
          typeof latestCreatedAssertionId === 'string'
            ? latestCreatedAssertionId === latestConfirmedAssertionId
            : latestCreatedAssertionId.eq(latestConfirmedAssertionId)

        // if the node has yet to be confirmed we'll still try to find proof info from unconfirmed nodes
        if (!latestEquals) {
          // In rare case latestNodeNum can be equal to latestConfirmedNodeNum
          // eg immediately after an upgrade, or at genesis, or on a chain where confirmation time = 0 like AnyTrust may have
          const childBlock = await this.getBlockFromAssertionId(
            rollup,
            latestCreatedAssertionId,
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
   * Check whether the provided network has a BoLD rollup
   * @param arbitrumNetwork
   * @param parentProvider
   * @returns
   */
  private async isBold(
    arbitrumNetwork: ArbitrumNetwork,
    parentProvider: Provider
  ): Promise<string | undefined> {
    const bridge = Bridge__factory.connect(
      arbitrumNetwork.ethBridge.bridge,
      parentProvider
    )
    const remoteRollupAddr = await bridge.rollup()

    const rollup = RollupUserLogic__factory.connect(
      remoteRollupAddr,
      parentProvider
    )
    try {
      // bold rollup does not have an extraChallengeTimeBlocks function
      await rollup.callStatic.extraChallengeTimeBlocks()
      return undefined
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as { code: ErrorCode }).code ===
          Logger.errors.CALL_EXCEPTION
      ) {
        return remoteRollupAddr
      }
      throw err
    }
  }

  /**
   * If the local network is not currently bold, checks if the remote network is bold
   * and if so updates the local network with a new rollup address
   * @param arbitrumNetwork
   * @returns The rollup contract, bold or legacy
   */
  private async getRollupAndUpdateNetwork(arbitrumNetwork: ArbitrumNetwork) {
    if (!arbitrumNetwork.isBold) {
      const boldRollupAddr = await this.isBold(
        arbitrumNetwork,
        this.parentProvider
      )
      if (boldRollupAddr) {
        arbitrumNetwork.isBold = true
        arbitrumNetwork.ethBridge.rollup = boldRollupAddr
      }
    }

    return arbitrumNetwork.isBold
      ? BoldRollupUserLogic__factory.connect(
          arbitrumNetwork.ethBridge.rollup,
          this.parentProvider
        )
      : RollupUserLogic__factory.connect(
          arbitrumNetwork.ethBridge.rollup,
          this.parentProvider
        )
  }

  /**
   * Estimates the L1 block number in which this L2 to L1 tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param childProvider
   * @returns expected parent chain block number where the child chain to parent chain message will be executable. Returns null if the message can be or already has been executed
   */
  public async getFirstExecutableBlock(
    childProvider: Provider
  ): Promise<BigNumber | null> {
    const arbitrumNetwork = await getArbitrumNetwork(childProvider)
    const rollup = await this.getRollupAndUpdateNetwork(arbitrumNetwork)

    const status = await this.status(childProvider)
    if (status === ChildToParentMessageStatus.EXECUTED) return null
    if (status === ChildToParentMessageStatus.CONFIRMED) return null

    // consistency check in case we change the enum in the future
    if (status !== ChildToParentMessageStatus.UNCONFIRMED)
      throw new ArbSdkError('ChildToParentMsg expected to be unconfirmed')

    const latestBlock = await this.parentProvider.getBlockNumber()
    const eventFetcher = new EventFetcher(this.parentProvider)
    let logs:
      | FetchedEvent<NodeCreatedEvent>[]
      | FetchedEvent<AssertionCreatedEvent>[]
    if (arbitrumNetwork.isBold) {
      logs = (
        await eventFetcher.getEvents(
          BoldRollupUserLogic__factory,
          t => t.filters.AssertionCreated(),
          {
            fromBlock: Math.max(
              latestBlock -
                BigNumber.from(arbitrumNetwork.confirmPeriodBlocks)
                  .add(ASSERTION_CONFIRMED_PADDING)
                  .toNumber(),
              0
            ),
            toBlock: 'latest',
            address: rollup.address,
          }
        )
      ).sort((a, b) => a.blockNumber - b.blockNumber)
    } else {
      logs = (
        await eventFetcher.getEvents(
          RollupUserLogic__factory,
          t => t.filters.NodeCreated(),
          {
            fromBlock: Math.max(
              latestBlock -
                BigNumber.from(arbitrumNetwork.confirmPeriodBlocks)
                  .add(ASSERTION_CONFIRMED_PADDING)
                  .toNumber(),
              0
            ),
            toBlock: 'latest',
            address: rollup.address,
          }
        )
      ).sort((a, b) => a.event.nodeNum.toNumber() - b.event.nodeNum.toNumber())
    }

    const lastChildBlock =
      logs.length === 0
        ? undefined
        : await this.getBlockFromAssertionLog(
            childProvider as JsonRpcProvider,
            logs[logs.length - 1]
          )
    const lastSendCount = lastChildBlock
      ? BigNumber.from(lastChildBlock.sendCount)
      : BigNumber.from(0)

    // here we assume the child-to-parent tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending assertion that includes this message yet
    if (lastSendCount.lte(this.event.position))
      return BigNumber.from(arbitrumNetwork.confirmPeriodBlocks)
        .add(ASSERTION_CREATED_PADDING)
        .add(ASSERTION_CONFIRMED_PADDING)
        .add(latestBlock)

    // use binary search to find the first assertion with sendCount > this.event.position
    // default to the last assertion since we already checked above
    let foundLog = logs[logs.length - 1]
    let left = 0
    let right = logs.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const log = logs[mid]
      const childBlock = await this.getBlockFromAssertionLog(
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

    if (arbitrumNetwork.isBold) {
      const assertionHash = (foundLog as FetchedEvent<AssertionCreatedEvent>)
        .event.assertionHash
      const assertion = await (rollup as BoldRollupUserLogic).getAssertion(
        assertionHash
      )
      return assertion.createdAtBlock
        .add(arbitrumNetwork.confirmPeriodBlocks)
        .add(ASSERTION_CONFIRMED_PADDING)
    } else {
      const earliestNodeWithExit = (foundLog as FetchedEvent<NodeCreatedEvent>)
        .event.nodeNum
      const node = await (rollup as RollupUserLogic).getNode(
        earliestNodeWithExit
      )
      return node.deadlineBlock.add(ASSERTION_CONFIRMED_PADDING)
    }
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
   * Gets the execute transaction for the ChildToParentMessage on Parent Chain.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns The populated transaction that can be sent to execute the message
   */
  public async getExecuteTransaction(
    childProvider: Provider,
    overrides?: Overrides
  ): Promise<PopulatedTransaction> {
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

    return await outbox.populateTransaction.executeTransaction(
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
    const txRequest = await this.getExecuteTransaction(childProvider, overrides)
    return await this.parentSigner.sendTransaction(txRequest)
  }
}
