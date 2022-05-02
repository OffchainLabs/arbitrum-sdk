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
import { Log, Provider } from '@ethersproject/abstract-provider'
import { ContractTransaction, providers } from 'ethers'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'
import { L2ToL1Message } from './L2ToL1Message'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { L2ToL1TransactionEvent } from '../abi/ArbSys'

import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  convertNetwork,
  isNitroL1,
  IL2ToL1MessageReader,
  IL2ToL1MessageWriter,
  IL2ToL1MessageReaderOrWriter,
  waitForL2NetworkUpdate,
} from '../utils/migration_types'
import { getL2Network, getOutboxAddr } from '../dataEntities/networks'

export interface L2ContractTransaction extends ContractTransaction {
  wait(confirmations?: number): Promise<L2TransactionReceipt>
}

export interface RedeemTransaction extends L2ContractTransaction {
  waitForRedeem: () => Promise<TransactionReceipt>
}

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

  private readonly classicReceipt: classic.L2TransactionReceipt
  private readonly nitroReceipt: nitro.L2TransactionReceipt

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

    this.classicReceipt = new classic.L2TransactionReceipt(tx)
    this.nitroReceipt = new nitro.L2TransactionReceipt(tx)
  }

  /**
   * Get an L2ToL1Transaction events created by this transaction
   * @returns
   */
  public getL2ToL1Events(): L2ToL1TransactionEvent['args'][] {
    const iface = ArbSys__factory.createInterface()
    const l2ToL1Event = iface.getEvent('L2ToL1Transaction')
    const eventTopic = iface.getEventTopic(l2ToL1Event)
    const logs = this.logs.filter(log => log.topics[0] === eventTopic)

    return logs.map(
      log => iface.parseLog(log).args as L2ToL1TransactionEvent['args']
    )
  }

  /**
   * Get any l2-to-l1-messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getL2ToL1Messages<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    l2Provider: Provider
  ): Promise<IL2ToL1MessageReaderOrWriter<T>[]>
  public async getL2ToL1Messages<T extends SignerOrProvider>(
    l1SignerOrProvider: T,
    l2Provider: Provider
  ): Promise<IL2ToL1MessageReader[] | IL2ToL1MessageWriter[]> {
    if (await isNitroL1(l1SignerOrProvider)) {
      // we cant process a withdrawal until we have the new outbox address
      // so we need to ensure the network object has been updated
      await waitForL2NetworkUpdate(
        SignerProviderUtils.getProviderOrThrow(l1SignerOrProvider),
        l2Provider
      )

      return this.nitroReceipt.getL2ToL1Messages(l1SignerOrProvider)
    } else {
      const l2Network = await getL2Network(l2Provider)
      const messages = await this.classicReceipt.getL2ToL1Messages(
        l1SignerOrProvider,
        convertNetwork(l2Network)
      )

      return messages.map(m => {
        const outboxAddr = getOutboxAddr(l2Network, m.batchNumber.toNumber())
        return L2ToL1Message.fromEvent(
          l1SignerOrProvider,
          undefined,
          outboxAddr,
          m.batchNumber,
          m.indexInBatch
        )
      })
    }
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
    l1Provider: providers.JsonRpcProvider,
    confirmations = 10
  ): Promise<boolean> {
    if (await isNitroL1(l1Provider)) {
      return this.nitroReceipt.isDataAvailable(l2Provider, confirmations)
    } else {
      return this.classicReceipt.isDataAvailable(l2Provider, l1Provider)
    }
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
}
