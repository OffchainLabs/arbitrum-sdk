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
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber } from '@ethersproject/bignumber'
import { zeroPad } from '@ethersproject/bytes'

import { ArbRetryableTx__factory } from '../abi/factories/ArbRetryableTx__factory'
import { ARB_RETRYABLE_TX_ADDRESS } from '../dataEntities/constants'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { ethers, Overrides } from 'ethers'
import { Address } from '../dataEntities/address'
import { L2TransactionReceipt, RedeemTransaction } from './L2Transaction'
import { getL2Network } from '../../lib/dataEntities/networks'
import { RetryableMessageParams } from '../dataEntities/message'
import { getTransactionReceipt } from '../utils/lib'
import { EventFetcher } from '../utils/eventFetcher'

export enum L2TxnType {
  L2_TX = 0,
  AUTO_REDEEM = 1,
}

export enum L1ToL2MessageStatus {
  /**
   * The retryable ticket has yet to be created
   */
  NOT_YET_CREATED = 1,
  /**
   * An attempt was made to create the retryable ticket, but it failed.
   * This could be due to not enough submission cost being paid by the L1 transaction
   */
  CREATION_FAILED = 2,
  /**
   * The retryable ticket has been created but has not been redeemed. This could be due to the
   * auto redeem failing, or if the params (max l2 gas price) * (max l2 gas) = 0 then no auto
   * redeem tx is ever issued. An auto redeem is also never issued for ETH deposits.
   * A manual redeem is now required.
   */
  FUNDS_DEPOSITED_ON_L2 = 3,
  /**
   * The retryable ticket has been redeemed (either by auto, or manually) and the
   * l2 transaction has been executed
   */
  REDEEMED = 4,
  /**
   * The message has either expired or has been canceled. It can no longer be redeemed.
   */
  EXPIRED = 5,
}

/**
 * Conditional type for Signer or Provider. If T is of type Provider
 * then L1ToL2MessageReaderOrWriter<T> will be of type L1ToL2MessageReader.
 * If T is of type Signer then L1ToL2MessageReaderOrWriter<T> will be of
 * type L1ToL2MessageWriter.
 */
export type L1ToL2MessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? L1ToL2MessageReader : L1ToL2MessageWriter

export abstract class L1ToL2Message {
  /**
   * When messages are sent from L1 to L2 a retryable ticket is created on L2.
   * The retryableCreationId can be used to retrieve information about the success or failure of the
   * creation of the retryable ticket.
   */
  public readonly retryableCreationId: string

  /**
   * The submit retryable transactions use the typed transaction envelope 2718.
   * The id of these transactions is the hash of the RLP encoded transaction.
   * @param l2ChainId
   * @param fromAddress
   * @param messageNumber
   * @param l1BaseFee
   * @param destAddress
   * @param l2CallValue
   * @param l1Value
   * @param maxSubmissionFee
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param gasLimit
   * @param maxFeePerGas
   * @param data
   * @returns
   */
  public static calculateSubmitRetryableId(
    l2ChainId: number,
    fromAddress: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,

    destAddress: string,
    l2CallValue: BigNumber,
    l1Value: BigNumber,
    maxSubmissionFee: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    gasLimit: BigNumber,
    maxFeePerGas: BigNumber,
    data: string
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    const addressAlias = new Address(fromAddress)

    const from = addressAlias.applyAlias()
    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)

    const fields: any[] = [
      formatNumber(chainId),
      zeroPad(formatNumber(msgNum), 32),
      from.value,
      formatNumber(l1BaseFee),

      formatNumber(l1Value),
      formatNumber(maxFeePerGas),
      formatNumber(gasLimit),
      destAddress,
      formatNumber(l2CallValue),
      callValueRefundAddress,
      formatNumber(maxSubmissionFee),
      excessFeeRefundAddress,
      data,
    ]

    // arbitrum submit retry transactions have type 0x69
    const rlpEnc = ethers.utils.hexConcat([
      '0x69',
      ethers.utils.RLP.encode(fields),
    ])

