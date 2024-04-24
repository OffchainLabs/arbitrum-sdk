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
  L2ToL1TransactionEvent as ClassicL2ToL1TransactionEvent,
  L2ToL1TxEvent as NitroL2ToL1TransactionEvent,
} from '../abi/ArbSys'
import { isDefined } from '../utils/lib'
import { EventArgs } from '../dataEntities/event'
import { L2ToL1MessageStatus } from '../dataEntities/message'
import { getL2Network } from '../dataEntities/networks'
import { ArbSdkError } from '../dataEntities/errors'

export type L2ToL1TransactionEvent =
  | EventArgs<ClassicL2ToL1TransactionEvent>
  | EventArgs<NitroL2ToL1TransactionEvent>

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then L2ToL1MessageReaderOrWriter<T> will be of type L2ToL1MessageReader.
 * If T is of type Signer then L2ToL1MessageReaderOrWriter<T> will be of
 * type L2ToL1MessageWriter.
 */
export type L2ToL1MessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? L2ToL1MessageReader : L2ToL1MessageWriter

/**
 * Base functionality for L2->L1 messages
 */
export class L2ToL1Message {
  protected isClassic(
    e: L2ToL1TransactionEvent
  ): e is EventArgs<ClassicL2ToL1TransactionEvent> {
    return isDefined(
      (e as EventArgs<ClassicL2ToL1TransactionEvent>).indexInBatch
    )
  }

  /**
   * Instantiates a new `L2ToL1MessageWriter` or `L2ToL1MessageReader` object.
   *
   * @param {SignerOrProvider} l1SignerOrProvider Signer or provider to be used for executing or reading the L2-to-L1 message.
   * @param {L2ToL1TransactionEvent} event The event containing the data of the L2-to-L1 message.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1SignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent,
    l1Provider?: Provider
  ): L2ToL1MessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent,
    l1Provider?: Provider
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(l1SignerOrProvider, event, l1Provider)
      : new L2ToL1MessageReader(l1SignerOrProvider, event)
  }

  /**
   * Get event logs for L2ToL1 transactions.
   * @param l2Provider
   * @param filter Block range filter
   * @param position The batchnumber indexed field was removed in nitro and a position indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same batchnumber.
   * For post nitro events it will be used to find events with the same position.
   * @param destination The L1 destination of the L2ToL1 message
   * @param hash The uniqueId indexed field was removed in nitro and a hash indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same uniqueId.
   * For post nitro events it will be used to find events with the same hash.
   * @param indexInBatch The index in the batch, only valid for pre-nitro events. This parameter is ignored post-nitro
   * @returns Any classic and nitro events that match the provided filters.
   */
  public static async getL2ToL1Events(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    position?: BigNumber,
    destination?: string,
    hash?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<(L2ToL1TransactionEvent & { transactionHash: string })[]> {
    const l2Network = await getL2Network(l2Provider)

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
      fromBlock: inClassicRange(filter.fromBlock, l2Network.nitroGenesisBlock),
      toBlock: inClassicRange(filter.toBlock, l2Network.nitroGenesisBlock),
    }
    const logQueries = []
    if (classicFilter.fromBlock !== classicFilter.toBlock) {
      logQueries.push(
        classic.L2ToL1MessageClassic.getL2ToL1Events(
          l2Provider,
          classicFilter,
          position,
          destination,
          hash,
          indexInBatch
        )
      )
    }

    const nitroFilter = {
      fromBlock: inNitroRange(filter.fromBlock, l2Network.nitroGenesisBlock),
      toBlock: inNitroRange(filter.toBlock, l2Network.nitroGenesisBlock),
    }
    if (nitroFilter.fromBlock !== nitroFilter.toBlock) {
      logQueries.push(
        nitro.L2ToL1MessageNitro.getL2ToL1Events(
          l2Provider,
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
 * Provides read-only access for l2-to-l1-messages
 */
export class L2ToL1MessageReader extends L2ToL1Message {
  private readonly classicReader?: classic.L2ToL1MessageReaderClassic
  private readonly nitroReader?: nitro.L2ToL1MessageReaderNitro

  constructor(
    protected readonly l1Provider: Provider,
    event: L2ToL1TransactionEvent
  ) {
    super()
    if (this.isClassic(event)) {
      this.classicReader = new classic.L2ToL1MessageReaderClassic(
        l1Provider,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroReader = new nitro.L2ToL1MessageReaderNitro(l1Provider, event)
    }
  }

  public async getOutboxProof(
    l2Provider: Provider
  ): Promise<classic.MessageBatchProofInfo | null | string[]> {
    if (this.nitroReader) {
      return await this.nitroReader.getOutboxProof(l2Provider)
    } else return await this.classicReader!.tryGetProof(l2Provider)
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    // can we create an l2tol1message here, we need to - the constructor is what we need
    if (this.nitroReader) return await this.nitroReader.status(l2Provider)
    else return await this.classicReader!.status(l2Provider)
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns outbox entry status (either executed or confirmed but not pending)
   */
  public async waitUntilReadyToExecute(
    l2Provider: Provider,
    retryDelay = 500
  ): Promise<L2ToL1MessageStatus.EXECUTED | L2ToL1MessageStatus.CONFIRMED> {
    if (this.nitroReader)
      return this.nitroReader.waitUntilReadyToExecute(l2Provider, retryDelay)
    else
      return this.classicReader!.waitUntilOutboxEntryCreated(
        l2Provider,
        retryDelay
      )
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
    if (this.nitroReader)
      return this.nitroReader.getFirstExecutableBlock(l2Provider)
    else return this.classicReader!.getFirstExecutableBlock(l2Provider)
  }
}

/**
 * Provides read and write access for l2-to-l1-messages
 */
export class L2ToL1MessageWriter extends L2ToL1MessageReader {
  private readonly classicWriter?: classic.L2ToL1MessageWriterClassic
  private readonly nitroWriter?: nitro.L2ToL1MessageWriterNitro

  /**
   * Instantiates a new `L2ToL1MessageWriter` object.
   *
   * @param {Signer} l1Signer The signer to be used for executing the L2-to-L1 message.
   * @param {L2ToL1TransactionEvent} event The event containing the data of the L2-to-L1 message.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1Signer` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    l1Signer: Signer,
    event: L2ToL1TransactionEvent,
    l1Provider?: Provider
  ) {
    super(l1Provider ?? l1Signer.provider!, event)

    if (this.isClassic(event)) {
      this.classicWriter = new classic.L2ToL1MessageWriterClassic(
        l1Signer,
        event.batchNumber,
        event.indexInBatch,
        l1Provider
      )
    } else {
      this.nitroWriter = new nitro.L2ToL1MessageWriterNitro(
        l1Signer,
        event,
        l1Provider
      )
    }
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
    if (this.nitroWriter) return this.nitroWriter.execute(l2Provider, overrides)
    else return await this.classicWriter!.execute(l2Provider, overrides)
  }
}
