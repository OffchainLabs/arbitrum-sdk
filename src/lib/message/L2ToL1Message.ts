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

import { Contract, ContractTransaction, Overrides } from 'ethers'
import { ArbSdkError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import { L2ToL1TransactionEvent as ClassicL2ToL1TransactionEvent } from '@arbitrum/sdk-classic/dist/lib/abi/ArbSys'
import { L2ToL1TxEvent as NitroL2ToL1TransactionEvent } from '@arbitrum/sdk-nitro/dist/lib/abi/ArbSys'
import {
  convertL2ToL1Status,
  IL2ToL1MessageReader,
  IL2ToL1MessageWriter,
  isNitroL2,
  MessageBatchProofInfo,
} from '../utils/migration_types'
import { Interface } from 'ethers/lib/utils'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { isDefined } from '../utils/lib'

export type L2ToL1TransactionEvent =
  | ClassicL2ToL1TransactionEvent['args']
  | NitroL2ToL1TransactionEvent['args']

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
  protected isClassic(
    e: L2ToL1TransactionEvent
  ): e is ClassicL2ToL1TransactionEvent['args'] {
    return isDefined((e as ClassicL2ToL1TransactionEvent['args']).indexInBatch)
  }

  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: NitroL2ToL1TransactionEvent['args']
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: ClassicL2ToL1TransactionEvent['args'],
    outboxAddress: string
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent,
    outboxAddress?: string
  ): L2ToL1MessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    event: L2ToL1TransactionEvent,
    outboxAddress?: string
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(l1SignerOrProvider, event, outboxAddress)
      : new L2ToL1MessageReader(l1SignerOrProvider, event, outboxAddress)
  }

  /**
   * Get event logs for L2ToL1 transactions.
   * @param l2Provider
   * @param filter Block range filter
   * @param positionOrBatchNumber The batchnumber indexed field was removed in nitro and a position indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same batchnumber.
   * For post nitro events it will be used to find events with the same position.
   * @param destination The L1 destination of the L2ToL1 message
   * @param hashOrUniqueId The uniqueId indexed field was removed in nitro and a hash indexed field was added.
   * For pre-nitro events the value passed in here will be used to find events with the same uniqueId.
   * For post nitro events it will be used to find events with the same hash.
   * @param indexInBatch The index in the batch, only valid for pre-nitro events. This parameter is ignored post-nitro
   * @returns Any classic and nitro events that match the provided filters.
   */
  public static async getEventLogs(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    positionOrBatchNumber?: BigNumber,
    destination?: string,
    hashOrUniqueId?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<L2ToL1TransactionEvent[]> {
    return (
      await Promise.all([
        classic.L2ToL1Message.getL2ToL1MessageLogs(
          l2Provider,
          filter,
          positionOrBatchNumber,
          destination,
          hashOrUniqueId,
          indexInBatch
        ),
        nitro.L2ToL1Message.getL2ToL1Events(
          l2Provider,
          filter,
          positionOrBatchNumber,
          destination,
          hashOrUniqueId
        ),
      ])
    ).flat(1)
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

  public constructor(
    l1Provider: Provider,
    event: NitroL2ToL1TransactionEvent['args']
  )
  public constructor(
    l1Provider: Provider,
    event: ClassicL2ToL1TransactionEvent['args'],
    outboxAddress: string
  )
  constructor(
    l1Provider: Provider,
    event: L2ToL1TransactionEvent,
    outboxAddress?: string
  )
  constructor(
    protected readonly l1Provider: Provider,
    event: L2ToL1TransactionEvent,
    protected readonly outboxAddress?: string
  ) {
    super()
    if (this.isClassic(event)) {
      if (!outboxAddress)
        throw new ArbSdkError(
          'No outbox address supplied for classic L2ToL1Message.'
        )
      this.classicReader = new classic.L2ToL1MessageReader(
        l1Provider,
        outboxAddress,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroReader = new nitro.L2ToL1MessageReader(l1Provider, event)
    }
  }

  protected async tryGetClassicProof(
    l2Provider: Provider
  ): Promise<MessageBatchProofInfo | null> {
    if (!this.classicReader)
      throw new ArbSdkError(
        'Trying get classic proof for empty classic reader.'
      )

    // If we're on the nitro node but need a classic proof we'll need
    // call a different function as it's been renamed to 'legacy'
    if (await isNitroL2(l2Provider)) {
      const iNodeInterface = new Interface([
        'function legacyLookupMessageBatchProof(uint256 batchNum, uint64 index) external view returns (bytes32[] memory proof, uint256 path, address l2Sender, address l1Dest, uint256 l2Block, uint256 l1Block, uint256 timestamp, uint256 amount, bytes memory calldataForL1)',
      ])

      const nodeInterface = new Contract(
        NODE_INTERFACE_ADDRESS,
        iNodeInterface,
        l2Provider
      )
      try {
        return nodeInterface.functions['legacyLookupMessageBatchProof'](
          this.classicReader.batchNumber,
          this.classicReader.indexInBatch
        )
      } catch (e) {
        const expectedError = "batch doesn't exist"
        const err = e as Error & { error: Error }
        const actualError =
          err && (err.message || (err.error && err.error.message))
        if (actualError.includes(expectedError)) return null
        else throw e
      }
    } else {
      return await this.classicReader.tryGetProof(l2Provider)
    }
  }

  public async getOutboxProof(
    l2Provider: Provider
  ): Promise<MessageBatchProofInfo | null | string[]> {
    return this.nitroReader
      ? this.nitroReader.getOutboxProof(l2Provider)
      : this.tryGetClassicProof(l2Provider)
  }

  protected classicProof?: MessageBatchProofInfo

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    // can we create an l2tol1message here, we need to - the constructor is what we need
    if (this.nitroReader) return this.nitroReader.status(l2Provider)
    else {
      const proof =
        this.classicProof || (await this.tryGetClassicProof(l2Provider))
      if (proof && !this.classicProof) this.classicProof = proof

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

  public constructor(
    l1Signer: Signer,
    event: NitroL2ToL1TransactionEvent['args']
  )
  public constructor(
    l1Signer: Signer,
    event: ClassicL2ToL1TransactionEvent['args'],
    outboxAddress: string
  )
  constructor(
    l1Signer: Signer,
    event: L2ToL1TransactionEvent,
    outboxAddress?: string
  )
  constructor(
    l1Signer: Signer,
    event: L2ToL1TransactionEvent,
    outboxAddress?: string
  ) {
    super(l1Signer.provider!, event, outboxAddress)

    if (this.isClassic(event)) {
      if (!outboxAddress)
        throw new ArbSdkError(
          'No outbox address supplied for classic L2ToL1Message.'
        )
      this.classicWriter = new classic.L2ToL1MessageWriter(
        l1Signer,
        outboxAddress,
        event.batchNumber,
        event.indexInBatch
      )
    } else {
      this.nitroWriter = new nitro.L2ToL1MessageWriter(l1Signer, event)
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
    else {
      const proof =
        this.classicProof || (await this.tryGetClassicProof(l2Provider))
      if (proof === null) throw new ArbSdkError('Unexpected missing proof')
      if (!this.classicProof) this.classicProof = proof
      return await this.classicWriter!.execute(proof)
    }
  }
}
