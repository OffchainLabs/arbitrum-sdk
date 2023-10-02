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
import { BigNumber } from '@ethersproject/bignumber'
import { BlockTag } from '@ethersproject/abstract-provider'

import { ContractTransaction, Overrides } from 'ethers'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import * as classic from './L2ToL1MessageClassic'
import * as nitro from './L2ToL1MessageNitro'
import {
  L2ToL1TransactionEvent as ClassicChildToParentChainTransactionEvent,
  L2ToL1TxEvent as NitroChildToParentChainTransactionEvent,
} from '../abi/ArbSys'
import { isDefined } from '../utils/lib'
import { EventArgs } from '../dataEntities/event'
import { L2ToL1MessageStatus as ChildToParentChainMessageStatus } from '../dataEntities/message'
import { getChainNetwork } from '../dataEntities/networks'
import { ArbSdkError } from '../dataEntities/errors'

export type ChildToParentChainTransactionEvent =
  | EventArgs<ClassicChildToParentChainTransactionEvent>
  | EventArgs<NitroChildToParentChainTransactionEvent>

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then ChildToParentChainMessageReaderOrWriter<T> will be of type ChildToParentChainMessageReader.
 * If T is of type Signer then ChildToParentChainMessageReaderOrWriter<T> will be of
 * type ChildToParentChainMessageWriter.
 */
export type ChildToParentChainMessageReaderOrWriter<
  T extends SignerOrProvider
> = T extends Provider
  ? ChildToParentChainMessageReader
  : ChildToParentChainMessageWriter

/**
 * Base functionality for Chain->ParentChain messages
 */
export class ChildToParentChainMessage {
  protected isClassic(
    e: ChildToParentChainTransactionEvent
  ): e is EventArgs<ClassicChildToParentChainTransactionEvent> {
    return isDefined(
      (e as EventArgs<ClassicChildToParentChainTransactionEvent>).indexInBatch
    )
  }

