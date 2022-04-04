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
import { IOutbox__factory } from '../abi/factories/IOutbox__factory'
import { Outbox__factory } from '../abi/factories/Outbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

import { L2ToL1TransactionEvent } from '../abi/ArbSys'
import { constants, Contract, ContractTransaction, ethers } from 'ethers'
import { EventFetcher } from '../utils/eventFetcher'
import { ArbTsError } from '../dataEntities/errors'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { wait } from '../utils/lib'

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

export enum L2ToL1MessageStatus {
  /**
   * No corresponding L2ToL1Event emitted
   */
  NOT_FOUND,
  /**
   * ArbSys.sendTxToL1 called, but assertion not yet confirmed
   */
  UNCONFIRMED,
  /**
   * Assertion for outgoing message confirmed, but message not yet executed
   */
  CONFIRMED,
  /**
   * Outgoing message executed (terminal state)
   */
  EXECUTED,
}

// CHRIS: TODO: delete later when we have the proper event
export type L2ToL1Event = {
  caller: string
  destination: string
  hash: BigNumber
  position: BigNumber
  indexInBatch: BigNumber
  arbBlockNum: BigNumber
  ethBlockNum: BigNumber
  timestamp: BigNumber
  callvalue: BigNumber
  data: string
}

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then L2ToL1MessageReaderOrWriter<T> will be of type L2ToL1MessageReader.
 * If T is of type Signer then L2ToL1MessageReaderOrWriter<T> will be of
 * type L2ToL1MessageWriter.
 */
export type L2ToL1MessageReaderOrWriter<
  T extends SignerOrProvider
> = T extends Provider ? L2ToL1MessageReader : L2ToL1MessageWriter

export class L2ToL1Message {
  // CHRIS: TODO: docs on these - update the constructor
  protected constructor(
    // CHRIS: TODO: update these params
    public readonly event: L2ToL1Event,
    public readonly rootHash: string,
    public readonly rootSize: BigNumber
  ) {}

  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    outboxAddress: string,
    event: L2ToL1Event,
    rootHash: string,
    rootSize: BigNumber
  ): L2ToL1MessageReaderOrWriter<T>
  public static fromEvent<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    outboxAddress: string,
    event: L2ToL1Event,
    rootHash: string,
    rootSize: BigNumber
  ): L2ToL1MessageReader | L2ToL1MessageWriter {
    return SignerProviderUtils.isSigner(l1SignerOrProvider)
      ? new L2ToL1MessageWriter(
          l1SignerOrProvider,
          outboxAddress,
          event,
          rootHash,
          rootSize
        )
      : new L2ToL1MessageReader(
          l1SignerOrProvider,
          outboxAddress,
          event,
          rootHash,

          rootSize
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
        throw new ArbTsError('More than one indexed item found in batch.')
      } else return []
    } else return events
  }
}

/**
 * Provides read-only access for l2-to-l1-messages
 */
