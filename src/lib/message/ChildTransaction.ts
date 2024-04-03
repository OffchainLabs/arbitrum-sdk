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
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { EventArgs, parseTypedLogs } from '../dataEntities/event'
import { ArbitrumProvider } from '../utils/arbProvider'

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
   * Get an ChildToParentTxEvent events created by this transaction
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
   * @param l2SignerOrProvider
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
