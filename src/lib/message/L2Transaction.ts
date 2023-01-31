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
  L2ToL1MessageReader,
  L2ToL1MessageReaderOrWriter,
  L2ToL1Message,
  L2ToL1MessageWriter,
  L2ToL1TransactionEvent,
} from './L2ToL1Message'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ArbRetryableTx__factory } from '../abi/factories/ArbRetryableTx__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { RedeemScheduledEvent } from '../abi/ArbRetryableTx'
import { ArbSdkError } from '../dataEntities/errors'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { EventArgs, parseTypedLogs } from '../dataEntities/event'
import { ArbitrumProvider } from '../utils/arbProvider'

export interface L2ContractTransaction extends ContractTransaction {
  wait(confirmations?: number): Promise<L2TransactionReceipt>
}

export interface RedeemTransaction extends L2ContractTransaction {
  waitForRedeem: () => Promise<TransactionReceipt>
}

/**
 * Extension of ethers-js TransactionReceipt, adding Arbitrum-specific functionality
 */
export class L2TransactionReceipt implements TransactionReceipt {
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
   * Get an L2ToL1TxEvent events created by this transaction
   * @returns
   */
  public getL2ToL1Events(): L2ToL1TransactionEvent[] {
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
   * Get any l2-to-l1-messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getL2ToL1Messages<T extends SignerOrProvider>(
    l1SignerOrProvider: T
  ): Promise<L2ToL1MessageReaderOrWriter<T>[]>
  public async getL2ToL1Messages<T extends SignerOrProvider>(
    l1SignerOrProvider: T
  ): Promise<L2ToL1MessageReader[] | L2ToL1MessageWriter[]> {
    const provider = SignerProviderUtils.getProvider(l1SignerOrProvider)
    if (!provider) throw new ArbSdkError('Signer not connected to provider.')

    return this.getL2ToL1Events().map(log =>
      L2ToL1Message.fromEvent(l1SignerOrProvider, log)
    )
  }

  /**
   * Get number of L1 confirmations that the batch including this tx has
   * @param l2Provider
   * @returns number of confirmations of batch including tx, or 0 if no batch included this tx
   */
  public getBatchConfirmations(l2Provider: providers.JsonRpcProvider) {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
    )
    return nodeInterface.getL1Confirmations(this.blockHash)
  }

  /**
   * Get the number of the batch that included this tx (will throw if no such batch exists)
   * @param l2Provider
   * @returns number of batch in which tx was included, or errors if no batch includes the current tx
   */
  public async getBatchNumber(l2Provider: providers.JsonRpcProvider) {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
    )
    const arbProvider = new ArbitrumProvider(l2Provider)
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
   * made available on L1
   * @param l2Provider
   * @param confirmations The number of confirmations on the batch before data is to be considered available
   * @returns
   */
  public async isDataAvailable(
    l2Provider: providers.JsonRpcProvider,
    confirmations = 10
  ): Promise<boolean> {
    const res = await this.getBatchConfirmations(l2Provider)
    // is there a batch with enough confirmations
    return res.toNumber() > confirmations
  }

  /**
   * Replaces the wait function with one that returns an L2TransactionReceipt
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): L2ContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (_confirmations?: number) => {
      // we ignore the confirmations for now since L2 transactions shouldn't re-org
      // in future we should give users a more fine grained way to check the finality of
      // an l2 transaction - check if a batch is on L1, if an assertion has been made, and if
      // it has been confirmed.
      const result = await wait()
      return new L2TransactionReceipt(result)
    }
    return contractTransaction as L2ContractTransaction
  }

  /**
   * Adds a waitForRedeem function to a redeem transaction
   * @param redeemTx
   * @param l2Provider
   * @returns
   */
  public static toRedeemTransaction(
    redeemTx: L2ContractTransaction,
    l2Provider: providers.Provider
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

      return await l2Provider.getTransactionReceipt(
        redeemScheduledEvents[0].retryTxHash
      )
    }
    return returnRec
  }
}
