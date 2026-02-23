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
import { EventFetcher } from '../utils/eventFetcher'
import { getArbitrumNetwork } from '../dataEntities/networks'
import { isArbitrumChain } from '../utils/lib'

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
  private static readonly PARENT_EVENT_QUERY_CHUNK_SIZE = 1000
  private static readonly PARENT_EVENT_LOOKBACK_BLOCKS =
    ChildTransactionReceipt.PARENT_EVENT_QUERY_CHUNK_SIZE
  private static readonly PARENT_EVENT_FALLBACK_LOOKBACK_BLOCKS = 100000

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
   * Get the parent chain block range for querying events.
   * For Arbitrum parent chains, maps base-layer block numbers to
   * the corresponding parent chain block range.
   */
  private async getParentEventBlockRange(
    childProvider: providers.Provider,
    parentProvider: providers.Provider
  ): Promise<{ fromBlock: number; toBlock: number }> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )
    const l1BlockNum = await nodeInterface.blockL1Num(this.blockNumber)
    const l1Block = BigNumber.from(l1BlockNum).toNumber()

    if (await isArbitrumChain(parentProvider)) {
      const parentNodeInterface = NodeInterface__factory.connect(
        NODE_INTERFACE_ADDRESS,
        parentProvider
      )
      try {
        const [upperRange, lowerRange] = await Promise.all([
          parentNodeInterface.l2BlockRangeForL1(l1Block),
          parentNodeInterface.l2BlockRangeForL1(
            Math.max(
              0,
              l1Block - ChildTransactionReceipt.PARENT_EVENT_LOOKBACK_BLOCKS
            )
          ),
        ])
        return {
          fromBlock: lowerRange.firstBlock.toNumber(),
          toBlock: upperRange.lastBlock.toNumber(),
        }
      } catch {
        const latestBlock = await parentProvider.getBlockNumber()
        return {
          fromBlock: Math.max(
            0,
            latestBlock -
              ChildTransactionReceipt.PARENT_EVENT_FALLBACK_LOOKBACK_BLOCKS
          ),
          toBlock: latestBlock,
        }
      }
    }

    return {
      fromBlock: Math.max(
        0,
        l1Block - ChildTransactionReceipt.PARENT_EVENT_LOOKBACK_BLOCKS
      ),
      toBlock: l1Block,
    }
  }

  /**
   * Query Bridge.MessageDelivered in bounded chunks to avoid providers
   * rejecting very large getLogs block ranges.
   */
  private async findMessageDeliveredTransactionHash(
    parentEventFetcher: EventFetcher,
    messageNumber: BigNumber,
    bridgeAddress: string,
    blockRange: { fromBlock: number; toBlock: number }
  ): Promise<string | null> {
    let chunkSize = ChildTransactionReceipt.PARENT_EVENT_QUERY_CHUNK_SIZE
    let currentTo = blockRange.toBlock

    while (currentTo >= blockRange.fromBlock) {
      const currentFrom = Math.max(
        blockRange.fromBlock,
        currentTo - chunkSize + 1
      )

      try {
        const events = await parentEventFetcher.getEvents(
          Bridge__factory,
          contract => contract.filters.MessageDelivered(messageNumber),
          {
            fromBlock: currentFrom,
            toBlock: currentTo,
            address: bridgeAddress,
          }
        )

        if (events.length > 0) {
          // getLogs returns ascending order; use the highest block in this chunk.
          return events[events.length - 1].transactionHash
        }

        currentTo = currentFrom - 1
      } catch (error) {
        // Some providers cap block range size; retry same interval with smaller chunks.
        if (chunkSize <= 1) throw error
        chunkSize = Math.max(1, Math.floor(chunkSize / 2))
      }
    }

    return null
  }

  /**
   * Fetches the requestId (messageNumber) from a Nitro typed transaction
   * using the standard eth_getTransactionByHash RPC method. Nitro nodes
   * include a `requestId` field in the response for typed transactions
   * (0x64 ETH deposits, 0x69 submit retryable). The requestId is the
   * messageNumber zero-padded to 32 bytes.
   *
   * This approach works on Nitro-based Arbitrum chains
   * without requiring the non-standard eth_getRawTransactionByHash method.
   */
  private static async getMessageNumber(
    childProvider: providers.Provider,
    txHash: string,
    expectedType: string
  ): Promise<BigNumber | null> {
    const rpcProvider = childProvider as providers.JsonRpcProvider
    if (typeof rpcProvider.send !== 'function') return null
    const tx = await rpcProvider.send('eth_getTransactionByHash', [txHash])
    if (!tx || tx.type !== expectedType) return null
    if (!tx.requestId) return null
    return BigNumber.from(tx.requestId)
  }

  /**
   * Given a child chain tx that is a retryable redeem or retryable ticket
   * creation, trace back to the parent chain transaction that originated it.
   * @param childProvider Provider for the child chain
   * @param parentProvider Provider for the parent chain
   * @returns The parent chain transaction hash, or null if not traceable
   */
  public async getParentTransactionHash(
    childProvider: providers.Provider,
    parentProvider: providers.Provider
  ): Promise<string | null> {
    // If this is a redeem, find the ticket creation tx via RedeemScheduled
    const childEventFetcher = new EventFetcher(childProvider)
    const redeemScheduledEvents = await childEventFetcher.getEvents(
      ArbRetryableTx__factory,
      contract => contract.filters.RedeemScheduled(null, this.transactionHash),
      {
        fromBlock: this.blockNumber,
        toBlock: this.blockNumber,
        address: ARB_RETRYABLE_TX_ADDRESS,
      }
    )

    const ticketId =
      redeemScheduledEvents.length > 0
        ? redeemScheduledEvents[0].event.ticketId
        : this.transactionHash

    // Get the messageNumber from the ticket creation tx (type 0x69)
    const messageNumber = await ChildTransactionReceipt.getMessageNumber(
      childProvider,
      ticketId,
      '0x69'
    )
    if (!messageNumber) return null

    // Query Bridge.MessageDelivered filtered by messageNumber
    const [network, blockRange] = await Promise.all([
      getArbitrumNetwork(childProvider),
      this.getParentEventBlockRange(childProvider, parentProvider),
    ])

    const parentEventFetcher = new EventFetcher(parentProvider)
    return this.findMessageDeliveredTransactionHash(
      parentEventFetcher,
      messageNumber,
      network.ethBridge.bridge,
      blockRange
    )
  }

  /**
   * Given a child chain tx that is an ETH deposit (type 0x64),
   * trace back to the parent chain transaction that originated it.
   * @param childProvider Provider for the child chain
   * @param parentProvider Provider for the parent chain
   * @returns The parent chain transaction hash, or null if not traceable
   */
  public async getParentDepositTransactionHash(
    childProvider: providers.Provider,
    parentProvider: providers.Provider
  ): Promise<string | null> {
    // Get the messageNumber from the deposit tx (type 0x64)
    const messageNumber = await ChildTransactionReceipt.getMessageNumber(
      childProvider,
      this.transactionHash,
      '0x64'
    )
    if (!messageNumber) return null

    // Query Bridge.MessageDelivered filtered by messageNumber
    const [network, blockRange] = await Promise.all([
      getArbitrumNetwork(childProvider),
      this.getParentEventBlockRange(childProvider, parentProvider),
    ])

    const parentEventFetcher = new EventFetcher(parentProvider)
    return this.findMessageDeliveredTransactionHash(
      parentEventFetcher,
      messageNumber,
      network.ethBridge.bridge,
      blockRange
    )
  }

  /**
   * Replaces the wait function with one that returns a ChildTransactionReceipt
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