  /**
   * Instantiates a new `ChildToParentChainMessageWriter` or `ChildToParentChainMessageReader` object.
   *
   * @param {SignerOrProvider} ParentChainSignerOrProvider Signer or provider to be used for executing or reading the Chain-to-ParentChain message.
   * @param {ChildToParentChainTransactionEvent} event The event containing the data of the Chain-to-ParentChain message.
   * @param {Provider} [ParentChainProvider] Optional. Used to override the Provider which is attached to `ParentChainSignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    ParentChainSignerOrProvider: T,
    event: ChildToParentChainTransactionEvent,
    ParentChainProvider?: Provider
  ): ChildToParentChainMessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    ParentChainSignerOrProvider: T,
    event: ChildToParentChainTransactionEvent,
    ParentChainProvider?: Provider
  ): ChildToParentChainMessageReader | ChildToParentChainMessageWriter {
    return SignerProviderUtils.isSigner(ParentChainSignerOrProvider)
      ? new ChildToParentChainMessageWriter(
          ParentChainSignerOrProvider,
          event,
          ParentChainProvider
        )
      : new ChildToParentChainMessageReader(ParentChainSignerOrProvider, event)
  }

  /**
   * Get event logs for ChildToParentChain transactions.
   * @param ChainProvider
   * @param filter Block range filter
   * @param position The batchnumber indexed field was removed in nitro and a position indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same batchnumber.
   * For post nitro events it will be used to find events with the same position.
   * @param destination The ParentChain destination of the ChildToParentChain message
   * @param hash The uniqueId indexed field was removed in nitro and a hash indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same uniqueId.
   * For post nitro events it will be used to find events with the same hash.
   * @param indexInBatch The index in the batch, only valid for pre-nitro events. This parameter is ignored post-nitro
   * @returns Any classic and nitro events that match the provided filters.
   */
  public static async getChildToParentChainEvents(
    ChainProvider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: BigNumber,
    destination?: string,
    hash?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<
    (ChildToParentChainTransactionEvent & { transactionHash: string })[]
  > {
    const ChainNetwork = await getChainNetwork(ChainProvider)

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
      fromBlock: inClassicRange(
        filter.fromBlock,
        ChainNetwork.nitroGenesisBlock
      ),
      toBlock: inClassicRange(filter.toBlock, ChainNetwork.nitroGenesisBlock),
    }
    const logQueries = []
    if (classicFilter.fromBlock !== classicFilter.toBlock) {
      logQueries.push(
        classic.ChildToParentChainMessageClassic.getChildToParentChainEvents(
          ChainProvider,
          classicFilter,
          position,
          destination,
          hash,
          indexInBatch
        )
      )
    }

    const nitroFilter = {
      fromBlock: inNitroRange(filter.fromBlock, ChainNetwork.nitroGenesisBlock),
      toBlock: inNitroRange(filter.toBlock, ChainNetwork.nitroGenesisBlock),
    }
    if (nitroFilter.fromBlock !== nitroFilter.toBlock) {
      logQueries.push(
        nitro.ChildToParentChainMessageNitro.getChildToParentChainEvents(
          ChainProvider,
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
export class ChildToParentChainMessageReader extends ChildToParentChainMessage {
  private readonly classicReader?: classic.ChildToParentChainMessageReaderClassic
  private readonly nitroReader?: nitro.ChildToParentChainMessageReaderNitro

  constructor(
    protected readonly ParentChainProvider: Provider,
    event: ChildToParentChainTransactionEvent
  ) {
    super()
    if (this.isClassic(event)) {
      this.classicReader = new classic.ChildToParentChainMessageReaderClassic(
        ParentChainProvider,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroReader = new nitro.ChildToParentChainMessageReaderNitro(
        ParentChainProvider,
        event
      )
    }
  }

  public async getOutboxProof(
    ChainProvider: Provider
  ): Promise<classic.MessageBatchProofInfo | null | string[]> {
    if (this.nitroReader) {
      return await this.nitroReader.getOutboxProof(ChainProvider)
    } else return await this.classicReader!.tryGetProof(ChainProvider)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(
    ChainProvider: Provider
  ): Promise<ChildToParentChainMessageStatus> {
    // can we create an ChildToParentChainmessage here, we need to - the constructor is what we need
    if (this.nitroReader) return await this.nitroReader.status(ChainProvider)
    else return await this.classicReader!.status(ChainProvider)
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns
   */
  public async waitUntilReadyToExecute(
    ChainProvider: Provider,
    retryDelay = 500
  ): Promise<void> {
    if (this.nitroReader)
      return this.nitroReader.waitUntilReadyToExecute(ChainProvider, retryDelay)
    else
      return this.classicReader!.waitUntilOutboxEntryCreated(
        ChainProvider,
        retryDelay
      )
  }

  /**
   * Estimates the ParentChain block number in which this Chain to ParentChain tx will be available for execution.
   * If the message can or already has been executed, this returns null
   * @param ChainProvider
   * @returns expected ParentChain block number where the Chain to ParentChain message will be executable. Returns null if the message can or already has been executed
   */
  public async getFirstExecutableBlock(
    ChainProvider: Provider
  ): Promise<BigNumber | null> {
    if (this.nitroReader)
      return this.nitroReader.getFirstExecutableBlock(ChainProvider)
    else return this.classicReader!.getFirstExecutableBlock(ChainProvider)
  }
}

/**
 * Provides read and write access for Chain-to-ParentChain-messages
 */
export class ChildToParentChainMessageWriter extends ChildToParentChainMessageReader {
  private readonly classicWriter?: classic.ChildToParentChainMessageWriterClassic
  private readonly nitroWriter?: nitro.ChildToParentChainMessageWriterNitro

  /**
   * Instantiates a new `ChildToParentChainMessageWriter` object.
   *
   * @param {Signer} ParentChainSigner The signer to be used for executing the Chain-to-ParentChain message.
   * @param {ChildToParentChainTransactionEvent} event The event containing the data of the Chain-to-ParentChain message.
   * @param {Provider} [ParentChainProvider] Optional. Used to override the Provider which is attached to `ParentChainSigner` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    ParentChainSigner: Signer,
    event: ChildToParentChainTransactionEvent,
    ParentChainProvider?: Provider
  ) {
    super(ParentChainProvider ?? ParentChainSigner.provider!, event)

    if (this.isClassic(event)) {
      this.classicWriter = new classic.ChildToParentChainMessageWriterClassic(
        ParentChainSigner,
        event.batchNumber,
        event.indexInBatch,
        ParentChainProvider
      )
    } else {
      this.nitroWriter = new nitro.ChildToParentChainMessageWriterNitro(
        ParentChainSigner,
        event,
        ParentChainProvider
      )
    }
  }

  /**
   * Executes the ChildToParentChainMessage on ParentChain.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(
    ChainProvider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    if (this.nitroWriter)
      return this.nitroWriter.execute(ChainProvider, overrides)
    else return await this.classicWriter!.execute(ChainProvider, overrides)
  }
}
