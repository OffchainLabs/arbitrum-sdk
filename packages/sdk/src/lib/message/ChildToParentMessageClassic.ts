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
import { Outbox__factory } from '../abi/classic/factories/Outbox__factory'
import { RollupUserLogic__factory } from '../abi/factories/RollupUserLogic__factory'

import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { L2ToL1TransactionEvent as ChildToParentTransactionEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides } from 'ethers'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import {
  getBlockRangesForL1Block,
  isArbitrumChain,
  isDefined,
  wait,
} from '../utils/lib'
import { ArbSdkError } from '../dataEntities/errors'
import { EventArgs } from '../dataEntities/event'
import {
  ChildToParentMessageStatus,
  WithdrawalTimeEstimate,
  WithdrawalTimeEstimateOptions,
} from '../dataEntities/message'
import { getArbitrumNetwork } from '../dataEntities/networks'
import {
  NodeConfirmedEvent,
  NodeCreatedEvent,
  RollupUserLogic,
} from '../abi/RollupUserLogic'
import { ArbitrumProvider } from '../utils/arbProvider'
import { JsonRpcProvider } from '@ethersproject/providers'

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

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then ChildToParentMessageReaderOrWriter<T> will be of type ChildToParentMessageReader.
 * If T is of type Signer then ChildToParentMessageReaderOrWriter<T> will be of
 * type ChildToParentMessageWriter.
 */
export type ChildToParentMessageReaderOrWriterClassic<
  T extends SignerOrProvider
> = T extends Provider
  ? ChildToParentMessageReaderClassic
  : ChildToParentMessageWriterClassic

const DEFAULT_ASSERTION_INTERVAL_SAMPLE_SIZE = 5
const DEFAULT_PARENT_BLOCK_TIME_SECONDS = 12
const DEFAULT_CLASSIC_ASSERTION_PADDING = 50

interface ClassicAssertionLike {
  nodeNum: BigNumber
  hash: string
  createdAtBlock: BigNumber
  deadlineBlock: BigNumber
  beforeBatch: BigNumber
  afterBatch: BigNumber
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? Math.floor((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle]
}

export class ChildToParentMessageClassic {
  /**
   * The number of the batch this message is part of
   */
  public readonly batchNumber: BigNumber

  /**
   * The index of this message in the batch
   */
  public readonly indexInBatch: BigNumber

  protected constructor(batchNumber: BigNumber, indexInBatch: BigNumber) {
    this.batchNumber = batchNumber
    this.indexInBatch = indexInBatch
  }

  /**
   * Instantiates a new `ChildToParentMessageWriterClassic` or `ChildToParentMessageReaderClassic` object.
   *
   * @param {SignerOrProvider} parentSignerOrProvider Signer or provider to be used for executing or reading the Child-to-Parent message.
   * @param {BigNumber} batchNumber The number of the batch containing the Child-to-Parent message.
   * @param {BigNumber} indexInBatch The index of the Child-to-Parent message within the batch.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `parentSignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromBatchNumber<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    parentProvider?: Provider
  ): ChildToParentMessageReaderOrWriterClassic<T>
  public static fromBatchNumber<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    parentProvider?: Provider
  ): ChildToParentMessageReaderClassic | ChildToParentMessageWriterClassic {
    return SignerProviderUtils.isSigner(parentSignerOrProvider)
      ? new ChildToParentMessageWriterClassic(
          parentSignerOrProvider,
          batchNumber,
          indexInBatch,
          parentProvider
        )
      : new ChildToParentMessageReaderClassic(
          parentSignerOrProvider,
          batchNumber,
          indexInBatch
        )
  }

  public static async getChildToParentEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    batchNumber?: BigNumber,
    destination?: string,
    uniqueId?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<
    (EventArgs<ChildToParentTransactionEvent> & {
      transactionHash: string
    })[]
  > {
    const eventFetcher = new EventFetcher(childProvider)
    const events = (
      await eventFetcher.getEvents(
        ArbSys__factory,
        t =>
          t.filters.L2ToL1Transaction(null, destination, uniqueId, batchNumber),
        { ...filter, address: ARB_SYS_ADDRESS }
      )
    ).map(l => ({ ...l.event, transactionHash: l.transactionHash }))

    if (indexInBatch) {
      const indexItems = events.filter(b => b.indexInBatch.eq(indexInBatch))
      if (indexItems.length === 1) {
        return indexItems
      } else if (indexItems.length > 1) {
        throw new ArbSdkError('More than one indexed item found in batch.')
      } else return []
    } else return events
  }
}

/**
 * Provides read-only access for classic Child-to-Parent-messages
 */
export class ChildToParentMessageReaderClassic extends ChildToParentMessageClassic {
  constructor(
    protected readonly parentProvider: Provider,
    batchNumber: BigNumber,
    indexInBatch: BigNumber
  ) {
    super(batchNumber, indexInBatch)
  }

