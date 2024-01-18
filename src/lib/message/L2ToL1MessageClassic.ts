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

import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { L2ToL1TransactionEvent } from '../abi/ArbSys'
import { ContractTransaction, Overrides } from 'ethers'
import { EventFetcher } from '../utils/eventFetcher'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { isDefined, wait } from '../utils/lib'
import { ArbSdkError } from '../dataEntities/errors'
import { EventArgs } from '../dataEntities/event'
import { L2ToL1MessageStatus } from '../dataEntities/message'
import { getL2Network } from '../dataEntities/networks'

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
 * then L2ToL1MessageReaderOrWriter<T> will be of type L2ToL1MessageReader.
 * If T is of type Signer then L2ToL1MessageReaderOrWriter<T> will be of
 * type L2ToL1MessageWriter.
 */
export type L2ToL1MessageReaderOrWriterClassic<T extends SignerOrProvider> =
  T extends Provider ? L2ToL1MessageReaderClassic : L2ToL1MessageWriterClassic

export class L2ToL1MessageClassic {
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
   * Instantiates a new `L2ToL1MessageWriterClassic` or `L2ToL1MessageReaderClassic` object.
   *
   * @param {SignerOrProvider} l1SignerOrProvider Signer or provider to be used for executing or reading the L2-to-L1 message.
   * @param {BigNumber} batchNumber The number of the batch containing the L2-to-L1 message.
   * @param {BigNumber} indexInBatch The index of the L2-to-L1 message within the batch.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1SignerOrProvider` in case you need more control. This will be a required parameter in a future major version update.
   */
  public static fromBatchNumber<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    l1Provider?: Provider
  ): L2ToL1MessageReaderOrWriterClassic<T>
  public static fromBatchNumber<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    l1Provider?: Provider
  ): L2ToL1MessageReaderClassic | L2ToL1MessageWriterClassic {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriterClassic(
          l1SignerOrProvider,
          batchNumber,
          indexInBatch,
          l1Provider
        )
      : new L2ToL1MessageReaderClassic(
          l1SignerOrProvider,
          batchNumber,
          indexInBatch
        )
  }

  public static async getL2ToL1Events(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    batchNumber?: BigNumber,
    destination?: string,
    uniqueId?: BigNumber,
    indexInBatch?: BigNumber
  ): Promise<
    (EventArgs<L2ToL1TransactionEvent> & { transactionHash: string })[]
  > {
    const eventFetcher = new EventFetcher(l2Provider)
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
 * Provides read-only access for classic l2-to-l1-messages
 */
export class L2ToL1MessageReaderClassic extends L2ToL1MessageClassic {
  constructor(
    protected readonly l1Provider: Provider,
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
   * @param l2Provider
   * @param batchNumber
   * @returns
   */
  protected async getOutboxAddress(l2Provider: Provider, batchNumber: number) {
    if (!isDefined(this.outboxAddress)) {
      const l2Network = await getL2Network(l2Provider)

      // find the outbox where the activation batch number of the next outbox
      // is greater than the supplied batch
      const outboxes = isDefined(l2Network.ethBridge.classicOutboxes)
        ? Object.entries(l2Network.ethBridge.classicOutboxes)
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

  private async outboxEntryExists(l2Provider: Provider) {
    const outboxAddress = await this.getOutboxAddress(
      l2Provider,
      this.batchNumber.toNumber()
    )

    const outbox = Outbox__factory.connect(outboxAddress, this.l1Provider)
    return await outbox.outboxEntryExists(this.batchNumber)
  }

  public static async tryGetProof(
    l2Provider: Provider,
    batchNumber: BigNumber,
    indexInBatch: BigNumber
  ): Promise<MessageBatchProofInfo | null> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
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
   * @param l2Provider
   * @returns
   */
  public async tryGetProof(
    l2Provider: Provider
  ): Promise<MessageBatchProofInfo | null> {
    if (!isDefined(this.proof)) {
      this.proof = await L2ToL1MessageReaderClassic.tryGetProof(
        l2Provider,
        this.batchNumber,
        this.indexInBatch
      )
    }
    return this.proof
  }

  /**
   * Check if given outbox message has already been executed
   */
  public async hasExecuted(l2Provider: Provider): Promise<boolean> {
    const proofInfo = await this.tryGetProof(l2Provider)
    if (!isDefined(proofInfo)) return false

    const outboxAddress = await this.getOutboxAddress(
      l2Provider,
      this.batchNumber.toNumber()
    )

    const outbox = Outbox__factory.connect(outboxAddress, this.l1Provider)
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
   * @param proofInfo
   * @returns
   */
  public async status(l2Provider: Provider): Promise<L2ToL1MessageStatus> {
    try {
      const messageExecuted = await this.hasExecuted(l2Provider)
      if (messageExecuted) {
        return L2ToL1MessageStatus.EXECUTED
      }

      const outboxEntryExists = await this.outboxEntryExists(l2Provider)
      return outboxEntryExists
        ? L2ToL1MessageStatus.CONFIRMED
        : L2ToL1MessageStatus.UNCONFIRMED
    } catch (e) {
      return L2ToL1MessageStatus.UNCONFIRMED
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
    l2Provider: Provider,
    retryDelay = 500
  ): Promise<L2ToL1MessageStatus.EXECUTED | L2ToL1MessageStatus.CONFIRMED> {
    const exists = await this.outboxEntryExists(l2Provider)
    if (exists) {
      return (await this.hasExecuted(l2Provider))
        ? L2ToL1MessageStatus.EXECUTED
        : L2ToL1MessageStatus.CONFIRMED
    } else {
      await wait(retryDelay)
      return await this.waitUntilOutboxEntryCreated(l2Provider, retryDelay)
    }
  }

  /**
   * Estimates the L1 block number in which this L2 to L1 tx will be available for execution
   * @param l2Provider
   * @returns Always returns null for classic l2toL1 messages since they can be executed in any block now.
   */
  public async getFirstExecutableBlock(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    l2Provider: Provider
  ): Promise<BigNumber | null> {
    return null
  }
}

/**
 * Provides read and write access for classic l2-to-l1-messages
 */
export class L2ToL1MessageWriterClassic extends L2ToL1MessageReaderClassic {
  /**
   * Instantiates a new `L2ToL1MessageWriterClassic` object.
   *
   * @param {Signer} l1Signer The signer to be used for executing the L2-to-L1 message.
   * @param {BigNumber} batchNumber The number of the batch containing the L2-to-L1 message.
   * @param {BigNumber} indexInBatch The index of the L2-to-L1 message within the batch.
   * @param {Provider} [l1Provider] Optional. Used to override the Provider which is attached to `l1Signer` in case you need more control. This will be a required parameter in a future major version update.
   */
  constructor(
    private readonly l1Signer: Signer,
    batchNumber: BigNumber,
    indexInBatch: BigNumber,
    l1Provider?: Provider
  ) {
    super(l1Provider ?? l1Signer.provider!, batchNumber, indexInBatch)
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

    const proofInfo = await this.tryGetProof(l2Provider)
    if (!isDefined(proofInfo)) {
      throw new ArbSdkError(
        `Unexpected missing proof: ${this.batchNumber.toString()} ${this.indexInBatch.toString()}}`
      )
    }
    const outboxAddress = await this.getOutboxAddress(
      l2Provider,
      this.batchNumber.toNumber()
    )
    const outbox = Outbox__factory.connect(outboxAddress, this.l1Signer)
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
