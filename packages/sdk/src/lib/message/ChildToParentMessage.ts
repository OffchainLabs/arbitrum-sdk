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

import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { BlockTag } from '@ethersproject/abstract-provider'

import { ContractTransaction, Overrides, BigNumber } from 'ethers'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import * as classic from './ChildToParentMessageClassic'
import * as nitro from './ChildToParentMessageNitro'
import {
  L2ToL1TransactionEvent as ClassicChildToParentTransactionEvent,
  L2ToL1TxEvent as NitroChildToParentTransactionEvent,
} from '../abi/ArbSys'
import { isDefined } from '../utils/lib'
import { EventArgs } from '../dataEntities/event'
import { ChildToParentMessageStatus } from '../dataEntities/message'
import {
  getArbitrumNetwork,
  getNitroGenesisBlock,
} from '../dataEntities/networks'
import { ArbSdkError } from '../dataEntities/errors'

export type ChildToParentTransactionEvent =
  | EventArgs<ClassicChildToParentTransactionEvent>
  | EventArgs<NitroChildToParentTransactionEvent>

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then ChildToParentMessageReaderOrWriter<T> will be of type ChildToParentMessageReader.
 * If T is of type Signer then ChildToParentMessageReaderOrWriter<T> will be of
 * type ChildToParentMessageWriter.
 */
export type ChildToParentMessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? ChildToParentMessageReader : ChildToParentMessageWriter

/**
 * Base functionality for Child-to-Parent messages
 */
export class ChildToParentMessage {
  protected isClassic(
    e: ChildToParentTransactionEvent
  ): e is EventArgs<ClassicChildToParentTransactionEvent> {
    return isDefined(
      (e as EventArgs<ClassicChildToParentTransactionEvent>).indexInBatch
    )
  }

  /**
   * Instantiates a new `ChildToParentMessageWriter` or `ChildToParentMessageReader` object.
   *
   * @param {SignerOrProvider} parentSignerOrProvider Signer or provider to be used for executing or reading the Child-to-Parent message.
   * @param {ChildToParentTransactionEvent} event The event containing the data of the Child-to-Parent message.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `ParentSignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ): ChildToParentMessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ): ChildToParentMessageReader | ChildToParentMessageWriter {
    return SignerProviderUtils.isSigner(parentSignerOrProvider)
      ? new ChildToParentMessageWriter(
          parentSignerOrProvider,
          event,
          parentProvider
        )
      : new ChildToParentMessageReader(parentSignerOrProvider, event)
  }

  /**
   * Get event logs for ChildToParent transactions.
   * @param childProvider
   * @param filter Block range filter
   * @param position The batchnumber indexed field was removed in nitro and a position indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same batchnumber.
   * For post nitro events it will be used to find events with the same position.
   * @param destination The parent destination of the ChildToParent message
   * @param hash The uniqueId indexed field was removed in nitro and a hash indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same uniqueId.
   * For post nitro events it will be used to find events with the same hash.
   * @param indexInBatch The index in the batch, only valid for pre-nitro events. This parameter is ignored post-nitro
   * @returns Any classic and nitro events that match the provided filters.
   */
  public static async getChildToParentEvents(
    childProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: BigNumber,
    destination?: string,
    hash?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<(ChildToParentTransactionEvent & { transactionHash: string })[]> {
    const childChain = await getArbitrumNetwork(childProvider)
    const childNitroGenesisBlock = getNitroGenesisBlock(childChain)

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
      fromBlock: inClassicRange(filter.fromBlock, childNitroGenesisBlock),
      toBlock: inClassicRange(filter.toBlock, childNitroGenesisBlock),
    }
    const logQueries = []
    if (classicFilter.fromBlock !== classicFilter.toBlock) {
      logQueries.push(
        classic.ChildToParentMessageClassic.getChildToParentEvents(
          childProvider,
          classicFilter,
          position,
          destination,
          hash,
          indexInBatch
        )
      )
    }

    const nitroFilter = {
      fromBlock: inNitroRange(filter.fromBlock, childNitroGenesisBlock),
      toBlock: inNitroRange(filter.toBlock, childNitroGenesisBlock),
    }
    if (nitroFilter.fromBlock !== nitroFilter.toBlock) {
      logQueries.push(
        nitro.ChildToParentMessageNitro.getChildToParentEvents(
          childProvider,
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
 * Provides read-only access for Child-to-Parent messages
 */
export class ChildToParentMessageReader extends ChildToParentMessage {
  private readonly classicReader?: classic.ChildToParentMessageReaderClassic
  private readonly nitroReader?: nitro.ChildToParentMessageReaderNitro

  constructor(
    protected readonly parentProvider: Provider,
    event: ChildToParentTransactionEvent
  ) {
    super()
    if (this.isClassic(event)) {
      this.classicReader = new classic.ChildToParentMessageReaderClassic(
        parentProvider,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroReader = new nitro.ChildToParentMessageReaderNitro(
        parentProvider,
        event
      )
    }
  }

  public async getOutboxProof(
    childProvider: Provider
  ): Promise<classic.MessageBatchProofInfo | null | string[]> {
    if (this.nitroReader) {
      return await this.nitroReader.getOutboxProof(childProvider)
    } else return await this.classicReader!.tryGetProof(childProvider)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(
    childProvider: Provider
  ): Promise<ChildToParentMessageStatus> {
    // can we create a ChildToParentMessage here, we need to - the constructor is what we need
    if (this.nitroReader) return await this.nitroReader.status(childProvider)
    else return await this.classicReader!.status(childProvider)
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
    if (this.nitroReader)
      return this.nitroReader.waitUntilReadyToExecute(childProvider, retryDelay)
    else
      return this.classicReader!.waitUntilOutboxEntryCreated(
        childProvider,
        retryDelay
      )
  }

  /**
   * Estimates the Parent block number in which this Child-to-Parent tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param childProvider
   * @returns expected Parent block number where the Child-to-Parent message will be executable. Returns null if the message can or already has been executed
   */
  public async getFirstExecutableBlock(
    childProvider: Provider
  ): Promise<BigNumber | null> {
    if (this.nitroReader)
      return this.nitroReader.getFirstExecutableBlock(childProvider)
    else return this.classicReader!.getFirstExecutableBlock(childProvider)
  }
}

/**
 * Provides read and write access for Child-to-Parent messages
 */
export class ChildToParentMessageWriter extends ChildToParentMessageReader {
  private readonly classicWriter?: classic.ChildToParentMessageWriterClassic
  private readonly nitroWriter?: nitro.ChildToParentMessageWriterNitro

  /**
   * Instantiates a new `ChildToParentMessageWriter` object.
   *
   * @param {Signer} parentSigner The signer to be used for executing the Child-to-Parent message.
   * @param {ChildToParentTransactionEvent} event The event containing the data of the Child-to-Parent message.
   * @param {Provider} [parentProvider] Optional. Used to override the Provider which is attached to `parentSigner` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    parentSigner: Signer,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ) {
    super(parentProvider ?? parentSigner.provider!, event)

    if (this.isClassic(event)) {
      this.classicWriter = new classic.ChildToParentMessageWriterClassic(
        parentSigner,
        event.batchNumber,
        event.indexInBatch,
        parentProvider
      )
    } else {
      this.nitroWriter = new nitro.ChildToParentMessageWriterNitro(
        parentSigner,
        event,
        parentProvider
      )
    }
  }

  /**
   * Executes the ChildToParentMessage on Parent chain.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(
    childProvider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    if (this.nitroWriter)
      return this.nitroWriter.execute(childProvider, overrides)
    else return await this.classicWriter!.execute(childProvider, overrides)
  }
}