    return ethers.utils.keccak256(rlpEnc)
  }

  public static fromTxComponents<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): L1ToL2MessageReaderOrWriter<T>
  public static fromTxComponents<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): L1ToL2MessageReader | L1ToL2MessageWriter {
    return SignerProviderUtils.isSigner(l2SignerOrProvider)
      ? new L1ToL2MessageWriter(
          l2SignerOrProvider,
          chainId,
          sender,
          messageNumber,
          l1BaseFee,
          messageData
        )
      : new L1ToL2MessageReader(
          l2SignerOrProvider,
          chainId,
          sender,
          messageNumber,
          l1BaseFee,
          messageData
        )
  }

  protected constructor(
    public readonly chainId: number,
    public readonly sender: string,
    public readonly messageNumber: BigNumber,
    public readonly l1BaseFee: BigNumber,
    public readonly messageData: RetryableMessageParams
  ) {
    this.retryableCreationId = L1ToL2Message.calculateSubmitRetryableId(
      chainId,
      sender,
      messageNumber,
      l1BaseFee,
      messageData.destAddress,
      messageData.l2CallValue,
      messageData.l1Value,
      messageData.maxSubmissionFee,
      messageData.excessFeeRefundAddress,
      messageData.callValueRefundAddress,
      messageData.gasLimit,
      messageData.maxFeePerGas,
      messageData.data
    )
  }
}

/**
 * If the status is redeemed an l2TxReceipt is populated.
 * For all other statuses l2TxReceipt is not populated
 */
export type L1ToL2MessageWaitResult =
  | { status: L1ToL2MessageStatus.REDEEMED; l2TxReceipt: TransactionReceipt }
  | { status: Exclude<L1ToL2MessageStatus, L1ToL2MessageStatus.REDEEMED> }

export type EthDepositMessageWaitResult = {
  l2TxReceipt: TransactionReceipt | null
}

export class L1ToL2MessageReader extends L1ToL2Message {
  private retryableCreationReceipt: TransactionReceipt | undefined | null
  public constructor(
    public readonly l2Provider: Provider,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(chainId, sender, messageNumber, l1BaseFee, messageData)
  }

  /**
   * Try to get the receipt for the retryable ticket creation.
   * This is the L2 transaction that creates the retryable ticket.
   * If confirmations or timeout is provided, this will wait for the ticket to be created
   * @returns Null if retryable has not been created
   */
  public async getRetryableCreationReceipt(
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    if (!this.retryableCreationReceipt) {
      this.retryableCreationReceipt = await getTransactionReceipt(
        this.l2Provider,
        this.retryableCreationId,
        confirmations,
        timeout
      )
    }

    return this.retryableCreationReceipt || null
  }

  /**
   * When retryable tickets are created, and gas is supplied to it, an attempt is
   * made to redeem the ticket straght away. This is called an auto redeem.
   * @returns TransactionReceipt of the auto redeem attempt if exists, otherwise null
   */
  public async getAutoRedeemAttempt(): Promise<TransactionReceipt | null> {
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (creationReceipt) {
      const l2Receipt = new L2TransactionReceipt(creationReceipt)
      const redeemEvents = l2Receipt.getRedeemScheduledEvents()

      if (redeemEvents.length === 1) {
        return await this.l2Provider.getTransactionReceipt(
          redeemEvents[0].retryTxHash
        )
      } else if (redeemEvents.length > 1) {
        throw new ArbSdkError(
          `Unexpected number of redeem events for retryable creation tx. ${creationReceipt} ${redeemEvents}`
        )
      }
    }

    return null
  }

  /**
   * Receipt for the successful l2 transaction created by this message.
   * @returns TransactionReceipt of the first successful redeem if exists, otherwise null
   */
  public async getSuccessfulRedeem(): Promise<TransactionReceipt | null> {
    const l2Network = await getL2Network(this.l2Provider)
    const creationReceipt = await this.getRetryableCreationReceipt()

    // check the auto redeem, if that worked we dont need to do costly log queries
    const autoRedeem = await this.getAutoRedeemAttempt()
    if (autoRedeem && autoRedeem.status === 1) return autoRedeem

    // the auto redeem didnt exist or wasnt successful, look for a later manual redeem
    // to do this we need to filter through the whole lifetime of the ticket looking
    // for relevant redeem scheduled events
    if (creationReceipt) {
      let increment = 1000
      let fromBlock = await this.l2Provider.getBlock(
        creationReceipt.blockNumber
      )
      const creationBlock = await this.l2Provider.getBlock(
        creationReceipt.blockNumber
      )
      const maxBlock = await this.l2Provider.getBlockNumber()
      while (fromBlock.number < maxBlock) {
        const toBlockNumber = Math.min(fromBlock.number + increment, maxBlock)

        // We can skip by doing fromBlock.number + 1 on the first go
        // since creationBlock because it is covered by the `getAutoRedeem` shortcut
        const eventFetcher = new EventFetcher(this.l2Provider)
        const redeemEvents = await eventFetcher.getEvents(
          undefined,
          ArbRetryableTx__factory,
          contract =>
            contract.filters[
              'RedeemScheduled(bytes32,bytes32,uint64,uint64,address)'
            ](this.retryableCreationId),
          {
            fromBlock: fromBlock.number + 1,
            toBlock: toBlockNumber,
          }
        )
        const successfulRedeem = (
          await Promise.all(
            redeemEvents.map(e =>
              this.l2Provider.getTransactionReceipt(e.event.retryTxHash)
            )
          )
        ).filter(r => r.status === 1)
        if (successfulRedeem.length > 1)
          throw new ArbSdkError(
            `Unexpected number of successful redeems. Expected only one redeem for ticket ${this.retryableCreationId}, but found ${successfulRedeem.length}.`
          )
        if (successfulRedeem.length == 1) return successfulRedeem[0]

        const toBlock = await this.l2Provider.getBlock(toBlockNumber)
        // dont bother looking past the retryable lifetime of the ticket for now
        if (
          toBlock.timestamp - creationBlock.timestamp >
          l2Network.retryableLifetimeSeconds
        )
          break
        const processedSeconds = toBlock.timestamp - fromBlock.timestamp
        if (processedSeconds != 0) {
          // find the increment that cover ~ 1 day
          increment *= Math.ceil(86400 / processedSeconds)
        }

        fromBlock = toBlock
      }
    }
    return null
  }

