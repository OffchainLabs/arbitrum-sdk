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

import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { BigNumber } from '@ethersproject/bignumber'
import { BlockTag } from '@ethersproject/abstract-provider'

import { ArbSys__factory } from '../abi/factories/ArbSys__factory'

import { L2ToL1TransactionEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides } from 'ethers'
import { EventFetcher } from '../utils/eventFetcher'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { L2TransactionReceipt } from './L2Transaction'
import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  convertL2ToL1Status,
  IL2ToL1MessageReader,
  IL2ToL1MessageWriter,
  MessageBatchProofInfo,
} from '../utils/migration_types'

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

/**
 * Base functionality for L2->L1 messages
 */
export class L2ToL1Message {
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event?: L2ToL1TransactionEvent['args'],
    outboxAddress?: string,
    batchNumber?: BigNumber,
    indexInBatch?: BigNumber
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event?: L2ToL1TransactionEvent['args'],
    outboxAddress?: string,
    batchNumber?: BigNumber,
    indexInBatch?: BigNumber
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(
          l1SignerOrProvider,
          event,
          outboxAddress,
          batchNumber,
          indexInBatch
        )
      : new L2ToL1MessageReader(
          l1SignerOrProvider,
          event,
          outboxAddress,
          batchNumber,
          indexInBatch
        )
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
export class L2ToL1MessageReader
  extends L2ToL1Message
  implements IL2ToL1MessageReader
{
  private readonly classicReader?: classic.L2ToL1MessageReader
  private readonly nitroReader?: nitro.L2ToL1MessageReader

  constructor(
    protected readonly l1Provider: Provider,
    event?: L2ToL1TransactionEvent['args'],
    protected readonly outboxAddress?: string,
    batchNumber?: BigNumber,
    indexInBatch?: BigNumber
  ) {
    super()

    if (event) {
      this.nitroReader = new nitro.L2ToL1MessageReader(l1Provider, event)
    } else if (outboxAddress && batchNumber && indexInBatch) {
      this.classicReader = new classic.L2ToL1MessageReader(
        l1Provider,
        outboxAddress,
        batchNumber,
        indexInBatch
      )
    } else
      throw new ArbSdkError('Unexpected L2ToL1MessageReader constructor args')
  }

  public async getOutboxProof(
    l2Provider: Provider
  ): Promise<MessageBatchProofInfo | null | string[]> {
    return this.nitroReader
      ? this.nitroReader.getOutboxProof(l2Provider)
      : this.classicReader!.tryGetProof(l2Provider)
  }

  protected classicProof?: MessageBatchProofInfo;

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    // can we create an l2tol1message here, we need to - the constructor is what we need
    if (this.nitroReader) return this.nitroReader.status(l2Provider)
    else {
      const proof = this.classicProof ||await this.classicReader!.tryGetProof(l2Provider)
      if(proof && !this.classicProof) this.classicProof = proof
      
      const status = await this.classicReader!.status(proof)
      return convertL2ToL1Status(status)
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
    if (this.nitroReader)
      return this.nitroReader.waitUntilReadyToExecute(l2Provider, retryDelay)
    else return this.classicReader!.waitUntilOutboxEntryCreated(retryDelay)
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
export class L2ToL1MessageWriter
  extends L2ToL1MessageReader
  implements IL2ToL1MessageWriter
{
  private readonly classicWriter?: classic.L2ToL1MessageWriter
  private readonly nitroWriter?: nitro.L2ToL1MessageWriter
  constructor(
    l1Signer: Signer,
    event?: L2ToL1TransactionEvent['args'],
    outboxAddress?: string,
    batchNumber?: BigNumber,
    indexInBatch?: BigNumber
  ) {
    super(l1Signer.provider!, event, outboxAddress, batchNumber, indexInBatch)

    if (event) this.nitroWriter = new nitro.L2ToL1MessageWriter(l1Signer, event)
    else if (outboxAddress && batchNumber && indexInBatch)
      this.classicWriter = new classic.L2ToL1MessageWriter(
        l1Signer,
        outboxAddress,
        batchNumber,
        indexInBatch
      )
    else
      throw new ArbSdkError('Unexpected L2ToL1MessageWriter constructor args')
  }

  // CHRIS: TODO: we shouldnt test isnitro in here
  // CHRIS: TODO: we should work purely based on the outbox addr
  // CHRIS: TODO: we need to populate that new outbox addresses somehow - we need to figure out that batch number thing (that isnt immediately clear to me)

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
    else {
      const proof = this.classicProof || await this.classicWriter!.tryGetProof(l2Provider)
      if (proof === null) throw new ArbSdkError('Unexpected missing proof')
      if(!this.classicProof) this.classicProof = proof;
      return await this.classicWriter!.execute(proof)
    }
  }
}