  /**
   * Contains the classic outbox address, or set to zero address if this network
   * did not have a classic outbox deployed
   */
  protected outboxAddress: string | null = null

  /**
   * Classic had 2 outboxes, we need to find the correct one for the provided batch number
   * @param  childProvider
   * @param batchNumber
   * @returns
   */
  protected async getOutboxAddress(
    childProvider: Provider,
    batchNumber: number
  ) {
    if (!isDefined(this.outboxAddress)) {
      const childChain = await getArbitrumNetwork(childProvider)

      // find the outbox where the activation batch number of the next outbox
      // is greater than the supplied batch
      const outboxes = isDefined(childChain.ethBridge.classicOutboxes)
        ? Object.entries(childChain.ethBridge.classicOutboxes)
        : []

      const res = outboxes
        .sort((a, b) => {
          if (a[1] < b[1]) return -1
          else if (a[1] === b[1]) return 0
          else return 1
        })
        .find(
          (_, index, array) =>
            array[index + 1] === undefined || array[index + 1][1] > batchNumber
        )

      if (!res) {
        this.outboxAddress = '0x0000000000000000000000000000000000000000'
      } else {
        this.outboxAddress = res[0]
      }
    }
    return this.outboxAddress
  }

  private async outboxEntryExists(childProvider: Provider) {
    const outboxAddress = await this.getOutboxAddress(
      childProvider,
      this.batchNumber.toNumber()
    )

    const outbox = Outbox__factory.connect(outboxAddress, this.parentProvider)
    return await outbox.outboxEntryExists(this.batchNumber)
  }

  public static async tryGetProof(
    childProvider: Provider,
    batchNumber: BigNumber,
    indexInBatch: BigNumber
  ): Promise<MessageBatchProofInfo | null> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )
    try {
      return await nodeInterface.legacyLookupMessageBatchProof(
        batchNumber,
        indexInBatch
      )
    } catch (e) {
      const expectedError = "batch doesn't exist"
      const err = e as Error & { error: Error }
      const actualError =
        err && (err.message || (err.error && err.error.message))
      if (actualError.includes(expectedError)) return null
      else throw e
    }
  }

  private proof: MessageBatchProofInfo | null = null

  /**
   * Get the execution proof for this message. Returns null if the batch does not exist yet.
   * @param  childProvider
   * @returns
   */
  public async tryGetProof(
    childProvider: Provider
  ): Promise<MessageBatchProofInfo | null> {
    if (!isDefined(this.proof)) {
      this.proof = await ChildToParentMessageReaderClassic.tryGetProof(
        childProvider,
        this.batchNumber,
        this.indexInBatch
      )
    }
    return this.proof
  }

