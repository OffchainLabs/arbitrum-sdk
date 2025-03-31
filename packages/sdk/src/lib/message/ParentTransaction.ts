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

import { BigNumber } from 'ethers'
import { TransactionReceipt } from '@ethersproject/providers'
import { Log, Provider } from '@ethersproject/abstract-provider'
import { ContractTransaction } from '@ethersproject/contracts'
import {
  ParentToChildMessage,
  ParentToChildMessageReaderOrWriter,
  ParentToChildMessageReader,
  ParentToChildMessageReaderClassic,
  ParentToChildMessageWriter,
  ParentToChildMessageStatus,
  ParentToChildMessageWaitForStatusResult,
  EthDepositMessage,
  EthDepositMessageWaitForStatusResult,
} from './ParentToChildMessage'

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
import { getArbitrumNetwork } from '../dataEntities/networks'
import { ARB1_NITRO_GENESIS_L1_BLOCK } from '../dataEntities/constants'

export interface ParentContractTransaction<
  TReceipt extends ParentTransactionReceipt = ParentTransactionReceipt
> extends ContractTransaction {
  wait(confirmations?: number): Promise<TReceipt>
}
// some helper interfaces to reduce the verbosity elsewhere
export type ParentEthDepositTransaction =
  ParentContractTransaction<ParentEthDepositTransactionReceipt>
export type ParentContractCallTransaction =
  ParentContractTransaction<ParentContractCallTransactionReceipt>

export class ParentTransactionReceipt implements TransactionReceipt {
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
   * @param childSignerOrProvider
   */
  public async isClassic<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<boolean> {
    const provider = SignerProviderUtils.getProviderOrThrow(
      childSignerOrProvider
    )
    const network = await getArbitrumNetwork(provider)

    // all networks except Arbitrum One started off with Nitro
    if (network.chainId === 42161) {
      return this.blockNumber < ARB1_NITRO_GENESIS_L1_BLOCK
    }

    return false
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
   * @param childProvider
   */
  public async getEthDeposits(
    childProvider: Provider
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
            childProvider,
            m.inboxMessageEvent.messageNum,
            m.bridgeMessageEvent.sender,
            m.inboxMessageEvent.data
          )
        )
    )
  }

  /**
   * Get classic parent-to-child messages created by this transaction
   * @param childProvider
   */
  public async getParentToChildMessagesClassic(
    childProvider: Provider
  ): Promise<ParentToChildMessageReaderClassic[]> {
    const network = await getArbitrumNetwork(childProvider)
    const chainId = network.chainId.toString()
    const isClassic = await this.isClassic(childProvider)

    // throw on nitro events
    if (!isClassic) {
      throw new Error(
        "This method is only for classic transactions. Use 'getParentToChildMessages' for nitro transactions."
      )
    }

    const messageNums = this.getInboxMessageDeliveredEvents().map(
      msg => msg.messageNum
    )

    return messageNums.map(
      messageNum =>
        new ParentToChildMessageReaderClassic(
          childProvider,
          BigNumber.from(chainId).toNumber(),
          messageNum
        )
    )
  }

  /**
   * Get any parent-to-child messages created by this transaction
   * @param childSignerOrProvider
   */
  public async getParentToChildMessages<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<ParentToChildMessageReaderOrWriter<T>[]>
  public async getParentToChildMessages<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<ParentToChildMessageReader[] | ParentToChildMessageWriter[]> {
    const provider = SignerProviderUtils.getProviderOrThrow(
      childSignerOrProvider
    )
    const network = await getArbitrumNetwork(provider)
    const chainId = network.chainId.toString()
    const isClassic = await this.isClassic(provider)

    // throw on classic events
    if (isClassic) {
      throw new Error(
        "This method is only for nitro transactions. Use 'getParentToChildMessagesClassic' for classic transactions."
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

        return ParentToChildMessage.fromEventComponents(
          childSignerOrProvider,
          BigNumber.from(chainId).toNumber(),
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
   * Replaces the wait function with one that returns a {@link ParentTransactionReceipt}
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): ParentContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentTransactionReceipt(result)
    }
    return contractTransaction as ParentContractTransaction
  }

  /**
   * Replaces the wait function with one that returns a {@link ParentEthDepositTransactionReceipt}
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchEthDepositWait = (
    contractTransaction: ContractTransaction
  ): ParentEthDepositTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentEthDepositTransactionReceipt(result)
    }
    return contractTransaction as ParentEthDepositTransaction
  }

  /**
   * Replaces the wait function with one that returns a {@link ParentContractCallTransactionReceipt}
   * @param contractTransaction
   * @returns
   */
  public static monkeyPatchContractCallWait = (
    contractTransaction: ContractTransaction
  ): ParentContractCallTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentContractCallTransactionReceipt(result)
    }
    return contractTransaction as ParentContractCallTransaction
  }
}

/**
 * A {@link ParentTransactionReceipt} with additional functionality that only exists
 * if the transaction created a single eth deposit.
 */
export class ParentEthDepositTransactionReceipt extends ParentTransactionReceipt {
  /**
   * Wait for the funds to arrive on the child chain
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on the child chain. Throws on timeout.
   * @returns The wait result contains `complete`, a `status`, the ParentToChildMessage and optionally the `childTxReceipt`
   * If `complete` is true then this message is in the terminal state.
   * For eth deposits complete this is when the status is FUNDS_DEPOSITED, EXPIRED or REDEEMED.
   */
  public async waitForChildTransactionReceipt(
    childProvider: Provider,
    confirmations?: number,
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: EthDepositMessage
    } & EthDepositMessageWaitForStatusResult
  > {
    const message = (await this.getEthDeposits(childProvider))[0]
    if (!message)
      throw new ArbSdkError('Unexpected missing Eth Deposit message.')
    const res = await message.wait(confirmations, timeout)

    return {
      complete: isDefined(res),
      childTxReceipt: res,
      message,
    }
  }
}

/**
 * A {@link ParentTransactionReceipt} with additional functionality that only exists
 * if the transaction created a single call to a child chain contract - this includes
 * token deposits.
 */
export class ParentContractCallTransactionReceipt extends ParentTransactionReceipt {
  /**
   * Wait for the transaction to arrive and be executed on the child chain
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on the child chain. Throws on timeout.
   * @returns The wait result contains `complete`, a `status`, a {@link ParentToChildMessage} and optionally the `childTxReceipt`.
   * If `complete` is true then this message is in the terminal state.
   * For contract calls this is true only if the status is REDEEMED.
   */
  public async waitForChildTransactionReceipt<T extends SignerOrProvider>(
    childSignerOrProvider: T,
    confirmations?: number,
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: ParentToChildMessageReaderOrWriter<T>
    } & ParentToChildMessageWaitForStatusResult
  > {
    const message = (
      await this.getParentToChildMessages(childSignerOrProvider)
    )[0]
    if (!message)
      throw new ArbSdkError('Unexpected missing Parent-to-child message.')
    const res = await message.waitForStatus(confirmations, timeout)

    return {
      complete: res.status === ParentToChildMessageStatus.REDEEMED,
      ...res,
      message,
    }
  }
}
