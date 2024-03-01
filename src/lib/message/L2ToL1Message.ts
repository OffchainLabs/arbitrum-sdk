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

import { Provider } from 'ethers'
import { Signer } from 'ethers'

import { BlockTag } from 'ethers'

import { ContractTransaction, Overrides } from 'ethers'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import * as classic from './L2ToL1MessageClassic'
import * as nitro from './L2ToL1MessageNitro'
import { isDefined } from '../utils/lib'
import { EventArgs } from '../dataEntities/event'
import { L2ToL1MessageStatus as ChildToParentChainMessageStatus } from '../dataEntities/message'
import { getChildChain } from '../dataEntities/networks'
import { ArbSdkError } from '../dataEntities/errors'

export type ChildToParentTransactionEvent =
  | EventArgs<L2ToL1TransactionEvent>
  | EventArgs<L2ToL1TxEvent>

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then ChildToParentMessageReaderOrWriter<T> will be of type ChildToParentMessageReader.
 * If T is of type Signer then ChildToParentMessageReaderOrWriter<T> will be of
 * type ChildToParentMessageWriter.
 */
export type ChildToParentMessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? ChildToParentMessageReader : ChildToParentMessageWriter

/**
 * Base functionality for Chain->ParentChain messages
 */
export class ChildToParentMessage {
  protected isClassic(
    e: ChildToParentTransactionEvent
  ): e is EventArgs<L2ToL1TransactionEvent> {
    return isDefined((e as EventArgs<L2ToL1TransactionEvent>).indexInBatch)
  }

  /**
   * Instantiates a new `ChildToParentMessageWriter` or `ChildToParentMessageReader` object.
   *
   * @param {SignerOrProvider} ParentChainSignerOrProvider Signer or provider to be used for executing or reading the Chain-to-ParentChain message.
   * @param {ChildToParentTransactionEvent} event The event containing the data of the Chain-to-ParentChain message.
   * @param {Provider} [ParentChainProvider] Optional. Used to override the Provider which is attached to `ParentChainSignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    parentChainSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentChainProvider?: Provider
  ): ChildToParentMessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    parentChainSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentChainProvider?: Provider
  ): ChildToParentMessageReader | ChildToParentMessageWriter {
    return SignerProviderUtils.isSigner(parentChainSignerOrProvider)
      ? new ChildToParentMessageWriter(
          parentChainSignerOrProvider,
          event,
          parentChainProvider
        )
      : new ChildToParentMessageReader(parentChainSignerOrProvider, event)
  }

  /**
   * Get event logs for ChildToParent transactions.
   * @param childChainProvider
   * @param filter Block range filter
   * @param position The batchnumber indexed field was removed in nitro and a position indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same batchnumber.
   * For post nitro events it will be used to find events with the same position.
   * @param destination The ParentChain destination of the ChildToParent message
   * @param hash The uniqueId indexed field was removed in nitro and a hash indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same uniqueId.
   * For post nitro events it will be used to find events with the same hash.
   * @param indexInBatch The index in the batch, only valid for pre-nitro events. This parameter is ignored post-nitro
   * @returns Any classic and nitro events that match the provided filters.
   */
  public static async getChildToParentEvents(
    childChainProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: bigint,
    destination?: string,
    hash?: bigint,
    indexInBatch?: bigint
  ): Promise<(ChildToParentTransactionEvent & { transactionHash: string })[]> {
    const childChain = await getChildChain(childChainProvider)

    const inClassicRange = (blockTag: BlockTag, nitroGenBlock: number) => {
      if (typeof blockTag === 'string') {
        // taking classic of "earliest", "latest", "earliest" and the nitro gen block
        // yields 0, nitro gen, nitro gen since the classic range is always between 0 and nitro gen

        switch (blockTag) {
          case 'earliest':
            return 0
          case 'latest':
            return nitroGenBlock
          case 'pending':
            return nitroGenBlock
          default:
            throw new ArbSdkError(`Unrecognised block tag. ${blockTag}`)
        }
      }
      return Math.min(blockTag, nitroGenBlock)
    }

    const inNitroRange = (blockTag: BlockTag, nitroGenBlock: number) => {
      // taking nitro range of "earliest", "latest", "earliest" and the nitro gen block
      // yields nitro gen, latest, pending since the nitro range is always between nitro gen and latest/pending

      if (typeof blockTag === 'string') {
        switch (blockTag) {
          case 'earliest':
            return nitroGenBlock
          case 'latest':
            return 'latest'
          case 'pending':
            return 'pending'
          default:
            throw new ArbSdkError(`Unrecognised block tag. ${blockTag}`)
        }
      }

      return Math.max(blockTag, nitroGenBlock)
    }

    // only fetch nitro events after the genesis block
    const classicFilter = {
      fromBlock: inClassicRange(filter.fromBlock, childChain.nitroGenesisBlock),
      toBlock: inClassicRange(filter.toBlock, childChain.nitroGenesisBlock),
    }
    const logQueries = []
    if (classicFilter.fromBlock !== classicFilter.toBlock) {
      logQueries.push(
        classic.L2ToL1MessageClassic.getL2ToL1Events(
          childChainProvider,
          classicFilter,
          position,
          destination,
          hash,
          indexInBatch
        )
      )
    }

    const nitroFilter = {
      fromBlock: inNitroRange(filter.fromBlock, childChain.nitroGenesisBlock),
      toBlock: inNitroRange(filter.toBlock, childChain.nitroGenesisBlock),
    }
    if (nitroFilter.fromBlock !== nitroFilter.toBlock) {
      logQueries.push(
        nitro.ChildToParentChainMessageNitro.getChildToParentChainEvents(
          childChainProvider,
          nitroFilter,
          position,
          destination,
          hash
        )
      )
    }

    return (await Promise.all(logQueries)).flat(1)
  }
}