  /**
   * Check if given outbox message has already been executed
   */
  public async hasExecuted(childProvider: Provider): Promise<boolean> {
    const proofInfo = await this.tryGetProof(childProvider)
    if (!isDefined(proofInfo)) return false

    const outboxAddress = await this.getOutboxAddress(
      childProvider,
      this.batchNumber.toNumber()
    )

    const outbox = Outbox__factory.connect(outboxAddress, this.parentProvider)
    try {
      await outbox.callStatic.executeTransaction(
        this.batchNumber,
        proofInfo.proof,
        proofInfo.path,
        proofInfo.l2Sender,
        proofInfo.l1Dest,
        proofInfo.l2Block,
        proofInfo.l1Block,
        proofInfo.timestamp,
        proofInfo.amount,
        proofInfo.calldataForL1
      )
      return false
    } catch (err) {
      const e = err as Error
      if (e?.message?.toString().includes('ALREADY_SPENT')) return true
      if (e?.message?.toString().includes('NO_OUTBOX_ENTRY')) return false
      throw e
    }
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @param childProvider
   * @returns
   */
  public async status(
    childProvider: Provider
  ): Promise<ChildToParentMessageStatus> {
    try {
      const messageExecuted = await this.hasExecuted(childProvider)
      if (messageExecuted) {
        return ChildToParentMessageStatus.EXECUTED
      }

      const outboxEntryExists = await this.outboxEntryExists(childProvider)
      return outboxEntryExists
        ? ChildToParentMessageStatus.CONFIRMED
        : ChildToParentMessageStatus.UNCONFIRMED
    } catch (e) {
      return ChildToParentMessageStatus.UNCONFIRMED
    }
  }

  protected async getCurrentParentBlock(
    childProvider: Provider,
    options?: WithdrawalTimeEstimateOptions
  ): Promise<BigNumber> {
    if (options?.parentBlockNumber != undefined) {
      return BigNumber.from(options.parentBlockNumber)
    }

    if (await isArbitrumChain(this.parentProvider)) {
      const arbProvider = new ArbitrumProvider(
        this.parentProvider as JsonRpcProvider
      )
      const latestBlock = await arbProvider.getBlock('latest')
      return BigNumber.from(latestBlock.l1BlockNumber)
    }

    return BigNumber.from(
      await this.parentProvider.getBlockNumber()
    )
  }

  protected getParentBlockTimeSeconds(
    options?: WithdrawalTimeEstimateOptions
  ): number {
    return options?.parentBlockTimeSeconds ?? DEFAULT_PARENT_BLOCK_TIME_SECONDS
  }

  protected getAssertionIntervalSampleSize(
    options?: WithdrawalTimeEstimateOptions
  ): number {
    return Math.max(
      1,
      options?.assertionIntervalSampleSize ??
        DEFAULT_ASSERTION_INTERVAL_SAMPLE_SIZE
    )
  }

  protected async getQueryBlockRange(
    forParentBlock: BigNumber,
    toParentBlock?: BigNumber
  ): Promise<{ fromBlock: number; toBlock: BlockTag }> {
    if (!(await isArbitrumChain(this.parentProvider))) {
      return {
        fromBlock: forParentBlock.toNumber(),
        toBlock: toParentBlock?.toNumber() ?? 'latest',
      }
    }

    const startRange = await getBlockRangesForL1Block({
      arbitrumProvider: this.parentProvider as JsonRpcProvider,
      forL1Block: forParentBlock.toNumber(),
    })

    const startBlock = startRange[0] ?? 0

    if (!toParentBlock) {
      return {
        fromBlock: startBlock,
        toBlock: 'latest',
      }
    }

    const endRange = await getBlockRangesForL1Block({
      arbitrumProvider: this.parentProvider as JsonRpcProvider,
      forL1Block: toParentBlock.toNumber(),
    })

    const endBlock = endRange[1] ?? endRange[0] ?? 'latest'

    return {
      fromBlock: startBlock,
      toBlock: endBlock,
    }
  }

  protected async getRollup(childProvider: Provider): Promise<RollupUserLogic> {
    const childChain = await getArbitrumNetwork(childProvider)
    return RollupUserLogic__factory.connect(
      childChain.ethBridge.rollup,
      this.parentProvider
    )
  }

  protected getAssertionFromLog(
    log: FetchedEvent<NodeCreatedEvent>,
    confirmPeriodBlocks: BigNumber
  ): ClassicAssertionLike {
    return {
      nodeNum: log.event.nodeNum,
      hash: log.event.nodeHash,
      createdAtBlock: BigNumber.from(log.blockNumber),
      deadlineBlock: BigNumber.from(log.blockNumber).add(confirmPeriodBlocks),
      beforeBatch: log.event.assertion.beforeState.globalState.u64Vals[0],
      afterBatch: log.event.assertion.afterState.globalState.u64Vals[0],
    }
  }

  protected async getNodeCreatedLogById(
    rollup: RollupUserLogic,
    nodeNum: BigNumber
  ): Promise<FetchedEvent<NodeCreatedEvent>> {
    const node = await rollup.getNode(nodeNum)
    const eventFetcher = new EventFetcher(rollup.provider)
    const range = await this.getQueryBlockRange(node.createdAtBlock, node.createdAtBlock)
    const logs = await eventFetcher.getEvents(
      RollupUserLogic__factory,
      t => t.filters.NodeCreated(nodeNum),
      {
        ...range,
        address: rollup.address,
      }
    )

    if (logs.length !== 1) {
      throw new ArbSdkError(
        `Unexpected number of NodeCreated events for node ${nodeNum.toString()}.`
      )
    }

    return logs[0]
  }

  protected async getNodeCreatedLogs(
    rollup: RollupUserLogic,
    toParentBlock?: BigNumber
  ): Promise<FetchedEvent<NodeCreatedEvent>[]> {
    const eventFetcher = new EventFetcher(rollup.provider)
    const range = await this.getQueryBlockRange(BigNumber.from(0), toParentBlock)

    return (
      await eventFetcher.getEvents(
        RollupUserLogic__factory,
        t => t.filters.NodeCreated(),
        {
          ...range,
          address: rollup.address,
        }
      )
    ).sort((a, b) => a.event.nodeNum.toNumber() - b.event.nodeNum.toNumber())
  }

  protected async getLatestConfirmedNode(
    rollup: RollupUserLogic,
    confirmPeriodBlocks: BigNumber,
    currentParentBlock: BigNumber,
    useHistoricalBlock: boolean
  ): Promise<ClassicAssertionLike | undefined> {
    if (!useHistoricalBlock) {
      const latestConfirmedNodeNum = await rollup.latestConfirmed()
      const latestConfirmedLog = await this.getNodeCreatedLogById(
        rollup,
        latestConfirmedNodeNum
      )
      return this.getAssertionFromLog(latestConfirmedLog, confirmPeriodBlocks)
    }

    const eventFetcher = new EventFetcher(rollup.provider)
    const confirmedLogs = await eventFetcher.getEvents(
      RollupUserLogic__factory,
      t => t.filters.NodeConfirmed(),
      {
        ...(await this.getQueryBlockRange(BigNumber.from(0), currentParentBlock)),
        address: rollup.address,
      }
    )

    const latestConfirmedLog = confirmedLogs[confirmedLogs.length - 1]
    if (!latestConfirmedLog) return undefined

    const latestCreatedLog = await this.getNodeCreatedLogById(
      rollup,
      (latestConfirmedLog as FetchedEvent<NodeConfirmedEvent>).event.nodeNum
    )

    return this.getAssertionFromLog(latestCreatedLog, confirmPeriodBlocks)
  }

  protected async getCoveringNode(
    rollup: RollupUserLogic,
    confirmPeriodBlocks: BigNumber,
    currentParentBlock: BigNumber
  ): Promise<ClassicAssertionLike | undefined> {
    const nodeLogs = await this.getNodeCreatedLogs(rollup, currentParentBlock)

    return nodeLogs
      .map(log => this.getAssertionFromLog(log, confirmPeriodBlocks))
      .find(node => node.afterBatch.gte(this.batchNumber))
  }

  protected async getHistoricalNodeInfo(
    rollup: RollupUserLogic,
    currentParentBlock: BigNumber,
    sampleSize: number
  ): Promise<{ intervals: number[]; latestCreatedAtBlock?: number }> {
    const nodeLogs = await this.getNodeCreatedLogs(rollup, currentParentBlock)
    const recentLogs = nodeLogs.slice(-(sampleSize + 1))
    const intervals: number[] = []

    for (let i = 1; i < recentLogs.length; i++) {
      intervals.push(recentLogs[i].blockNumber - recentLogs[i - 1].blockNumber)
    }

    return {
      intervals,
      latestCreatedAtBlock: recentLogs[recentLogs.length - 1]?.blockNumber,
    }
  }

  public async getWithdrawalTimeEstimate(
    childProvider: Provider,
    options?: WithdrawalTimeEstimateOptions
  ): Promise<WithdrawalTimeEstimate> {
    const position = this.indexInBatch.toNumber()

    if (await this.hasExecuted(childProvider)) {
      return {
        phase: 'CLAIMED',
        isEstimate: false,
        position,
        withdrawalBatch: this.batchNumber.toNumber(),
      }
    }

    const currentParentBlock = await this.getCurrentParentBlock(
      childProvider,
      options
    )
    const rollup = await this.getRollup(childProvider)
    const confirmPeriodBlocks = await rollup.confirmPeriodBlocks()
    const useHistoricalBlock = options?.parentBlockNumber != undefined

    const [coveringNode, latestConfirmedNode] = await Promise.all([
      this.getCoveringNode(rollup, confirmPeriodBlocks, currentParentBlock),
      this.getLatestConfirmedNode(
        rollup,
        confirmPeriodBlocks,
        currentParentBlock,
        useHistoricalBlock
      ),
    ])

    if (!coveringNode) {
      const { intervals, latestCreatedAtBlock } = await this.getHistoricalNodeInfo(
        rollup,
        currentParentBlock,
        this.getAssertionIntervalSampleSize(options)
      )
      const medianInterval = median(intervals)
      const estimatedBlocksUntilNext =
        medianInterval == undefined || latestCreatedAtBlock == undefined
          ? DEFAULT_CLASSIC_ASSERTION_PADDING
          : Math.max(
              0,
              medianInterval -
                (currentParentBlock.toNumber() - latestCreatedAtBlock)
            )

      return {
        phase: 'BATCHED',
        estimatedRemainingSeconds:
          (estimatedBlocksUntilNext + confirmPeriodBlocks.toNumber()) *
          this.getParentBlockTimeSeconds(options),
        isEstimate: true,
        position,
        withdrawalBatch: this.batchNumber.toNumber(),
      }
    }

    const estimate: WithdrawalTimeEstimate = {
      phase: 'ASSERTION_PENDING',
      isEstimate: false,
      position,
      withdrawalBatch: this.batchNumber.toNumber(),
      coveringAssertionHash: coveringNode.hash,
      assertionCreatedAtBlock: coveringNode.createdAtBlock.toNumber(),
      assertionDeadlineBlock: coveringNode.deadlineBlock.toNumber(),
    }

    if (
      latestConfirmedNode &&
      latestConfirmedNode.afterBatch.gte(this.batchNumber)
    ) {
      return {
        ...estimate,
        phase: 'CLAIMABLE',
      }
    }

    const remainingBlocks = coveringNode.deadlineBlock.lte(currentParentBlock)
      ? BigNumber.from(0)
      : coveringNode.deadlineBlock.sub(currentParentBlock)

    return {
      ...estimate,
      remainingBlocks: remainingBlocks.toNumber(),
      remainingSeconds:
        remainingBlocks.toNumber() * this.getParentBlockTimeSeconds(options),
    }
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns outbox entry status (either executed or confirmed but not pending)
   */
  public async waitUntilOutboxEntryCreated(
    childProvider: Provider,
    retryDelay = 500
  ): Promise<
    ChildToParentMessageStatus.EXECUTED | ChildToParentMessageStatus.CONFIRMED
  > {
    const exists = await this.outboxEntryExists(childProvider)
    if (exists) {
      return (await this.hasExecuted(childProvider))
        ? ChildToParentMessageStatus.EXECUTED
        : ChildToParentMessageStatus.CONFIRMED
    } else {
      await wait(retryDelay)
      return await this.waitUntilOutboxEntryCreated(childProvider, retryDelay)
    }
  }

  /**
   * Estimates the Parent Chain block number in which this Child-to-Parent tx will be available for execution
   * @param  childProvider
   * @returns Always returns null for classic chainToParentChain messages since they can be executed in any block now.
   */
  public async getFirstExecutableBlock(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    childProvider: Provider
  ): Promise<BigNumber | null> {
    return null
  }
}

/**
 * Provides read and write access for classic Child-to-Parent-messages
 */
export class ChildToParentMessageWriterClassic extends ChildToParentMessageReaderClassic {
  /**
   * Instantiates a new `ChildToParentMessageWriterClassic` object.
   *
   * @param {Signer} parentSigner The signer to be used for executing the Child-to-Parent message.
   * @param {BigNumber} batchNumber The number of the batch containing the Child-to-Parent message.
   * @param {BigNumber} indexInBatch The index of the Child-to-Parent message within the batch.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `parentSigner` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    private readonly parentSigner: Signer,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    parentProvider?: Provider
  ) {
    super(parentProvider ?? parentSigner.provider!, batchNumber, indexInBatch)
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

    const proofInfo = await this.tryGetProof(childProvider)
    if (!isDefined(proofInfo)) {
      throw new ArbSdkError(
        `Unexpected missing proof: ${this.batchNumber.toString()} ${this.indexInBatch.toString()}}`
      )
    }
    const outboxAddress = await this.getOutboxAddress(
      childProvider,
      this.batchNumber.toNumber()
    )
    const outbox = Outbox__factory.connect(outboxAddress, this.parentSigner)
    // We can predict and print number of missing blocks
    // if not challenged
    return await outbox.functions.executeTransaction(
      this.batchNumber,
      proofInfo.proof,
      proofInfo.path,
      proofInfo.l2Sender,
      proofInfo.l1Dest,
      proofInfo.l2Block,
      proofInfo.l1Block,
      proofInfo.timestamp,
      proofInfo.amount,
      proofInfo.calldataForL1,
      overrides || {}
    )
  }
}
