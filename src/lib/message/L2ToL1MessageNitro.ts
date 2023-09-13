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
import { RollupUserLogic__factory as BoldRollupUserLogic__factory } from '../boldAbi/factories/RollupUserLogic__factory'
import { Outbox__factory } from '../abi/factories/Outbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

import { L2ToL1TxEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides } from 'ethers'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { getBlockRangesForL1Block, isArbitrumChain, wait } from '../utils/lib'
import { L2Network, getL2Network } from '../dataEntities/networks'
import { NodeCreatedEvent, RollupUserLogic } from '../abi/RollupUserLogic'
import {
  AssertionCreatedEvent,
  AssertionCreatedEventObject,
  RollupUserLogic as BoldRollupUserLogic,
} from '../boldAbi/RollupUserLogic'
import { ArbitrumProvider } from '../utils/arbProvider'
import { ArbBlock } from '../dataEntities/rpc'
import { JsonRpcProvider } from '@ethersproject/providers'
import { EventArgs } from '../dataEntities/event'
import { L2ToL1MessageStatus } from '../dataEntities/message'
import { Bridge__factory } from '../abi/factories/Bridge__factory'

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then L2ToL1MessageReaderOrWriter<T> will be of type L2ToL1MessageReader.
 * If T is of type Signer then L2ToL1MessageReaderOrWriter<T> will be of
 * type L2ToL1MessageWriter.
 */
export type L2ToL1MessageReaderOrWriterNitro<T extends SignerOrProvider> =
  T extends Provider ? L2ToL1MessageReaderNitro : L2ToL1MessageWriterNitro

// expected number of L1 blocks that it takes for an L2 tx to be included in a L1 assertion
const ASSERTION_CREATED_PADDING = 50
// expected number of L1 blocks that it takes for a validator to confirm an L1 block after the assertion deadline is passed
const ASSERTION_CONFIRMED_PADDING = 20

/**
 * Base functionality for nitro L2->L1 messages
 */
export class L2ToL1MessageNitro {
  protected constructor(public readonly event: EventArgs<L2ToL1TxEvent>) {}

  /**
   * Instantiates a new `L2ToL1MessageWriterNitro` or `L2ToL1MessageReaderNitro` object.
   *
   * @param {SignerOrProvider} l1SignerOrProvider Signer or provider to be used for executing or reading the L2-to-L1 message.
   * @param {EventArgs<L2ToL1TxEvent>} event The event containing the data of the L2-to-L1 message.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1SignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: EventArgs<L2ToL1TxEvent>,
    l1Provider?: Provider
  ): L2ToL1MessageReaderOrWriterNitro<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: EventArgs<L2ToL1TxEvent>,
    l1Provider?: Provider
  ): L2ToL1MessageReaderNitro | L2ToL1MessageWriterNitro {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriterNitro(l1SignerOrProvider, event, l1Provider)
      : new L2ToL1MessageReaderNitro(l1SignerOrProvider, event)
  }

  public static async getL2ToL1Events(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: BigNumber,
    destination?: string,
    hash?: BigNumber
  ): Promise<(EventArgs<L2ToL1TxEvent> & { transactionHash: string })[]> {
    const eventFetcher = new EventFetcher(l2Provider)
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
 * Provides read-only access nitro for l2-to-l1-messages
 */
export class L2ToL1MessageReaderNitro extends L2ToL1MessageNitro {
  protected sendRootHash?: string
  protected sendRootSize?: BigNumber
  protected sendRootConfirmed?: boolean
  protected outboxAddress?: string
  protected l1BatchNumber?: number

  constructor(
    protected readonly l1Provider: Provider,
    event: EventArgs<L2ToL1TxEvent>
  ) {
    super(event)
  }

