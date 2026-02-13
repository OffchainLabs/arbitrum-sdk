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

import { TransactionReceipt } from '@ethersproject/providers'
import { BigNumber } from '@ethersproject/bignumber'
import { Log } from '@ethersproject/abstract-provider'
import { ContractTransaction, providers } from 'ethers'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import {
  ChildToParentMessageReader,
  ChildToParentMessageReaderOrWriter,
  ChildToParentMessage,
  ChildToParentMessageWriter,
  ChildToParentTransactionEvent,
} from './ChildToParentMessage'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ArbRetryableTx__factory } from '../abi/factories/ArbRetryableTx__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { RedeemScheduledEvent } from '../abi/ArbRetryableTx'
import { ArbSdkError } from '../dataEntities/errors'
import {
  NODE_INTERFACE_ADDRESS,
  ARB_RETRYABLE_TX_ADDRESS,
} from '../dataEntities/constants'
import { EventArgs, parseTypedLogs } from '../dataEntities/event'
import { ArbitrumProvider } from '../utils/arbProvider'
import { Bridge__factory } from '../abi/factories/Bridge__factory'
import { SequencerInbox__factory } from '../abi/factories/SequencerInbox__factory'
import { EventFetcher } from '../utils/eventFetcher'
import { getArbitrumNetwork } from '../dataEntities/networks'
import { EthDepositMessage } from './ParentToChildMessage'

export interface ChildContractTransaction extends ContractTransaction {
  wait(confirmations?: number): Promise<ChildTransactionReceipt>
}

export interface RedeemTransaction extends ChildContractTransaction {
  waitForRedeem: () => Promise<TransactionReceipt>
}

/**
 * Extension of ethers-js TransactionReceipt, adding Arbitrum-specific functionality
 */
export class ChildTransactionReceipt implements TransactionReceipt {
  public readonly to: string
  public readonly from: string
  public readonly contractAddress: string
  public readonly transactionIndex: number
  public readonly root?: string
  public readonly gasUsed: BigNumber
  public readonly logsBloom: string
  public readonly blockHash: string
  public readonly transactionHash: string
  public readonly logs: Array<Log>
  public readonly blockNumber: number
  public readonly confirmations: number
  public readonly cumulativeGasUsed: BigNumber
  public readonly effectiveGasPrice: BigNumber
  public readonly byzantium: boolean
  public readonly type: number
  public readonly status?: number

  constructor(tx: TransactionReceipt) {
    this.to = tx.to
    this.from = tx.from
    this.contractAddress = tx.contractAddress
    this.transactionIndex = tx.transactionIndex
    this.root = tx.root
    this.gasUsed = tx.gasUsed
    this.logsBloom = tx.logsBloom
    this.blockHash = tx.blockHash
    this.transactionHash = tx.transactionHash
    this.logs = tx.logs
    this.blockNumber = tx.blockNumber
    this.confirmations = tx.confirmations
    this.cumulativeGasUsed = tx.cumulativeGasUsed
    this.effectiveGasPrice = tx.effectiveGasPrice
    this.byzantium = tx.byzantium
    this.type = tx.type
    this.status = tx.status
  }

  /**
   * Get {@link ChildToParentTransactionEvent} events created by this transaction
   * @returns
   */
  public getChildToParentEvents(): ChildToParentTransactionEvent[] {
    const classicLogs = parseTypedLogs(
      ArbSys__factory,
      this.logs,
      'L2ToL1Transaction'
    )
    const nitroLogs = parseTypedLogs(ArbSys__factory, this.logs, 'L2ToL1Tx')
    return [...classicLogs, ...nitroLogs]
  }

  /**
   * Get event data for any redeems that were scheduled in this transaction
   * @returns
   */
  public getRedeemScheduledEvents(): EventArgs<RedeemScheduledEvent>[] {
    return parseTypedLogs(ArbRetryableTx__factory, this.logs, 'RedeemScheduled')
  }