export class L2ToL1MessageReader extends L2ToL1Message {
  constructor(
    protected readonly l1Provider: Provider,
    protected readonly outboxAddress: string,
    event: L2ToL1Event,
    rootHash: string,
    rootSize: BigNumber
  ) {
    super(event, rootHash, rootSize)
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
      return nodeInterface.lookupMessageBatchProof(batchNumber, indexInBatch)
    } catch (e) {
      const expectedError = "batch doesn't exist"
      const err = e as Error & { error: Error }
      const actualError =
        err && (err.message || (err.error && err.error.message))
      if (actualError.includes(expectedError)) return null
      else throw e
    }
  }

  public async getOutboxProof() {
    // CHRIS: TODO: proper ABI
    const nodeInterface = new ethers.Contract(
      NODE_INTERFACE_ADDRESS,
      [
        'function constructOutboxProof(bytes32 send, bytes32 root, uint64 size, uint64 leaf) external view',
      ],
      this.l1Provider
    )

    const outboxProofParams = await nodeInterface.callStatic[
      'constructOutboxProof'
    ](constants.HashZero, constants.HashZero, this.rootSize.toNumber(), this.event.position.toNumber())

    return outboxProofParams[2] as string[]
  }

  /**
   * Get the status of this message
   * In order to check if the message has been executed proof info must be provided.
   * @returns
   */
  public async status(): Promise<L2ToL1MessageStatus> {
    const outbox = new Contract(
      this.outboxAddress,
      [
        'function executeTransaction(bytes32[] calldata proof, uint256 index, address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes calldata data) public',
        'function spent(uint256) public view returns(bool)',
        'function roots(bytes32) public view returns(bytes32)',
      ],
      this.l1Provider
    )

    const l2BlockHash = await outbox['roots'](this.rootHash)
    // CHRIS: TODO: what to do with NOT_FOUND status?
    if (l2BlockHash === constants.HashZero) {
      return L2ToL1MessageStatus.UNCONFIRMED
    }

    const spent = await outbox['spent'](this.event.position)
    return spent ? L2ToL1MessageStatus.EXECUTED : L2ToL1MessageStatus.CONFIRMED
  }

  /**
   * Waits until the outbox entry has been created, and will not return until it has been.
   * WARNING: Outbox entries are only created when the corresponding node is confirmed. Which
   * can take 1 week+, so waiting here could be a very long operation.
   * @param retryDelay
   * @returns
   */
  public async waitUntilReadyForExecute(retryDelay = 500): Promise<void> {
    const status = await this.status()
    if (
      status === L2ToL1MessageStatus.CONFIRMED ||
      status === L2ToL1MessageStatus.EXECUTED
    ) {
      return
    } else {
      await wait(retryDelay)
      console.log("waiting for ready recurse", new Date(Date.now()).toUTCString())

      await this.waitUntilReadyForExecute(retryDelay)
    }
  }
}

/**
 * Provides read and write access for l2-to-l1-messages
 */
export class L2ToL1MessageWriter extends L2ToL1MessageReader {
  constructor(
    private readonly l1Signer: Signer,
    outboxAddress: string,
    event: L2ToL1Event,
    rootHash: string,
    rootSize: BigNumber
  ) {
    super(l1Signer.provider!, outboxAddress, event, rootHash, rootSize)
  }

  // CHRIS: TODO: do below
  // 1. send the withdrawal transaction
  // 2. look for the L2toL1Transaction event
  // 3. this should contain the block hash - use this getBlock()
  // 4. the mix hash of the block contains the the sendsRoot
  // 5. Using the send root and the index, form the path? how is that done? need all the sends}

  // CHRIS: TODO: update to below
  // 1. we need to calculate the send root somehow
  // 2. then check if that sendRoot has been populated
  // 3. if it has then we can execute

  // 4. unless the item has already been executed, this we can check
  // by looking to see if the specified index was spent

  /**
   * Executes the L2ToL1Message on L1.
   * Will throw an error if the outbox entry has not been created, which happens when the
   * corresponding assertion is confirmed.
   * @returns
   */
  public async execute(): Promise<ContractTransaction> {
    const status = await this.status()
    if (status !== L2ToL1MessageStatus.CONFIRMED) {
      throw new ArbTsError(
        `Cannot execute message. Status is: ${status} but must be ${L2ToL1MessageStatus.CONFIRMED}.`
      )
    }
    const proof = await this.getOutboxProof()
    console.log(proof)

    // CHRIS: TODO: proper ABI throughout this file - search for new Contract and new Interface?
    const outbox = new Contract(
      this.outboxAddress,
      [
        'function executeTransaction(   bytes32[] calldata proof,   uint256 index,   address l2Sender,   address to,   uint256 l2Block,   uint256 l1Block,   uint256 l2Timestamp,   uint256 value,   bytes calldata data) public',
        'function spent(uint256) public view returns(bool)',
        'function roots(bytes32) public view returns(bytes32)',
      ],
      this.l1Signer
    )

    // CHRIS: TODO: gas overrides?
    return await outbox['executeTransaction'](
      proof,
      this.event.position,
      this.event.caller,
      this.event.destination,
      this.event.arbBlockNum,
      this.event.ethBlockNum,
      this.event.timestamp,
      this.event.callvalue,
      this.event.data
    )
  }
}