  public async getOutboxProof(l2Provider: Provider) {
    const { sendRootSize } = await this.getSendProps(l2Provider)
    if (!sendRootSize)
      throw new ArbSdkError('Assertion not yet created, cannot get proof.')
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
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
  protected async hasExecuted(l2Provider: Provider): Promise<boolean> {
    const l2Network = await getL2Network(l2Provider)
    const outbox = Outbox__factory.connect(
      l2Network.ethBridge.outbox,
      this.l1Provider
    )

    return outbox.callStatic.isSpent(this.event.position)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    const { sendRootConfirmed } = await this.getSendProps(l2Provider)
    if (!sendRootConfirmed) return L2ToL1MessageStatus.UNCONFIRMED
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

  private parseAssertionCreatedEvent(e: FetchedEvent<AssertionCreatedEvent>) {
    return {
      afterState: {
        blockHash: (e.event as AssertionCreatedEventObject).assertion.afterState
          .globalState.bytes32Vals[0],
        sendRoot: (e.event as AssertionCreatedEventObject).assertion.afterState
          .globalState.bytes32Vals[1],
      },
    }
  }

  private isAssertionCreatedLog(
    log: FetchedEvent<NodeCreatedEvent> | FetchedEvent<AssertionCreatedEvent>
  ): log is FetchedEvent<AssertionCreatedEvent> {
    return (
      (log.event as AssertionCreatedEventObject).challengeManager != undefined
    )
  }

  private async getBlockFromAssertionLog(
    l2Provider: JsonRpcProvider,
    log: FetchedEvent<NodeCreatedEvent> | FetchedEvent<AssertionCreatedEvent>
  ) {
    const parsedLog = this.isAssertionCreatedLog(log)
      ? this.parseAssertionCreatedEvent(log)
      : this.parseNodeCreatedAssertion(log)

    const arbitrumProvider = new ArbitrumProvider(l2Provider)
    const l2Block = await arbitrumProvider.getBlock(
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

  private isBoldRollupUserLogic(
    rollup: RollupUserLogic | BoldRollupUserLogic
  ): rollup is BoldRollupUserLogic {
    return (rollup as BoldRollupUserLogic).getAssertion !== undefined
  }

  private async getBlockFromAssertionId(
    rollup: RollupUserLogic | BoldRollupUserLogic,
    assertionId: BigNumber | string,
    l2Provider: Provider
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
    if (await isArbitrumChain(this.l1Provider)) {
      try {
        const l2BlockRange = await getBlockRangesForL1Block({
          forL1Block: createdAtBlock.toNumber(),
          provider: this.l1Provider as JsonRpcProvider,
        })
        const startBlock = l2BlockRange[0]
        const endBlock = l2BlockRange[1]
        if (!startBlock || !endBlock) {
          throw new Error()
        }
        createdFromBlock = BigNumber.from(startBlock)
        createdToBlock = BigNumber.from(endBlock)
      } catch (e) {
        // fallback to old method if the new method fails
        createdFromBlock = createdAtBlock
        createdToBlock = createdAtBlock
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

    if (logs.length !== 1)
      throw new ArbSdkError('No AssertionCreated events found')
    return await this.getBlockFromAssertionLog(
      l2Provider as JsonRpcProvider,
      logs[0]
    )
  }

  protected async getBatchNumber(l2Provider: Provider) {
    if (this.l1BatchNumber == undefined) {
      // findBatchContainingBlock errors if block number does not exist
      try {
        const nodeInterface = NodeInterface__factory.connect(
          NODE_INTERFACE_ADDRESS,
          l2Provider
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

  protected async getSendProps(l2Provider: Provider) {
    if (!this.sendRootConfirmed) {
      const l2Network = await getL2Network(l2Provider)
      const rollup = await this.getRollupAndUpdateNetwork(l2Network)

      const latestConfirmedAssertionId =
        await rollup.callStatic.latestConfirmed()
      const l2BlockConfirmed = await this.getBlockFromAssertionId(
        rollup,
        latestConfirmedAssertionId,
        l2Provider
      )

      const sendRootSizeConfirmed = BigNumber.from(l2BlockConfirmed.sendCount)
      if (sendRootSizeConfirmed.gt(this.event.position)) {
        this.sendRootSize = sendRootSizeConfirmed
        this.sendRootHash = l2BlockConfirmed.sendRoot
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
          latestCreatedAssertionId = (
            assertionCreatedEvents[assertionCreatedEvents.length - 1]
              .event as AssertionCreatedEventObject
          ).assertionHash
        } else {
          latestCreatedAssertionId = await rollup.callStatic.latestNodeCreated()
        }
        if (latestCreatedAssertionId === latestConfirmedAssertionId) {
          console.log(
            'latestCreatedAssertionId equals latestConfirmedAssertionId'
          )
        }

        const latestEquals =
          typeof latestCreatedAssertionId === 'string'
            ? latestCreatedAssertionId === latestConfirmedAssertionId
            : latestCreatedAssertionId.eq(latestConfirmedAssertionId)

        // if the node has yet to be confirmed we'll still try to find proof info from unconfirmed nodes
        if (!latestEquals) {
          // In rare case latestNodeNum can be equal to latestConfirmedNodeNum
          // eg immediately after an upgrade, or at genesis, or on a chain where confirmation time = 0 like AnyTrust may have
          const l2Block = await this.getBlockFromAssertionId(
            rollup,
            latestCreatedAssertionId,
            l2Provider
          )

          const sendRootSize = BigNumber.from(l2Block.sendCount)
          if (sendRootSize.gt(this.event.position)) {
            this.sendRootSize = sendRootSize
            this.sendRootHash = l2Block.sendRoot
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
   * Check whether the provided network has a BoLD rollup
   * @param l2Network
   * @param l1Provider
   * @returns
   */
  private async isBold(
    l2Network: L2Network,
    l1Provider: Provider
  ): Promise<string | undefined> {
    const bridge = Bridge__factory.connect(
      l2Network.ethBridge.bridge,
      l1Provider
    )
    const remoteRollupAddr = await bridge.rollup()

    const rollup = RollupUserLogic__factory.connect(
      remoteRollupAddr,
      l1Provider
    )
    try {
      // bold rollup does not have an extraChallengeTimeBlocks function
      await rollup.extraChallengeTimeBlocks()
      return undefined
    } catch (err) {
      return remoteRollupAddr
    }
  }

  /**
   * If the local network is not currently bold, checks if the remote network is bold
   * and if so updates the local network with a new rollup address
   * @param l2Network
   * @returns The rollup contract, bold or legacy
   */
  private async getRollupAndUpdateNetwork(l2Network: L2Network) {
    if (!l2Network.isBold) {
      const boldRollupAddr = await this.isBold(l2Network, this.l1Provider)
      if (boldRollupAddr) {
        l2Network.isBold = true
        l2Network.ethBridge.rollup = boldRollupAddr
      }
    }

    return l2Network.isBold
      ? BoldRollupUserLogic__factory.connect(
          l2Network.ethBridge.rollup,
          this.l1Provider
        )
      : RollupUserLogic__factory.connect(
          l2Network.ethBridge.rollup,
          this.l1Provider
        )
  }

  /**
   * Estimates the L1 block number in which this L2 to L1 tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param l2Provider
   * @returns expected L1 block number where the L2 to L1 message will be executable. Returns null if the message can be or already has been executed
   */
  public async getFirstExecutableBlock(
    l2Provider: Provider
  ): Promise<BigNumber | null> {
    const l2Network = await getL2Network(l2Provider)
    const rollup = await this.getRollupAndUpdateNetwork(l2Network)

    const status = await this.status(l2Provider)
    if (status === L2ToL1MessageStatus.EXECUTED) return null
    if (status === L2ToL1MessageStatus.CONFIRMED) return null

    // consistency check in case we change the enum in the future
    if (status !== L2ToL1MessageStatus.UNCONFIRMED)
      throw new ArbSdkError('L2ToL1Msg expected to be unconfirmed')

    const latestBlock = await this.l1Provider.getBlockNumber()
    const eventFetcher = new EventFetcher(this.l1Provider)
    let logs:
      | FetchedEvent<NodeCreatedEvent>[]
      | FetchedEvent<AssertionCreatedEvent>[]
    if (l2Network.isBold) {
      logs = (
        await eventFetcher.getEvents(
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
            address: rollup.address,
          }
        )
      ).sort((a, b) => a.event.nodeNum.toNumber() - b.event.nodeNum.toNumber())
    } else {
      logs = (
        await eventFetcher.getEvents(
          BoldRollupUserLogic__factory,
          t => t.filters.AssertionCreated(),
          {
            fromBlock: Math.max(
              latestBlock -
                BigNumber.from(l2Network.confirmPeriodBlocks)
                  .add(ASSERTION_CONFIRMED_PADDING)
                  .toNumber(),
              0
            ),
            toBlock: 'latest',
            address: rollup.address,
          }
        )
      ).sort((a, b) => a.blockNumber - b.blockNumber)
    }

    const lastL2Block =
      logs.length === 0
        ? undefined
        : await this.getBlockFromAssertionLog(
            l2Provider as JsonRpcProvider,
            logs[logs.length - 1]
          )
    const lastSendCount = lastL2Block
      ? BigNumber.from(lastL2Block.sendCount)
      : BigNumber.from(0)

    // here we assume the L2 to L1 tx is actually valid, so the user needs to wait the max time
    // since there isn't a pending asssertion that includes this message yet
    if (lastSendCount.lte(this.event.position))
      return BigNumber.from(l2Network.confirmPeriodBlocks)
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
      const l2Block = await this.getBlockFromAssertionLog(
        l2Provider as JsonRpcProvider,
        log
      )
      const sendCount = BigNumber.from(l2Block.sendCount)
      if (sendCount.gt(this.event.position)) {
        foundLog = log
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    if (l2Network.isBold) {
      const assertionHash = (foundLog.event as AssertionCreatedEventObject)
        .assertionHash
      const assertion = await (rollup as BoldRollupUserLogic).getAssertion(
        assertionHash
      )
      return assertion.createdAtBlock
        .add(l2Network.confirmPeriodBlocks)
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
 * Provides read and write access for nitro l2-to-l1-messages
 */
export class L2ToL1MessageWriterNitro extends L2ToL1MessageReaderNitro {
  /**
   * Instantiates a new `L2ToL1MessageWriterNitro` object.
   *
   * @param {Signer} l1Signer The signer to be used for executing the L2-to-L1 message.
   * @param {EventArgs<L2ToL1TxEvent>} event The event containing the data of the L2-to-L1 message.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1Signer` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    private readonly l1Signer: Signer,
    event: EventArgs<L2ToL1TxEvent>,
    l1Provider?: Provider
  ) {
    super(l1Provider ?? l1Signer.provider!, event)
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
    const l2Network = await getL2Network(l2Provider)
    const outbox = Outbox__factory.connect(
      l2Network.ethBridge.outbox,
      this.l1Signer
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
