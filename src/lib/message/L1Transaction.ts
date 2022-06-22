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
import { Log } from '@ethersproject/abstract-provider'
import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber } from '@ethersproject/bignumber'
import { Provider } from '@ethersproject/abstract-provider'
import {
  L1ToL2Message,
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from './L1ToL2Message'

import { L1ERC20Gateway__factory } from '../abi/factories/L1ERC20Gateway__factory'
import { DepositInitiatedEvent } from '../abi/L1ERC20Gateway'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'
import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import { L1EthDepositTransactionReceipt as NitroL1EthDepositTransactionReceipt } from '@arbitrum/sdk-nitro/dist/lib/message/L1Transaction'
import { EthDepositMessageWaitResult as NitroEthDepositMessageWaitResult } from '@arbitrum/sdk-nitro/dist/lib/message/L1ToL2Message'
import { L1EthDepositTransactionReceipt as ClassicL1EthDepositTransactionReceipt } from '@arbitrum/sdk-classic/dist/lib/message/L1Transaction'
import {
  isNitroL2,
  IL1ToL2MessageReaderOrWriter,
  IL1ToL2MessageReader,
  IL1ToL2MessageWriter,
  toNitroEthDepositMessage,
  EthDepositMessage,
} from '../utils/migration_types'
import { ArbSdkError } from '../dataEntities/errors'

export interface L1ContractTransaction<
  TReceipt extends L1TransactionReceipt = L1TransactionReceipt
> extends ContractTransaction {
  wait(confirmations?: number): Promise<TReceipt>
}
// some helper interfaces to reduce the verbosity elsewhere
export type L1EthDepositTransaction =
  L1ContractTransaction<L1EthDepositTransactionReceipt>
export type L1ContractCallTransaction =
  L1ContractTransaction<L1ContractCallTransactionReceipt>

export class L1TransactionReceipt implements TransactionReceipt {
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

  private readonly classicReceipt: classic.L1TransactionReceipt
  private readonly nitroReceipt: nitro.L1TransactionReceipt

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

    this.classicReceipt = new classic.L1TransactionReceipt(tx)
    this.nitroReceipt = new nitro.L1TransactionReceipt(tx)
  }

  private async looksLikeEthDeposit(message: classic.L1ToL2MessageReader) {
    const inputs = await message.getInputs()
    return (
      inputs.maxGas.eq(0) &&
      inputs.gasPriceBid.eq(0) &&
      inputs.callDataLength.eq(0)
    )
  }

  /**
   * Get any eth deposit messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getEthDepositMessages(
    l2SignerOrProvider: SignerOrProvider
  ): Promise<EthDepositMessage[]> {
    if (await isNitroL2(l2SignerOrProvider)) {
      return this.nitroReceipt.getEthDepositMessages(
        SignerProviderUtils.getProviderOrThrow(l2SignerOrProvider)
      )
    } else {
      // get all the l1tol2messages that are eth deposits
      const l1ToL2Messages = await this.classicReceipt.getL1ToL2Messages(
        l2SignerOrProvider
      )

      const typedMessages = await Promise.all(
        l1ToL2Messages.map(async l => ({
          isEthDeposit: await this.looksLikeEthDeposit(l),
          message: l,
        }))
      )

      const chainId = (
        await SignerProviderUtils.getProviderOrThrow(
          l2SignerOrProvider
        ).getNetwork()
      ).chainId

      return Promise.all(
        typedMessages
          .filter(t => t.isEthDeposit)
          .map(async t => await toNitroEthDepositMessage(t.message, chainId))
      )
    }
  }

  /**
   * Get any l1tol2 messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getL1ToL2Messages<T extends SignerOrProvider>(
    l2SignerOrProvider: T
  ): Promise<IL1ToL2MessageReaderOrWriter<T>[]>
  public async getL1ToL2Messages<T extends SignerOrProvider>(
    l2SignerOrProvider: T
  ): Promise<IL1ToL2MessageReader[] | IL1ToL2MessageWriter[]> {
    if (await isNitroL2(l2SignerOrProvider)) {
      return (
        await this.nitroReceipt.getL1ToL2Messages(l2SignerOrProvider)
      ).map(r => L1ToL2Message.fromNitro(r))
    } else {
      // get all the l1tol2messages that are not eth deposits
      const l1ToL2Messages = await this.classicReceipt.getL1ToL2Messages(
        l2SignerOrProvider
      )

      const typedMessages = await Promise.all(
        l1ToL2Messages.map(async l => ({
          isEthDeposit: await this.looksLikeEthDeposit(l),
          message: l,
        }))
      )

      return Promise.all(
        typedMessages.filter(t => !t.isEthDeposit).map(t => t.message)
      )
    }
  }

  /**
   * Gets a single l1ToL2Message
   * If the messageIndex is supplied the message at that index will be returned.
   * If no messageIndex is supplied a message will be returned if this transaction only created one message
   * All other cases throw an error
   * @param l2SignerOrProvider
   */
  public async getL1ToL2Message<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    messageNumberIndex?: number
  ): Promise<IL1ToL2MessageReaderOrWriter<T>>
  public async getL1ToL2Message<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    messageIndex?: number
  ): Promise<IL1ToL2MessageReader | IL1ToL2MessageWriter> {
    const message = (await this.getL1ToL2Messages(l2SignerOrProvider))[messageIndex || 0]
    if(message == undefined) throw new ArbSdkError(`No message found for index: ${messageIndex || 0}`)
    return message
  }

  /**
   * Get any token deposit events created by this transaction
   * @returns
   */
  public getTokenDepositEvents(): DepositInitiatedEvent['args'][] {
    const iface = L1ERC20Gateway__factory.createInterface()
    const event = iface.getEvent('DepositInitiated')
    const eventTopic = iface.getEventTopic(event)
    const logs = this.logs.filter(log => log.topics[0] === eventTopic)
    return logs.map(
      log => iface.parseLog(log).args as DepositInitiatedEvent['args']
    )
  }

  /**
   * Replaces the wait function with one that returns an L1TransactionReceipt
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): L1ContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new L1TransactionReceipt(result)
    }
    return contractTransaction as L1ContractTransaction
  }

  /**
   * Replaces the wait function with one that returns an L1EthDepositTransactionReceipt
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchEthDepositWait = (
    contractTransaction: ContractTransaction
  ): L1EthDepositTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new L1EthDepositTransactionReceipt(result)
    }
    return contractTransaction as L1EthDepositTransaction
  }

  /**
   * Replaces the wait function with one that returns an L1ContractCallTransactionReceipt
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchContractCallWait = (
    contractTransaction: ContractTransaction
  ): L1ContractCallTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new L1ContractCallTransactionReceipt(result)
    }
    return contractTransaction as L1ContractCallTransaction
  }
}

/**
 * An L1TransactionReceipt with additional functionality that only exists
 * if the transaction created a single eth deposit.
 */