  /**
   * Has this message expired. Once expired the retryable ticket can no longer be redeemed.
   * @returns
   */
  public async isExpired(): Promise<boolean> {
    const currentTimestamp = BigNumber.from(
      (await this.l2Provider.getBlock('latest')).timestamp
    )
    const timeoutTimestamp = await this.getTimeout()

    // timeoutTimestamp returns the timestamp at which the retryable ticket expires
    // it can also return 0 if the ticket l2Tx does not exist
    return currentTimestamp.gte(timeoutTimestamp)
  }

  protected async receiptsToStatus(
    retryableCreationReceipt: TransactionReceipt | null,
    successfulRedeemReceipt: TransactionReceipt | null
  ): Promise<L1ToL2MessageStatus> {
    // happy path for non auto redeemable messages
    // NOT_YET_CREATED -> FUNDS_DEPOSITED
    // these will later either transition to EXPIRED after the timeout
    // (this is what happens to eth deposits since they don't need to be
    // redeemed) or to REDEEMED if the retryable is manually redeemed

    // happy path for auto redeemable messages
    // NOT_YET_CREATED -> FUNDS_DEPOSITED -> REDEEMED
    // an attempt to auto redeem executable messages is made immediately
    // after the retryable is created - which if successful will transition
    // the status to REDEEMED. If the auto redeem fails then the ticket
    // will transition to REDEEMED if manually redeemed, or EXPIRE
    // after the timeout is reached and the ticket is not redeemed

    // we test the retryable receipt first as if this doesnt exist there's
    // no point looking to see if expired
    if (!retryableCreationReceipt) {
      return L1ToL2MessageStatus.NOT_YET_CREATED
    }
    if (retryableCreationReceipt.status === 0) {
      return L1ToL2MessageStatus.CREATION_FAILED
    }

    // ticket created, has it been auto redeemed?
    if (successfulRedeemReceipt && successfulRedeemReceipt.status === 1) {
      return L1ToL2MessageStatus.REDEEMED
    }

    // not redeemed, has it now expired
    if (await this.isExpired()) {
      return L1ToL2MessageStatus.EXPIRED
    }

    // ticket was created but not redeemed
    // this could be because
    // a) the ticket is non auto redeemable (l2GasPrice == 0 || l2GasLimit == 0) -
    //    this is usually an eth deposit. But in some rare case the
    //    user may still want to manually redeem it
    // b) the ticket is auto redeemable, but the auto redeem failed

    // the fact that the auto redeem failed isn't usually useful to the user
    // if they're doing an eth deposit they don't care about redemption
    // and if they do want execution to occur they will know that they're
    // here because the auto redeem failed. If they really want to check
    // they can fetch the auto redeem receipt and check the status on it
    return L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
  }

  public async status(): Promise<L1ToL2MessageStatus> {
    return this.receiptsToStatus(
      await this.getRetryableCreationReceipt(),
      await this.getSuccessfulRedeem()
    )
  }

