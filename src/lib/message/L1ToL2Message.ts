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
import { concat, zeroPad } from '@ethersproject/bytes'
import { getAddress } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/keccak256'

import { ArbRetryableTx__factory } from '../abi/factories/ArbRetryableTx__factory'
import { ARB_RETRYABLE_TX_ADDRESS } from '../dataEntities/constants'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { ethers, Overrides } from 'ethers'
import { L2TransactionReceipt, RedeemTransaction } from './L2Transaction'
import { getL2Network } from '../../lib/dataEntities/networks'
import { RetryableMessageParams } from '../dataEntities/message'
import { getTransactionReceipt, isDefined } from '../utils/lib'
import { EventFetcher } from '../utils/eventFetcher'
import { ErrorCode, Logger } from '@ethersproject/logger'

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

export enum EthDepositStatus {
  /**
   * ETH is not deposited on L2 yet
   */
  PENDING = 1,
  /**
   * ETH is deposited successfully on L2
   */
  DEPOSITED = 2,
}

// for handling errors thrown in retryableExists()
interface RetryableExistsError extends Error {
  code: ErrorCode
  errorName: string
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
   * @param fromAddress the aliased address that called the L1 inbox as emitted in the bridge event.
   * @param messageNumber
   * @param l1BaseFee
   * @param destAddress
   * @param l2CallValue
   * @param l1Value
   * @param maxSubmissionFee
   * @param excessFeeRefundAddress refund address specified in the retryable creation. Note the L1 inbox aliases this address if it is a L1 smart contract. The user is expected to provide this value already aliased when needed.
   * @param callValueRefundAddress refund address specified in the retryable creation. Note the L1 inbox aliases this address if it is a L1 smart contract. The user is expected to provide this value already aliased when needed.
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

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)

    const fields: any[] = [
      formatNumber(chainId),
      zeroPad(formatNumber(msgNum), 32),
      fromAddress,
      formatNumber(l1BaseFee),

      formatNumber(l1Value),
      formatNumber(maxFeePerGas),
      formatNumber(gasLimit),
      // when destAddress is 0x0, arbos treat that as nil
      destAddress === ethers.constants.AddressZero ? '0x' : destAddress,
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

  public static fromEventComponents<T extends SignerOrProvider>(
    l2SignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): L1ToL2MessageReaderOrWriter<T>
  public static fromEventComponents<T extends SignerOrProvider>(
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
   * made to redeem the ticket straight away. This is called an auto redeem.
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
   * @returns TransactionReceipt of the first successful redeem if exists, otherwise the current status of the message.
   */
  public async getSuccessfulRedeem(): Promise<L1ToL2MessageWaitResult> {
    const l2Network = await getL2Network(this.l2Provider)
    const eventFetcher = new EventFetcher(this.l2Provider)
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (!isDefined(creationReceipt)) {
      // retryable was never created, or not created yet
      // therefore it cant have been redeemed or be expired
      return { status: L1ToL2MessageStatus.NOT_YET_CREATED }
    }

    if (creationReceipt.status === 0) {
      return { status: L1ToL2MessageStatus.CREATION_FAILED }
    }

    // check the auto redeem first to avoid doing costly log queries in the happy case
    const autoRedeem = await this.getAutoRedeemAttempt()
    if (autoRedeem && autoRedeem.status === 1) {
      return { l2TxReceipt: autoRedeem, status: L1ToL2MessageStatus.REDEEMED }
    }

    if (await this.retryableExists()) {
      // the retryable was created and still exists
      // therefore it cant have been redeemed or be expired
      return { status: L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2 }
    }

    // from this point on we know that the retryable was created but does not exist,
    // so the retryable was either successfully redeemed, or it expired

    // the auto redeem didnt exist or wasnt successful, look for a later manual redeem
    // to do this we need to filter through the whole lifetime of the ticket looking
    // for relevant redeem scheduled events
    let increment = 1000
    let fromBlock = await this.l2Provider.getBlock(creationReceipt.blockNumber)
    let timeout = fromBlock.timestamp + l2Network.retryableLifetimeSeconds
    const queriedRange: { from: number; to: number }[] = []
    const maxBlock = await this.l2Provider.getBlockNumber()
    while (fromBlock.number < maxBlock) {
      const toBlockNumber = Math.min(fromBlock.number + increment, maxBlock)

      // using fromBlock.number would lead to 1 block overlap
      // not fixing it here to keep the code simple
      const outerBlockRange = { from: fromBlock.number, to: toBlockNumber }
      queriedRange.push(outerBlockRange)
      const redeemEvents = await eventFetcher.getEvents(
        ArbRetryableTx__factory,
        contract => contract.filters.RedeemScheduled(this.retryableCreationId),
        {
          fromBlock: outerBlockRange.from,
          toBlock: outerBlockRange.to,
          address: ARB_RETRYABLE_TX_ADDRESS,
        }
      )
      const successfulRedeem = (
        await Promise.all(
          redeemEvents.map(e =>
            this.l2Provider.getTransactionReceipt(e.event.retryTxHash)
          )
        )
      ).filter(r => isDefined(r) && r.status === 1)

      if (successfulRedeem.length > 1)
        throw new ArbSdkError(
          `Unexpected number of successful redeems. Expected only one redeem for ticket ${this.retryableCreationId}, but found ${successfulRedeem.length}.`
        )
      if (successfulRedeem.length == 1)
        return {
          l2TxReceipt: successfulRedeem[0],
          status: L1ToL2MessageStatus.REDEEMED,
        }

      const toBlock = await this.l2Provider.getBlock(toBlockNumber)
      if (toBlock.timestamp > timeout) {
        // Check for LifetimeExtended event
        while (queriedRange.length > 0) {
          const blockRange = queriedRange.shift()
          const keepaliveEvents = await eventFetcher.getEvents(
            ArbRetryableTx__factory,
            contract =>
              contract.filters.LifetimeExtended(this.retryableCreationId),
            {
              fromBlock: blockRange!.from,
              toBlock: blockRange!.to,
              address: ARB_RETRYABLE_TX_ADDRESS,
            }
          )
          if (keepaliveEvents.length > 0) {
            timeout = keepaliveEvents
              .map(e => e.event.newTimeout.toNumber())
              .sort()
              .reverse()[0]
            break
          }
        }
        // the retryable no longer exists, but we've searched beyond the timeout
        // so it must have expired
        if (toBlock.timestamp > timeout) break
        // It is possible to have another keepalive in the last range as it might include block after previous timeout
        while (queriedRange.length > 1) queriedRange.shift()
      }
      const processedSeconds = toBlock.timestamp - fromBlock.timestamp
      if (processedSeconds != 0) {
        // find the increment that cover ~ 1 day
        increment = Math.ceil((increment * 86400) / processedSeconds)
      }

      fromBlock = toBlock
    }

    // we know from earlier that the retryable no longer exists, so if we havent found the redemption
    // we know that it must have expired
    return { status: L1ToL2MessageStatus.EXPIRED }
  }

  /**
   * Has this message expired. Once expired the retryable ticket can no longer be redeemed.
   * @deprecated Will be removed in v3.0.0
   * @returns
   */
  public async isExpired(): Promise<boolean> {
    return await this.retryableExists()
  }

  private async retryableExists(): Promise<boolean> {
    const currentTimestamp = BigNumber.from(
      (await this.l2Provider.getBlock('latest')).timestamp
    )
    try {
      const timeoutTimestamp = await this.getTimeout()
      // timeoutTimestamp returns the timestamp at which the retryable ticket expires
      // it can also return revert if the ticket l2Tx does not exist
      return currentTimestamp.lte(timeoutTimestamp)
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as RetryableExistsError).code ===
          Logger.errors.CALL_EXCEPTION &&
        (err as unknown as RetryableExistsError).errorName === 'NoTicketWithID'
      ) {
        return false
      }
      throw err
    }
  }

  public async status(): Promise<L1ToL2MessageStatus> {
    return (await this.getSuccessfulRedeem()).status
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
    timeout?: number
  ): Promise<L1ToL2MessageWaitResult> {
    const l2Network = await getL2Network(this.chainId)

    const chosenTimeout = isDefined(timeout)
      ? timeout
      : l2Network.depositTimeout

    // try to wait for the retryable ticket to be created
    const _retryableCreationReceipt = await this.getRetryableCreationReceipt(
      confirmations,
      chosenTimeout
    )
    if (!_retryableCreationReceipt) {
      if (confirmations || chosenTimeout) {
        throw new ArbSdkError(
          `Timed out waiting to retrieve retryable creation receipt: ${this.retryableCreationId}.`
        )
      } else {
        throw new ArbSdkError(
          `Retryable creation receipt not found ${this.retryableCreationId}.`
        )
      }
    }
    return await this.getSuccessfulRedeem()
  }

  /**
   * The minimium lifetime of a retryable tx
   * @returns
   */
  public static async getLifetime(l2Provider: Provider): Promise<BigNumber> {
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      l2Provider
    )
    return await arbRetryableTx.getLifetime()
  }

  /**
   * Timestamp at which this message expires
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

export class L1ToL2MessageReaderClassic {
  private retryableCreationReceipt: TransactionReceipt | undefined | null
  public readonly messageNumber: BigNumber
  public readonly retryableCreationId: string
  public readonly autoRedeemId: string
  public readonly l2TxHash: string
  public readonly l2Provider: Provider

  constructor(l2Provider: Provider, chainId: number, messageNumber: BigNumber) {
    const bitFlip = (num: BigNumber) => num.or(BigNumber.from(1).shl(255))
    this.messageNumber = messageNumber
    this.l2Provider = l2Provider

    this.retryableCreationId = keccak256(
      concat([
        zeroPad(BigNumber.from(chainId).toHexString(), 32),
        zeroPad(bitFlip(this.messageNumber).toHexString(), 32),
      ])
    )

    this.autoRedeemId = keccak256(
      concat([
        zeroPad(this.retryableCreationId, 32),
        zeroPad(BigNumber.from(1).toHexString(), 32),
      ])
    )

    this.l2TxHash = keccak256(
      concat([
        zeroPad(this.retryableCreationId, 32),
        zeroPad(BigNumber.from(0).toHexString(), 32),
      ])
    )
  }

  private calculateL2DerivedHash(retryableCreationId: string): string {
    return keccak256(
      concat([
        zeroPad(retryableCreationId, 32),
        // BN 0 meaning L2 TX
        zeroPad(BigNumber.from(0).toHexString(), 32),
      ])
    )
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

  public async status(): Promise<L1ToL2MessageStatus> {
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (!isDefined(creationReceipt)) {
      return L1ToL2MessageStatus.NOT_YET_CREATED
    }

    if (creationReceipt.status === 0) {
      return L1ToL2MessageStatus.CREATION_FAILED
    }

    const l2DerivedHash = this.calculateL2DerivedHash(this.retryableCreationId)
    const l2TxReceipt = await this.l2Provider.getTransactionReceipt(
      l2DerivedHash
    )

    if (l2TxReceipt && l2TxReceipt.status === 1) {
      return L1ToL2MessageStatus.REDEEMED
    }

    return L1ToL2MessageStatus.EXPIRED
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
   * Throws if message status is not L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
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
        `Cannot redeem as retryable does not exist. Message status: ${
          L1ToL2MessageStatus[status]
        } must be: ${
          L1ToL2MessageStatus[L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2]
        }.`
      )
    }
  }

  /**
   * Cancel the retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
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
        `Cannot cancel as retryable does not exist. Message status: ${
          L1ToL2MessageStatus[status]
        } must be: ${
          L1ToL2MessageStatus[L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2]
        }.`
      )
    }
  }

  /**
   * Increase the timeout of a retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2
   */
  public async keepAlive(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.l2Signer
      )
      return await arbRetryableTx.keepalive(this.retryableCreationId, overrides)
    } else {
      throw new ArbSdkError(
        `Cannot keep alive as retryable does not exist. Message status: ${
          L1ToL2MessageStatus[status]
        } must be: ${
          L1ToL2MessageStatus[L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2]
        }.`
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
    fromAddress: string,
    toAddress: string,
    value: BigNumber
  ): string {
    const formatNumber = (numberVal: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(numberVal.toHexString())
    }

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)

    // https://github.com/OffchainLabs/go-ethereum/blob/07e017aa73e32be92aadb52fa327c552e1b7b118/core/types/arb_types.go#L302-L308
    const fields = [
      formatNumber(chainId),
      zeroPad(formatNumber(msgNum), 32),
      getAddress(fromAddress),
      getAddress(toAddress),
      formatNumber(value),
    ]

    // arbitrum eth deposit transactions have type 0x64
    const rlpEnc = ethers.utils.hexConcat([
      '0x64',
      ethers.utils.RLP.encode(fields),
    ])

    return ethers.utils.keccak256(rlpEnc)
  }

  /**
   * Parse the data field in
   * event InboxMessageDelivered(uint256 indexed messageNum, bytes data);
   * @param eventData
   * @returns destination and amount
   */
  private static parseEthDepositData(eventData: string): {
    to: string
    value: BigNumber
  } {
    // https://github.com/OffchainLabs/nitro/blob/aa84e899cbc902bf6da753b1d66668a1def2c106/contracts/src/bridge/Inbox.sol#L242
    // ethers.defaultAbiCoder doesnt decode packed args, so we do a hardcoded parsing
    const addressEnd = 2 + 20 * 2
    const to = getAddress('0x' + eventData.substring(2, addressEnd))
    const value = BigNumber.from('0x' + eventData.substring(addressEnd))

    return { to, value }
  }

  /**
   * Create an EthDepositMessage from data emitted in event when calling ethDeposit on Inbox.sol
   * @param l2Provider
   * @param messageNumber The message number in the Inbox.InboxMessageDelivered event
   * @param senderAddr The sender address from Bridge.MessageDelivered event
   * @param inboxMessageEventData The data field from the Inbox.InboxMessageDelivered event
   * @returns
   */
  public static async fromEventComponents(
    l2Provider: Provider,
    messageNumber: BigNumber,
    senderAddr: string,
    inboxMessageEventData: string
  ) {
    const chainId = (await l2Provider.getNetwork()).chainId
    const { to, value } = EthDepositMessage.parseEthDepositData(
      inboxMessageEventData
    )

    return new EthDepositMessage(
      l2Provider,
      chainId,
      messageNumber,
      senderAddr,
      to,
      value
    )
  }

  /**
   *
   * @param l2Provider
   * @param l2ChainId
   * @param messageNumber
   * @param to Recipient address of the ETH on L2
   * @param value
   */
  constructor(
    private readonly l2Provider: Provider,
    public readonly l2ChainId: number,
    public readonly messageNumber: BigNumber,
    public readonly from: string,
    public readonly to: string,
    public readonly value: BigNumber
  ) {
    this.l2DepositTxHash = EthDepositMessage.calculateDepositTxId(
      l2ChainId,
      messageNumber,
      from,
      to,
      value
    )
  }

  public async status(): Promise<EthDepositStatus> {
    const receipt = await this.l2Provider.getTransactionReceipt(
      this.l2DepositTxHash
    )
    if (receipt === null) return EthDepositStatus.PENDING
    else return EthDepositStatus.DEPOSITED
  }

  public async wait(confirmations?: number, timeout?: number) {
    const l2Network = await getL2Network(this.l2ChainId)

    const chosenTimeout = isDefined(timeout)
      ? timeout
      : l2Network.depositTimeout

    if (!this.l2DepositTxReceipt) {
      this.l2DepositTxReceipt = await getTransactionReceipt(
        this.l2Provider,
        this.l2DepositTxHash,
        confirmations,
        chosenTimeout
      )
    }

    return this.l2DepositTxReceipt || null
  }
}