  /**
   * Get any child-to-parent-messages created by this transaction
   * @param parentSignerOrProvider
   */
  public async getChildToParentMessages<T extends SignerOrProvider>(
    parentSignerOrProvider: T
  ): Promise<ChildToParentMessageReaderOrWriter<T>[]>
  public async getChildToParentMessages<T extends SignerOrProvider>(
    parentSignerOrProvider: T
  ): Promise<ChildToParentMessageReader[] | ChildToParentMessageWriter[]> {
    const provider = SignerProviderUtils.getProvider(parentSignerOrProvider)
    if (!provider) throw new ArbSdkError('Signer not connected to provider.')

    return this.getChildToParentEvents().map(log =>
      ChildToParentMessage.fromEvent(parentSignerOrProvider, log)
    )
  }

  /**
   * Get number of parent chain confirmations that the batch including this tx has
   * @param childProvider
   * @returns number of confirmations of batch including tx, or 0 if no batch included this tx
   */
  public getBatchConfirmations(childProvider: providers.JsonRpcProvider) {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )
    return nodeInterface.getL1Confirmations(this.blockHash)
  }

  /**
   * Get the number of the batch that included this tx (will throw if no such batch exists)
   * @param childProvider
   * @returns number of batch in which tx was included, or errors if no batch includes the current tx
   */
  public async getBatchNumber(childProvider: providers.JsonRpcProvider) {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )
    const arbProvider = new ArbitrumProvider(childProvider)
    const rec = await arbProvider.getTransactionReceipt(this.transactionHash)
    if (rec == null)
      throw new ArbSdkError(
        'No receipt receipt available for current transaction'
      )
    // findBatchContainingBlock errors if block number does not exist
    return nodeInterface.findBatchContainingBlock(rec.blockNumber)
  }

  /**
   * Whether the data associated with this transaction has been
   * made available on parent chain
   * @param childProvider
   * @param confirmations The number of confirmations on the batch before data is to be considered available
   * @returns
   */
  public async isDataAvailable(
    childProvider: providers.JsonRpcProvider,
    confirmations = 10
  ): Promise<boolean> {
    const res = await this.getBatchConfirmations(childProvider)
    // is there a batch with enough confirmations
    return res.toNumber() > confirmations
  }

  /**
   * Given a child chain tx that is a retryable redeem or retryable ticket,
   * trace back to the parent chain transaction that originated it.
   * @param childProvider Provider for the child chain
   * @param parentProvider Provider for the parent chain
   * @returns The parent chain transaction hash, or null if unable to trace
   */
  public async getParentTransactionHash(
    childProvider: providers.Provider,
    parentProvider: providers.Provider
  ): Promise<string | null> {
    // Step 1: Find the retryable ticket hash
    // Check if this tx is a redeem by querying RedeemScheduled events
    // where retryTxHash (2nd indexed param) matches this tx hash
    const childEventFetcher = new EventFetcher(childProvider)
    const redeemScheduledEvents = await childEventFetcher.getEvents(
      ArbRetryableTx__factory,
      contract => contract.filters.RedeemScheduled(null, this.transactionHash),
      {
        fromBlock: 0,
        toBlock: 'latest',
        address: ARB_RETRYABLE_TX_ADDRESS,
      }
    )

    let ticketId: string
    if (redeemScheduledEvents.length > 0) {
      // This is a redeemed message - get the ticketId
      ticketId = redeemScheduledEvents[0].event.ticketId
    } else {
      // Assume this tx IS the retryable ticket
      ticketId = this.transactionHash
    }

    // Step 2: Extract requestId from the retryable ticket tx data
    const tx = await childProvider.getTransaction(ticketId)
    if (!tx) return null

    let requestId: string
    try {
      const parsed =
        ArbRetryableTx__factory.createInterface().parseTransaction(tx)
      requestId = parsed.args.requestId
    } catch {
      // Not a retryable ticket tx
      return null
    }

    // Step 3: Find the parent chain tx via Bridge.MessageDelivered
    const network = await getArbitrumNetwork(childProvider)
    const parentEventFetcher = new EventFetcher(parentProvider)
    const messageDeliveredEvents = await parentEventFetcher.getEvents(
      Bridge__factory,
      contract => contract.filters.MessageDelivered(BigNumber.from(requestId)),
      {
        fromBlock: 0,
        toBlock: 'latest',
        address: network.ethBridge.bridge,
      }
    )

    if (messageDeliveredEvents.length === 0) return null
    return messageDeliveredEvents[0].transactionHash
  }

  /**
   * Given a child chain tx that is an ETH deposit (type 0x64),
   * trace back to the parent chain transaction that originated it.
   * Only works for standard ETH deposits (not custom gas token chains).
   * @param childProvider JsonRpcProvider for the child chain (needed for getBatchNumber)
   * @param parentProvider Provider for the parent chain
   * @returns The parent chain transaction hash, or null if unable to trace
   */
  public async getParentDepositTransactionHash(
    childProvider: providers.JsonRpcProvider,
    parentProvider: providers.Provider
  ): Promise<string | null> {
    // Step 1: Get child tx details
    const tx = await childProvider.getTransaction(this.transactionHash)
    if (!tx) return null

    const chainId = (await childProvider.getNetwork()).chainId

    // Step 2: Get batch number and network config
    const batchNum = await this.getBatchNumber(childProvider)
    const network = await getArbitrumNetwork(childProvider)

    // Step 3: Get delayed message range for this batch
    const parentEventFetcher = new EventFetcher(parentProvider)

    const currentBatchEvents = await parentEventFetcher.getEvents(
      SequencerInbox__factory,
      contract => contract.filters.SequencerBatchDelivered(batchNum),
      {
        fromBlock: 0,
        toBlock: 'latest',
        address: network.ethBridge.sequencerInbox,
      }
    )
    if (currentBatchEvents.length === 0) return null

    const afterDelayedMessagesRead =
      currentBatchEvents[0].event.afterDelayedMessagesRead

    let prevAfterDelayed: BigNumber
    if (batchNum.eq(0)) {
      prevAfterDelayed = BigNumber.from(0)
    } else {
      const prevBatchEvents = await parentEventFetcher.getEvents(
        SequencerInbox__factory,
        contract =>
          contract.filters.SequencerBatchDelivered(batchNum.sub(1)),
        {
          fromBlock: 0,
          toBlock: 'latest',
          address: network.ethBridge.sequencerInbox,
        }
      )
      if (prevBatchEvents.length === 0) return null
      prevAfterDelayed = prevBatchEvents[0].event.afterDelayedMessagesRead
    }

    // Step 4: Local hash computation to find the messageNumber
    let foundMessageNumber: BigNumber | null = null
    for (
      let i = prevAfterDelayed;
      i.lt(afterDelayedMessagesRead);
      i = i.add(1)
    ) {
      const hash = EthDepositMessage.calculateDepositTxId(
        chainId,
        i,
        tx.from,
        tx.to!,
        tx.value
      )
      if (hash === this.transactionHash) {
        foundMessageNumber = i
        break
      }
    }

    if (!foundMessageNumber) return null

    // Step 5: Find parent tx via Bridge.MessageDelivered
    const messageDeliveredEvents = await parentEventFetcher.getEvents(
      Bridge__factory,
      contract => contract.filters.MessageDelivered(foundMessageNumber!),
      {
        fromBlock: 0,
        toBlock: 'latest',
        address: network.ethBridge.bridge,
      }
    )

    if (messageDeliveredEvents.length === 0) return null
    return messageDeliveredEvents[0].transactionHash
  }

  /**
   * Replaces the wait function with one that returns an L2TransactionReceipt
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): ChildContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (_confirmations?: number) => {
      // we ignore the confirmations for now since child chain transactions shouldn't re-org
      // in future we should give users a more fine grained way to check the finality of
      // an child chain transaction - check if a batch is on a parent chain, if an assertion has been made, and if
      // it has been confirmed.
      const result = await wait()
      return new ChildTransactionReceipt(result)
    }
    return contractTransaction as ChildContractTransaction
  }

  /**
   * Adds a waitForRedeem function to a redeem transaction
   * @param redeemTx
   * @param childProvider
   * @returns
   */
  public static toRedeemTransaction(
    redeemTx: ChildContractTransaction,
    childProvider: providers.Provider
  ): RedeemTransaction {
    const returnRec = redeemTx as RedeemTransaction
    returnRec.waitForRedeem = async () => {
      const rec = await redeemTx.wait()

      const redeemScheduledEvents = await rec.getRedeemScheduledEvents()

      if (redeemScheduledEvents.length !== 1) {
        throw new ArbSdkError(
          `Transaction is not a redeem transaction: ${rec.transactionHash}`
        )
      }

      return await childProvider.getTransactionReceipt(
        redeemScheduledEvents[0].retryTxHash
      )
    }
    return returnRec
  }
}
