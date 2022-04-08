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
import {
  L1ToL2Message,
  L1ToL2MessageReaderOrWriter,
  L1ToL2MessageReader,
  L1ToL2MessageWriter,
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from './L1ToL2Message'

import { L1ERC20Gateway__factory } from '../abi/factories/L1ERC20Gateway__factory'
import { DepositInitiatedEvent } from '../abi/L1ERC20Gateway'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbTsError } from '../dataEntities/errors'
import { ethers } from 'ethers'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { InboxMessageDeliveredEvent } from '../abi/Inbox'
import { hexZeroPad } from '@ethersproject/bytes'
import { SubmitRetryableMessage } from '../dataEntities/message'

export interface L1ContractTransaction<
  TReceipt extends L1TransactionReceipt = L1TransactionReceipt
> extends ContractTransaction {
  wait(confirmations?: number): Promise<TReceipt>
}
// some helper interfaces to reduce the verbosity elsewhere
export type L1EthDepositTransaction = L1ContractTransaction<
  L1EthDepositTransactionReceipt
>
export type L1ContractCallTransaction = L1ContractTransaction<
  L1ContractCallTransactionReceipt
>

// CHRIS: TODO: remove and use proper abi
// CHRIS: TODO: remove all console logging in these arbitrum-sdk
interface TempMessageDeliveredEvent {
  messageIndex: BigNumber
  sender: string
  baseFeeL1: BigNumber
}

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
   * Get the numbers of any messages created by this transaction
   * @returns
   */
  public getMessageDeliveredEvents(): TempMessageDeliveredEvent[] {
    // CHRIS: TODO: this will work when we have the proper abis
    // const iface = Bridge__factory.createInterface()
    const iface = new ethers.utils.Interface([
      'event MessageDelivered(      uint256 indexed messageIndex,      bytes32 indexed beforeInboxAcc,      address inbox,      uint8 kind,      address sender,      bytes32 messageDataHash,      uint256 baseFeeL1,      uint64 timestamp  )',
    ])

    const messageDeliveredTopic = iface.getEventTopic(
      iface.getEvent('MessageDelivered')
    )
    return this.logs
      .filter(log => log.topics[0] === messageDeliveredTopic)
      .map(
        l => (iface.parseLog(l).args as unknown) as TempMessageDeliveredEvent
      )
  }

  /**
   * Get the numbers of any messages created by this transaction
   * @returns
   */
  // CHRIS: TODO:  we need to get the sender from the message delivered event
  // we should make sure that we dont use any non general stuff here
  // we also need inbox message from origin event
  public getInboxMessageDeliveredEvent(): InboxMessageDeliveredEvent['args'][] {
    const iFace = Inbox__factory.createInterface()
    const inboxMessageDeliveredTopic = iFace.getEventTopic(
      iFace.events['InboxMessageDelivered(uint256,bytes)']
    )
    return this.logs
      .filter(log => log.topics[0] === inboxMessageDeliveredTopic)
      .map(l => iFace.parseLog(l).args as InboxMessageDeliveredEvent['args'])
  }

  public getMessageEvents(): {
    inboxMessageEvent: InboxMessageDeliveredEvent['args']
    bridgeMessageEvent: TempMessageDeliveredEvent
  }[] {
    const bridgeMessages = this.getMessageDeliveredEvents()
    const inboxMessages = this.getInboxMessageDeliveredEvent()

    if (bridgeMessages.length !== inboxMessages.length) {
      throw new ArbTsError(
        `Unexpected missing events. Inbox message count: ${
          inboxMessages.length
        } does not equal bridge message count: ${
          bridgeMessages.length
        }. ${JSON.stringify(inboxMessages)} ${JSON.stringify(bridgeMessages)}`
      )
    }

    const messages: {
      inboxMessageEvent: InboxMessageDeliveredEvent['args']
      bridgeMessageEvent: TempMessageDeliveredEvent
    }[] = []
    for (const bm of bridgeMessages) {
      const im = inboxMessages.filter(i => i.messageNum.eq(bm.messageIndex))[0]
      if (!im) {
        throw new ArbTsError(
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

  private parseInboxMessage(
    inboxMessageDeliveredEvent: InboxMessageDeliveredEvent['args']
  ): SubmitRetryableMessage {
    // decode the data field - is been packed so we cant decode the bytes field this way
    const parsed = ethers.utils.defaultAbiCoder.decode(
      [
        'uint256', // dest // CHRIS: TODO: why dont we just encode these as addresses?
        'uint256', // l2 call balue
        'uint256', // msg val
        'uint256', // max submission
        'uint256', // excess fee refund addr
        'uint256', // call value refund addr
        'uint256', // max gas
        'uint256', // gas price bid
        'uint256', // data length
      ],
      inboxMessageDeliveredEvent.data.substring(0, 64 * 9 + 2)
    )

    // CHRIS: TODO: we shouldnt decode addresses this way - since leading zeros get lost
    const destAddress = ethers.utils.getAddress(
      hexZeroPad((parsed[0] as BigNumber).toHexString(), 20)
    )
    const l2CallValue = parsed[1] as BigNumber
    const l1Value = parsed[2] as BigNumber
    const maxSubmissionCost = parsed[3] as BigNumber
    const excessFeeRefundAddress = ethers.utils.getAddress(
      hexZeroPad((parsed[4] as BigNumber).toHexString(), 20)
    )
    const callValueRefundAddress = ethers.utils.getAddress(
      hexZeroPad((parsed[5] as BigNumber).toHexString(), 20)
    )
    const maxGas = parsed[6] as BigNumber
    const gasPriceBid = parsed[7] as BigNumber
    const data = '0x' + inboxMessageDeliveredEvent.data.substring(64 * 9 + 2)

    return {
      destAddress,
      l2CallValue,
      l1Value,
      maxSubmissionCost,
      excessFeeRefundAddress,
      callValueRefundAddress,
      maxGas,
      gasPriceBid,
      data,
    }
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
    const chainID = (await provider.getNetwork()).chainId.toString()

    const messages = this.getMessageEvents()
    if (!messages || messages.length === 0) return []

    return messages.map(mn => {
      const inboxMessageData = this.parseInboxMessage(mn.inboxMessageEvent)
      return L1ToL2Message.fromTxComponents(
        l2SignerOrProvider,
        BigNumber.from(chainID),
        mn.bridgeMessageEvent.sender,
        mn.inboxMessageEvent.messageNum,
        mn.bridgeMessageEvent.baseFeeL1,
        inboxMessageData
      )
    })
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
  ): Promise<L1ToL2MessageReaderOrWriter<T>>
  public async getL1ToL2Message<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    messageIndex?: number
  ): Promise<L1ToL2MessageReader | L1ToL2MessageWriter> {
    const allL1ToL2Messages = await this.getL1ToL2Messages(l2SignerOrProvider)
    const messageCount = allL1ToL2Messages.length
    if (!messageCount)
      throw new ArbTsError(
        `No l1 to L2 message found for ${this.transactionHash}`
      )

    if (messageIndex !== undefined && messageIndex >= messageCount)
      throw new ArbTsError(
        `Provided message number out of range for ${this.transactionHash}; index was ${messageIndex}, but only ${messageCount} messages`
      )
    if (messageIndex === undefined && messageCount > 1)
      throw new ArbTsError(
        `${messageCount} L2 messages for ${this.transactionHash}; must provide messageNumberIndex (or use (signersAndProviders, l1Txn))`
      )

    return allL1ToL2Messages[messageIndex || 0]
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
  public async waitForL2<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    confirmations?: number,
    timeout = 900000
  ): Promise<
    {
      complete: boolean
      message: L1ToL2MessageReaderOrWriter<T>
    } & L1ToL2MessageWaitResult
  > {
    const message = (await this.getL1ToL2Messages(l2SignerOrProvider))[0]
    const res = await message.waitForStatus(confirmations, timeout)

    return {
      complete:
        res.status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2 ||
        res.status === L1ToL2MessageStatus.EXPIRED ||
        res.status === L1ToL2MessageStatus.REDEEMED,
      ...res,
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
    timeout = 900000
  ): Promise<
    {
      complete: boolean
      message: L1ToL2MessageReaderOrWriter<T>
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