export class L1EthDepositTransactionReceipt extends L1TransactionReceipt {
  /**
   * Wait for the funds to arrive on L2
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on L2. Throws on timeout.
   * @returns The wait result contains `complete`, a `status`, the L1ToL2Message and optionally the `l2TxReceipt`
   * If `complete` is true then this message is in the terminal state.
   * For eth deposits complete this is when the status is FUNDS_DEPOSITED, EXPIRED or REDEEMED.
   */
  public async waitForL2(
    l2Provider: Provider,
    confirmations?: number,
    timeout = 900000
  ): Promise<
    {
      complete: boolean
      message: EthDepositMessage
    } & NitroEthDepositMessageWaitResult
  > {
    if (await isNitroL2(l2Provider)) {
      const receipt = new NitroL1EthDepositTransactionReceipt(this)
      return await receipt.waitForL2(l2Provider, confirmations, timeout)
    } else {
      const receipt = new ClassicL1EthDepositTransactionReceipt(this)
      const classicWaitRes = await receipt.waitForL2(
        l2Provider,
        confirmations,
        timeout
      )
      const ethDepositMessage = await toNitroEthDepositMessage(
        classicWaitRes.message,
        (
          await l2Provider.getNetwork()
        ).chainId
      )
      const txReceipt = await ethDepositMessage.wait()
      return {
        message: ethDepositMessage,
        complete: classicWaitRes.complete,
        l2TxReceipt: txReceipt,
      }
    }
  }
}

/**
 * An L1TransactionReceipt with additional functionality that only exists
 * if the transaction created a single call to an L2 contract - this includes
 * token deposits.
 */
export class L1ContractCallTransactionReceipt extends L1TransactionReceipt {
  /**
   * Wait for the transaction to arrive and be executed on L2
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on L2. Throws on timeout.
   * @returns The wait result contains `complete`, a `status`, an L1ToL2Message and optionally the `l2TxReceipt`.
   * If `complete` is true then this message is in the terminal state.
   * For contract calls this is true only if the status is REDEEMED.
   */
  public async waitForL2<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    confirmations?: number,
    timeout = 900000
  ): Promise<
    {
      complete: boolean
      message: IL1ToL2MessageReaderOrWriter<T>
    } & L1ToL2MessageWaitResult
  > {
    const message = (await this.getL1ToL2Messages(l2SignerOrProvider))[0]
    const res = await message.waitForStatus(confirmations, timeout)

    return {
      complete: res.status === L1ToL2MessageStatus.REDEEMED,
      ...res,
      message,
    }
  }
}
