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
import { Log, Provider } from '@ethersproject/abstract-provider'
import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber } from '@ethersproject/bignumber'
import {
  L1ToL2Message,
  L1ToL2MessageReaderOrWriter,
  L1ToL2MessageReader,
  L1ToL2MessageReaderClassic,
  L1ToL2MessageWriter,
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
  EthDepositMessage,
  EthDepositMessageWaitResult,
} from './L1ToL2Message'

import { L1ERC20Gateway__factory } from '../abi/factories/L1ERC20Gateway__factory'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { InboxMessageDeliveredEvent } from '../abi/Inbox'
import { InboxMessageKind } from '../dataEntities/message'
import { Bridge__factory } from '../abi/factories/Bridge__factory'
import { MessageDeliveredEvent } from '../abi/Bridge'
import { EventArgs, parseTypedLogs } from '../dataEntities/event'
import { isDefined } from '../utils/lib'
import { SubmitRetryableMessageDataParser } from './messageDataParser'
import { getL2Network } from '../dataEntities/networks'

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
   * Check if is a classic transaction
   * @param l2SignerOrProvider
   */
  public async isClassic<T extends SignerOrProvider>(
    l2SignerOrProvider: T
  ): Promise<boolean> {
    const provider = SignerProviderUtils.getProviderOrThrow(l2SignerOrProvider)
    const network = await getL2Network(provider)
    return this.blockNumber < network.nitroGenesisL1Block
  }

  /**
   * Get any MessageDelivered events that were emitted during this transaction
   * @returns
   */
  public getMessageDeliveredEvents(): EventArgs<MessageDeliveredEvent>[] {
    return parseTypedLogs(Bridge__factory, this.logs, 'MessageDelivered')
  }

  /**
   * Get any InboxMessageDelivered events that were emitted during this transaction
   * @returns
   */
  public getInboxMessageDeliveredEvents() {
    return parseTypedLogs(
      Inbox__factory,
      this.logs,
      'InboxMessageDelivered(uint256,bytes)'
    )
  }

  /**
   * Get combined data for any InboxMessageDelivered and MessageDelivered events
   * emitted during this transaction
   * @returns
   */
  public getMessageEvents(): {
    inboxMessageEvent: EventArgs<InboxMessageDeliveredEvent>
    bridgeMessageEvent: EventArgs<MessageDeliveredEvent>
  }[] {
    const bridgeMessages = this.getMessageDeliveredEvents()
    const inboxMessages = this.getInboxMessageDeliveredEvents()

    if (bridgeMessages.length !== inboxMessages.length) {
      throw new ArbSdkError(
        `Unexpected missing events. Inbox message count: ${
          inboxMessages.length
        } does not equal bridge message count: ${
          bridgeMessages.length
        }. ${JSON.stringify(inboxMessages)} ${JSON.stringify(bridgeMessages)}`
      )
    }

    const messages: {
      inboxMessageEvent: EventArgs<InboxMessageDeliveredEvent>
      bridgeMessageEvent: EventArgs<MessageDeliveredEvent>
    }[] = []
    for (const bm of bridgeMessages) {
      const im = inboxMessages.filter(i => i.messageNum.eq(bm.messageIndex))[0]
      if (!im) {
        throw new ArbSdkError(
          `Unexepected missing event for message index: ${bm.messageIndex.toString()}. ${JSON.stringify(
            inboxMessages
          )}`
        )
      }

      messages.push({
        inboxMessageEvent: im,
        bridgeMessageEvent: bm,
      })
    }

    return messages
  }

  /**
   * Get any eth deposit messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getEthDeposits(
    l2Provider: Provider
  ): Promise<EthDepositMessage[]> {
    return Promise.all(
      this.getMessageEvents()
        .filter(
          e =>
            e.bridgeMessageEvent.kind ===
            InboxMessageKind.L1MessageType_ethDeposit
        )
        .map(m =>
          EthDepositMessage.fromEventComponents(
            l2Provider,
            m.inboxMessageEvent.messageNum,
            m.bridgeMessageEvent.sender,
            m.inboxMessageEvent.data
          )
        )
    )
  }

  /**
   * Get classic l1tol2 messages created by this transaction
   * @param l2Provider
   */
  public async getL1ToL2MessagesClassic(
    l2Provider: Provider
  ): Promise<L1ToL2MessageReaderClassic[]> {
    const network = await getL2Network(l2Provider)
    const chainID = network.chainID.toString()
    const isClassic = await this.isClassic(l2Provider)

    // throw on nitro events
    if (!isClassic) {
      throw new Error(
        "This method is only for classic transactions. Use 'getL1ToL2Messages' for nitro transactions."
      )
    }

    const messageNums = this.getInboxMessageDeliveredEvents().map(
      msg => msg.messageNum
    )

    return messageNums.map(
      messageNum =>
        new L1ToL2MessageReaderClassic(
          l2Provider,
          BigNumber.from(chainID).toNumber(),
          messageNum
        )
    )
  }

  /**
   * Get any l1tol2 messages created by this transaction
   * @param l2SignerOrProvider
   */
  public async getL1ToL2Messages<T extends SignerOrProvider>(
    l2SignerOrProvider: T
  ): Promise<L1ToL2MessageReaderOrWriter<T>[]>
  public async getL1ToL2Messages<T extends SignerOrProvider>(
    l2SignerOrProvider: T
  ): Promise<L1ToL2MessageReader[] | L1ToL2MessageWriter[]> {
    const provider = SignerProviderUtils.getProviderOrThrow(l2SignerOrProvider)
    const network = await getL2Network(provider)
    const chainID = network.chainID.toString()
    const isClassic = await this.isClassic(provider)

    // throw on classic events
    if (isClassic) {
      throw new Error(
        "This method is only for nitro transactions. Use 'getL1ToL2MessagesClassic' for classic transactions."
      )
    }

    const events = this.getMessageEvents()
    return events
      .filter(
        e =>
          e.bridgeMessageEvent.kind ===
            InboxMessageKind.L1MessageType_submitRetryableTx &&
          e.bridgeMessageEvent.inbox.toLowerCase() ===
            network.ethBridge.inbox.toLowerCase()
      )
      .map(mn => {
        const messageDataParser = new SubmitRetryableMessageDataParser()
        const inboxMessageData = messageDataParser.parse(
          mn.inboxMessageEvent.data
        )

        return L1ToL2Message.fromEventComponents(
          l2SignerOrProvider,
          BigNumber.from(chainID).toNumber(),
          mn.bridgeMessageEvent.sender,
          mn.inboxMessageEvent.messageNum,
          mn.bridgeMessageEvent.baseFeeL1,
          inboxMessageData
        )
      })
  }

  /**
   * Get any token deposit events created by this transaction
   * @returns
   */
  public getTokenDepositEvents() {
    return parseTypedLogs(
      L1ERC20Gateway__factory,
      this.logs,
      'DepositInitiated'
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
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: EthDepositMessage
    } & EthDepositMessageWaitResult
  > {
    const message = (await this.getEthDeposits(l2Provider))[0]
    if (!message)
      throw new ArbSdkError('Unexpected missing Eth Deposit message.')
    const res = await message.wait(confirmations, timeout)

    return {
      complete: isDefined(res),
      l2TxReceipt: res,
      message,
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
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: L1ToL2MessageReaderOrWriter<T>
    } & L1ToL2MessageWaitResult
  > {
    const message = (await this.getL1ToL2Messages(l2SignerOrProvider))[0]
    if (!message) throw new ArbSdkError('Unexpected missing L1ToL2 message.')
    const res = await message.waitForStatus(confirmations, timeout)

    return {
      complete: res.status === L1ToL2MessageStatus.REDEEMED,
      ...res,
      message,
    }
  }
}