/**
 * Provides read-only access for Chain-to-ParentChain-messages
 */
export class ChildToParentMessageReader extends ChildToParentMessage {
  private readonly classicReader?: classic.L2ToL1MessageReaderClassic
  private readonly nitroReader?: nitro.ChildToParentChainMessageReaderNitro

  constructor(
    protected readonly parentChainProvider: Provider,
    event: ChildToParentTransactionEvent
  ) {
    super()
    if (this.isClassic(event)) {
      this.classicReader = new classic.L2ToL1MessageReaderClassic(
        parentChainProvider,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroReader = new nitro.ChildToParentChainMessageReaderNitro(
        parentChainProvider,
        event
      )
    }
  }

  public async getOutboxProof(
    childChainProvider: Provider
  ): Promise<classic.MessageBatchProofInfo | null | string[]> {
    if (this.nitroReader) {
      return await this.nitroReader.getOutboxProof(childChainProvider)
    } else return await this.classicReader!.tryGetProof(childChainProvider)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(
    childChainProvider: Provider
  ): Promise<ChildToParentChainMessageStatus> {
    // can we create an ChildToParentmessage here, we need to - the constructor is what we need
    if (this.nitroReader)
      return await this.nitroReader.status(childChainProvider)
    else return await this.classicReader!.status(childChainProvider)
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns outbox entry status (either executed or confirmed but not pending)
   */
  public async waitUntilReadyToExecute(
    childChainProvider: Provider,
    retryDelay = 500
  ): Promise<
    | ChildToParentChainMessageStatus.EXECUTED
    | ChildToParentChainMessageStatus.CONFIRMED
  > {
    if (this.nitroReader)
      return this.nitroReader.waitUntilReadyToExecute(
        childChainProvider,
        retryDelay
      )
    else
      return this.classicReader!.waitUntilOutboxEntryCreated(
        childChainProvider,
        retryDelay
      )
  }

  /**
   * Estimates the ParentChain block number in which this Chain to ParentChain tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param childChainProvider
   * @returns expected ParentChain block number where the Chain to ParentChain message will be executable. Returns null if the message can or already has been executed
   */
  public async getFirstExecutableBlock(
    childChainProvider: Provider
  ): Promise<BigInt | null> {
    if (this.nitroReader)
      return this.nitroReader.getFirstExecutableBlock(childChainProvider)
    else return this.classicReader!.getFirstExecutableBlock(childChainProvider)
  }
}

/**
 * Provides read and write access for Chain-to-ParentChain-messages
 */
export class ChildToParentMessageWriter extends ChildToParentMessageReader {
  private readonly classicWriter?: classic.L2ToL1MessageWriterClassic
  private readonly nitroWriter?: nitro.ChildToParentChainMessageWriterNitro

  /**
   * Instantiates a new `ChildToParentMessageWriter` object.
   *
   * @param {Signer} ParentChainSigner The signer to be used for executing the Chain-to-ParentChain message.
   * @param {ChildToParentTransactionEvent} event The event containing the data of the Chain-to-ParentChain message.
   * @param {Provider} [ParentChainProvider] Optional. Used to override the Provider which is attached to `ParentChainSigner` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    parentChainSigner: Signer,
    event: ChildToParentTransactionEvent,
    parentChainProvider?: Provider
  ) {
    super(parentChainProvider ?? parentChainSigner.provider!, event)

    if (this.isClassic(event)) {
      this.classicWriter = new classic.L2ToL1MessageWriterClassic(
        parentChainSigner,
        event.batchNumber,
        event.indexInBatch,
        parentChainProvider
      )
    } else {
      this.nitroWriter = new nitro.ChildToParentChainMessageWriterNitro(
        parentChainSigner,
        event,
        parentChainProvider
      )
    }
  }

  /**
   * Executes the ChildToParentMessage on ParentChain.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(
    childChainProvider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    if (this.nitroWriter)
      return this.nitroWriter.execute(childChainProvider, overrides)
    else return await this.classicWriter!.execute(childChainProvider, overrides)
  }
}