  /**
   * Wait for the retryable ticket to be created, for it to be redeemed, and for the l2Tx to be executed.
   * Note: The terminal status of a transaction that only does an eth deposit is FUNDS_DEPOSITED_ON_L2 as
   * no L2 transaction needs to be executed, however the terminal state of any other transaction is REDEEMED
   * which represents that the retryable ticket has been redeemed and the L2 tx has been executed.
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on L2. Throws on timeout.
   * @returns The wait result contains a status, and optionally the l2TxReceipt.
   * If the status is "REDEEMED" then a l2TxReceipt is also available on the result.
   * If the status has any other value then l2TxReceipt is not populated.
   */
  public async waitForStatus(
    confirmations?: number,
    timeout = 900000
  ): Promise<L1ToL2MessageWaitResult> {
    // try to wait for the retryable ticket to be created
    const retryableCreationReceipt = await this.getRetryableCreationReceipt(
      confirmations,
      timeout
    )

    // get the successful redeem transaction, if one exists
    const l2TxReceipt = await this.getSuccessfulRedeem()

    const status = await this.receiptsToStatus(
      retryableCreationReceipt,
      l2TxReceipt
    )
    if (status === L1ToL2MessageStatus.REDEEMED) {
      return {
        // if the status is redeemed we know the l2TxReceipt must exist
        l2TxReceipt: l2TxReceipt!,
        status,
      }
    } else {
      return {
        status,
      }
    }
  }

  /**
   * How long until this message expires
   * @returns
   */
  public async getTimeout(): Promise<BigNumber> {
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      this.l2Provider
    )
    return await arbRetryableTx.getTimeout(this.retryableCreationId)
  }

  /**
   * Address to which CallValue will be credited to on L2 if the retryable ticket times out or is cancelled.
   * The Beneficiary is also the address with the right to cancel a Retryable Ticket (if the ticket hasn’t been redeemed yet).
   * @returns
   */
  public getBeneficiary(): Promise<string> {
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      this.l2Provider
    )
    return arbRetryableTx.getBeneficiary(this.retryableCreationId)
  }
}

export class L1ToL2MessageWriter extends L1ToL2MessageReader {
  public constructor(
    public readonly l2Signer: Signer,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(
      l2Signer.provider!,
      chainId,
      sender,
      messageNumber,
      l1BaseFee,
      messageData
    )
    if (!l2Signer.provider)
      throw new ArbSdkError('Signer not connected to provider.')
  }

  /**
   * Manually redeem the retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.NOT_YET_REDEEMED
   */
  public async redeem(overrides?: Overrides): Promise<RedeemTransaction> {
    const status = await this.status()
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.l2Signer
      )

      const redeemTx = await arbRetryableTx.redeem(this.retryableCreationId, {
        ...overrides,
      })

      return L2TransactionReceipt.toRedeemTransaction(
        L2TransactionReceipt.monkeyPatchWait(redeemTx),
        this.l2Provider
      )
    } else {
      throw new ArbSdkError(
        `Cannot redeem. Message status: ${status} must be: ${L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2}.`
      )
    }
  }

  /**
   * Cancel the retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.NOT_YET_REDEEMED
   */
  public async cancel(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.l2Signer
      )
      return await arbRetryableTx.cancel(this.retryableCreationId, overrides)
    } else {
      throw new ArbSdkError(
        `Cannot cancel. Message status: ${status} must be: ${L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2}.`
      )
    }
  }
}

/**
 * A message for Eth deposits from L1 to L2
 */
export class EthDepositMessage {
  public readonly l2DepositTxHash: string
  private l2DepositTxReceipt: TransactionReceipt | undefined | null

  public static calculateDepositTxId(
    l2ChainId: number,
    messageNumber: BigNumber,
    toAddress: string,
    value: BigNumber
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)

    const fields: any[] = [
      formatNumber(chainId),
      zeroPad(formatNumber(msgNum), 32),
      toAddress,
      formatNumber(value),
    ]

    // arbitrum eth deposit transactions have type 0x64
    const rlpEnc = ethers.utils.hexConcat([
      '0x64',
      ethers.utils.RLP.encode(fields),
    ])

    return ethers.utils.keccak256(rlpEnc)
  }

  constructor(
    private readonly l2Provider: Provider,
    public readonly l2ChainId: number,
    public readonly messageNumber: BigNumber,
    public readonly to: string,
    public readonly value: BigNumber
  ) {
    this.l2DepositTxHash = EthDepositMessage.calculateDepositTxId(
      l2ChainId,
      messageNumber,
      to,
      value
    )
  }

  public async wait(confirmations?: number, timeout = 900000) {
    if (!this.l2DepositTxReceipt) {
      this.l2DepositTxReceipt = await getTransactionReceipt(
        this.l2Provider,
        this.l2DepositTxHash,
        confirmations,
        timeout
      )
    }

    return this.l2DepositTxReceipt || null
  }
}
