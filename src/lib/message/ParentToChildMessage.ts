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
import {
  ARB_RETRYABLE_TX_ADDRESS,
  DEFAULT_DEPOSIT_TIMEOUT,
  SEVEN_DAYS_IN_SECONDS,
} from '../dataEntities/constants'
import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { ethers, Overrides } from 'ethers'
import { ChildTransactionReceipt, RedeemTransaction } from './ChildTransaction'
import { getChildChain } from '../../lib/dataEntities/networks'
import { RetryableMessageParams } from '../dataEntities/message'
import { getTransactionReceipt, isDefined } from '../utils/lib'
import { EventFetcher } from '../utils/eventFetcher'
import { ErrorCode, Logger } from '@ethersproject/logger'
import { ZeroAddress } from 'ethers-v6'

export enum ParentToChildMessageStatus {
  /**
   * The retryable ticket has yet to be created
   */
  NOT_YET_CREATED = 1,
  /**
   * An attempt was made to create the retryable ticket, but it failed.
   * This could be due to not enough submission cost being paid by the ParentChain transaction
   */
  CREATION_FAILED = 2,
  /**
   * The retryable ticket has been created but has not been redeemed. This could be due to the
   * auto redeem failing, or if the params (max chain gas price) * (max chain gas) = 0 then no auto
   * redeem tx is ever issued. An auto redeem is also never issued for ETH deposits.
   * A manual redeem is now required.
   */
  FUNDS_DEPOSITED_ON_CHAIN = 3,
  /**
   * The retryable ticket has been redeemed (either by auto, or manually) and the
   * chain transaction has been executed
   */
  REDEEMED = 4,
  /**
   * The message has either expired or has been canceled. It can no longer be redeemed.
   */
  EXPIRED = 5,
}

export enum EthDepositStatus {
  /**
   * ETH is not deposited on Chain yet
   */
  PENDING = 1,
  /**
   * ETH is deposited successfully on Chain
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
 * then ParentToChildMessageReaderOrWriter<T> will be of type ParentToChildMessageReader.
 * If T is of type Signer then ParentToChildMessageReaderOrWriter<T> will be of
 * type ParentToChildMessageWriter.
 */
export type ParentToChildMessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? ParentToChildMessageReader : ParentToChildMessageWriter

export abstract class ParentToChildMessage {
  /**
   * When messages are sent from ParentChain to Chain a retryable ticket is created on Chain.
   * The retryableCreationId can be used to retrieve information about the success or failure of the
   * creation of the retryable ticket.
   */
  public readonly retryableCreationId: string

  /**
   * The submit retryable transactions use the typed transaction envelope 2718.
   * The id of these transactions is the hash of the RLP encoded transaction.
   * @param chainChainId
   * @param fromAddress the aliased address that called the ParentChain inbox as emitted in the bridge event.
   * @param messageNumber
   * @param parentChainBaseFee
   * @param destAddress
   * @param chainCallValue
   * @param parentChainValue
   * @param maxSubmissionFee
   * @param excessFeeRefundAddress refund address specified in the retryable creation. Note the ParentChain inbox aliases this address if it is a ParentChain smart contract. The user is expected to provide this value already aliased when needed.
   * @param callValueRefundAddress refund address specified in the retryable creation. Note the ParentChain inbox aliases this address if it is a ParentChain smart contract. The user is expected to provide this value already aliased when needed.
   * @param gasLimit
   * @param maxFeePerGas
   * @param data
   * @returns
   */
  public static calculateSubmitRetryableId(
    chainChainId: number,
    fromAddress: string,
    messageNumber: BigNumber,
    parentChainBaseFee: BigNumber,
    destAddress: string,
    chainCallValue: BigNumber,
    parentChainValue: BigNumber,
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

    const chainId = BigNumber.from(chainChainId)
    const msgNum = BigNumber.from(messageNumber)

    const fields: any[] = [
      formatNumber(chainId),
      zeroPad(formatNumber(msgNum), 32),
      fromAddress,
      formatNumber(parentChainBaseFee),

      formatNumber(parentChainValue),
      formatNumber(maxFeePerGas),
      formatNumber(gasLimit),
      // when destAddress is 0x0, arbos treat that as nil
      destAddress === ZeroAddress ? '0x' : destAddress,
      formatNumber(chainCallValue),
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
    chainSignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentChainBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): ParentToChildMessageReaderOrWriter<T>
  public static fromEventComponents<T extends SignerOrProvider>(
    chainSignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentChainBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): ParentToChildMessageReader | ParentToChildMessageWriter {
    return SignerProviderUtils.isSigner(chainSignerOrProvider)
      ? new ParentToChildMessageWriter(
          chainSignerOrProvider,
          chainId,
          sender,
          messageNumber,
          parentChainBaseFee,
          messageData
        )
      : new ParentToChildMessageReader(
          chainSignerOrProvider,
          chainId,
          sender,
          messageNumber,
          parentChainBaseFee,
          messageData
        )
  }

  protected constructor(
    public readonly chainId: number,
    public readonly sender: string,
    public readonly messageNumber: BigNumber,
    public readonly parentChainBaseFee: BigNumber,
    public readonly messageData: RetryableMessageParams
  ) {
    this.retryableCreationId = ParentToChildMessage.calculateSubmitRetryableId(
      chainId,
      sender,
      messageNumber,
      parentChainBaseFee,
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
 * If the status is redeemed an chainTxReceipt is populated.
 * For all other statuses chainTxReceipt is not populated
 */
export type ParentToChildMessageWaitResult =
  | {
      status: ParentToChildMessageStatus.REDEEMED
      chainTxReceipt: TransactionReceipt
    }
  | {
      status: Exclude<
        ParentToChildMessageStatus,
        ParentToChildMessageStatus.REDEEMED
      >
    }

export type EthDepositMessageWaitResult = {
  chainTxReceipt: TransactionReceipt | null
}

export class ParentToChildMessageReader extends ParentToChildMessage {
  private retryableCreationReceipt: TransactionReceipt | undefined | null
  public constructor(
    public readonly chainProvider: Provider,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentChainBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(chainId, sender, messageNumber, parentChainBaseFee, messageData)
  }

  /**
   * Try to get the receipt for the retryable ticket creation.
   * This is the Chain transaction that creates the retryable ticket.
   * If confirmations or timeout is provided, this will wait for the ticket to be created
   * @returns Null if retryable has not been created
   */
  public async getRetryableCreationReceipt(
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    if (!this.retryableCreationReceipt) {
      this.retryableCreationReceipt = await getTransactionReceipt(
        this.chainProvider,
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
      const chainReceipt = new ChildTransactionReceipt(creationReceipt)
      const redeemEvents = chainReceipt.getRedeemScheduledEvents()

      if (redeemEvents.length === 1) {
        return await this.chainProvider.getTransactionReceipt(
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
   * Receipt for the successful chain transaction created by this message.
   * @returns TransactionReceipt of the first successful redeem if exists, otherwise the current status of the message.
   */
  public async getSuccessfulRedeem(): Promise<ParentToChildMessageWaitResult> {
    const chainNetwork = await getChildChain(this.chainProvider)
    const eventFetcher = new EventFetcher(this.chainProvider)
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (!isDefined(creationReceipt)) {
      // retryable was never created, or not created yet
      // therefore it cant have been redeemed or be expired
      return { status: ParentToChildMessageStatus.NOT_YET_CREATED }
    }

    if (creationReceipt.status === 0) {
      return { status: ParentToChildMessageStatus.CREATION_FAILED }
    }

    // check the auto redeem first to avoid doing costly log queries in the happy case
    const autoRedeem = await this.getAutoRedeemAttempt()
    if (autoRedeem && autoRedeem.status === 1) {
      return {
        chainTxReceipt: autoRedeem,
        status: ParentToChildMessageStatus.REDEEMED,
      }
    }

    if (await this.retryableExists()) {
      // the retryable was created and still exists
      // therefore it cant have been redeemed or be expired
      return {
        status: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN,
      }
    }

    // from this point on we know that the retryable was created but does not exist,
    // so the retryable was either successfully redeemed, or it expired

    // the auto redeem didnt exist or wasnt successful, look for a later manual redeem
    // to do this we need to filter through the whole lifetime of the ticket looking
    // for relevant redeem scheduled events
    let increment = 1000
    let fromBlock = await this.chainProvider.getBlock(
      creationReceipt.blockNumber
    )
    let timeout =
      fromBlock.timestamp +
      (chainNetwork.retryableLifetimeSeconds ?? SEVEN_DAYS_IN_SECONDS)
    const queriedRange: { from: number; to: number }[] = []
    const maxBlock = await this.chainProvider.getBlockNumber()
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
            this.chainProvider.getTransactionReceipt(e.event.retryTxHash)
          )
        )
      ).filter(r => isDefined(r) && r.status === 1)

      if (successfulRedeem.length > 1)
        throw new ArbSdkError(
          `Unexpected number of successful redeems. Expected only one redeem for ticket ${this.retryableCreationId}, but found ${successfulRedeem.length}.`
        )
      if (successfulRedeem.length == 1)
        return {
          chainTxReceipt: successfulRedeem[0],
          status: ParentToChildMessageStatus.REDEEMED,
        }

      const toBlock = await this.chainProvider.getBlock(toBlockNumber)
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
    return { status: ParentToChildMessageStatus.EXPIRED }
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
      (await this.chainProvider.getBlock('latest')).timestamp
    )
    try {
      const timeoutTimestamp = await this.getTimeout()
      // timeoutTimestamp returns the timestamp at which the retryable ticket expires
      // it can also return revert if the ticket chainTx does not exist
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

  public async status(): Promise<ParentToChildMessageStatus> {
    return (await this.getSuccessfulRedeem()).status
  }

  /**
   * Wait for the retryable ticket to be created, for it to be redeemed, and for the chainTx to be executed.
   * Note: The terminal status of a transaction that only does an eth deposit is FUNDS_DEPOSITED_ON_CHAIN as
   * no Chain transaction needs to be executed, however the terminal state of any other transaction is REDEEMED
   * which represents that the retryable ticket has been redeemed and the Chain tx has been executed.
   * @param confirmations Amount of confirmations the retryable ticket and the auto redeem receipt should have
   * @param timeout Amount of time to wait for the retryable ticket to be created
   * Defaults to 15 minutes, as by this time all transactions are expected to be included on Chain. Throws on timeout.
   * @returns The wait result contains a status, and optionally the chainTxReceipt.
   * If the status is "REDEEMED" then a chainTxReceipt is also available on the result.
   * If the status has any other value then chainTxReceipt is not populated.
   */
  public async waitForStatus(
    confirmations?: number,
    timeout?: number
  ): Promise<ParentToChildMessageWaitResult> {
    const chosenTimeout = isDefined(timeout) ? timeout : DEFAULT_DEPOSIT_TIMEOUT

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
  public static async getLifetime(chainProvider: Provider): Promise<BigNumber> {
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      chainProvider
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
      this.chainProvider
    )
    return await arbRetryableTx.getTimeout(this.retryableCreationId)
  }

  /**
   * Address to which CallValue will be credited to on Chain if the retryable ticket times out or is cancelled.
   * The Beneficiary is also the address with the right to cancel a Retryable Ticket (if the ticket hasn’t been redeemed yet).
   * @returns
   */
  public getBeneficiary(): Promise<string> {
    const arbRetryableTx = ArbRetryableTx__factory.connect(
      ARB_RETRYABLE_TX_ADDRESS,
      this.chainProvider
    )
    return arbRetryableTx.getBeneficiary(this.retryableCreationId)
  }
}

export class ParentToChildMessageReaderClassic {
  private retryableCreationReceipt: TransactionReceipt | undefined | null
  public readonly messageNumber: BigNumber
  public readonly retryableCreationId: string
  public readonly autoRedeemId: string
  public readonly chainTxHash: string
  public readonly chainProvider: Provider

  constructor(
    chainProvider: Provider,
    chainId: number,
    messageNumber: BigNumber
  ) {
    const bitFlip = (num: BigNumber) => num.or(BigNumber.from(1).shl(255))
    this.messageNumber = messageNumber
    this.chainProvider = chainProvider

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

    this.chainTxHash = keccak256(
      concat([
        zeroPad(this.retryableCreationId, 32),
        zeroPad(BigNumber.from(0).toHexString(), 32),
      ])
    )
  }

  private calculateChainDerivedHash(retryableCreationId: string): string {
    return keccak256(
      concat([
        zeroPad(retryableCreationId, 32),
        // BN 0 meaning Chain TX
        zeroPad(BigNumber.from(0).toHexString(), 32),
      ])
    )
  }

  /**
   * Try to get the receipt for the retryable ticket creation.
   * This is the Chain transaction that creates the retryable ticket.
   * If confirmations or timeout is provided, this will wait for the ticket to be created
   * @returns Null if retryable has not been created
   */
  public async getRetryableCreationReceipt(
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    if (!this.retryableCreationReceipt) {
      this.retryableCreationReceipt = await getTransactionReceipt(
        this.chainProvider,
        this.retryableCreationId,
        confirmations,
        timeout
      )
    }

    return this.retryableCreationReceipt || null
  }

  public async status(): Promise<ParentToChildMessageStatus> {
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (!isDefined(creationReceipt)) {
      return ParentToChildMessageStatus.NOT_YET_CREATED
    }

    if (creationReceipt.status === 0) {
      return ParentToChildMessageStatus.CREATION_FAILED
    }

    const chainDerivedHash = this.calculateChainDerivedHash(
      this.retryableCreationId
    )
    const chainTxReceipt = await this.chainProvider.getTransactionReceipt(
      chainDerivedHash
    )

    if (chainTxReceipt && chainTxReceipt.status === 1) {
      return ParentToChildMessageStatus.REDEEMED
    }

    return ParentToChildMessageStatus.EXPIRED
  }
}

export class ParentToChildMessageWriter extends ParentToChildMessageReader {
  public constructor(
    public readonly chainSigner: Signer,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentChainBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(
      chainSigner.provider!,
      chainId,
      sender,
      messageNumber,
      parentChainBaseFee,
      messageData
    )
    if (!chainSigner.provider)
      throw new ArbSdkError('Signer not connected to provider.')
  }

  /**
   * Manually redeem the retryable ticket.
   * Throws if message status is not ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
   */
  public async redeem(overrides?: Overrides): Promise<RedeemTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.chainSigner
      )

      const redeemTx = await arbRetryableTx.redeem(this.retryableCreationId, {
        ...overrides,
      })

      return ChildTransactionReceipt.toRedeemTransaction(
        ChildTransactionReceipt.monkeyPatchWait(redeemTx),
        this.chainProvider
      )
    } else {
      throw new ArbSdkError(
        `Cannot redeem as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
          ]
        }.`
      )
    }
  }

  /**
   * Cancel the retryable ticket.
   * Throws if message status is not ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
   */
  public async cancel(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.chainSigner
      )
      return await arbRetryableTx.cancel(this.retryableCreationId, overrides)
    } else {
      throw new ArbSdkError(
        `Cannot cancel as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
          ]
        }.`
      )
    }
  }

  /**
   * Increase the timeout of a retryable ticket.
   * Throws if message status is not ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
   */
  public async keepAlive(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN) {
      const arbRetryableTx = ArbRetryableTx__factory.connect(
        ARB_RETRYABLE_TX_ADDRESS,
        this.chainSigner
      )
      return await arbRetryableTx.keepalive(this.retryableCreationId, overrides)
    } else {
      throw new ArbSdkError(
        `Cannot keep alive as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
          ]
        }.`
      )
    }
  }
}

/**
 * A message for Eth deposits from ParentChain to Chain
 */
export class EthDepositMessage {
  public readonly chainDepositTxHash: string
  private chainDepositTxReceipt: TransactionReceipt | undefined | null

  public static calculateDepositTxId(
    chainChainId: number,
    messageNumber: BigNumber,
    fromAddress: string,
    toAddress: string,
    value: BigNumber
  ): string {
    const formatNumber = (numberVal: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(numberVal.toHexString())
    }

    const chainId = BigNumber.from(chainChainId)
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
    // https://github.com/OffchainLabs/nitro/blob/aa84e899cbc902bf6da753b1d66668a1def2c106/contracts/src/bridge/Inbox.sol#Chain42
    // ethers.defaultAbiCoder doesnt decode packed args, so we do a hardcoded parsing
    const addressEnd = 2 + 20 * 2
    const to = getAddress('0x' + eventData.substring(2, addressEnd))
    const value = BigNumber.from('0x' + eventData.substring(addressEnd))

    return { to, value }
  }

  /**
   * Create an EthDepositMessage from data emitted in event when calling ethDeposit on Inbox.sol
   * @param chainProvider
   * @param messageNumber The message number in the Inbox.InboxMessageDelivered event
   * @param senderAddr The sender address from Bridge.MessageDelivered event
   * @param inboxMessageEventData The data field from the Inbox.InboxMessageDelivered event
   * @returns
   */
  public static async fromEventComponents(
    chainProvider: Provider,
    messageNumber: BigNumber,
    senderAddr: string,
    inboxMessageEventData: string
  ) {
    const chainId = (await chainProvider.getNetwork()).chainId
    const { to, value } = EthDepositMessage.parseEthDepositData(
      inboxMessageEventData
    )

    return new EthDepositMessage(
      chainProvider,
      chainId,
      messageNumber,
      senderAddr,
      to,
      value
    )
  }

  /**
   *
   * @param chainProvider
   * @param chainChainId
   * @param messageNumber
   * @param to Recipient address of the ETH on Chain
   * @param value
   */
  constructor(
    private readonly chainProvider: Provider,
    public readonly chainChainId: number,
    public readonly messageNumber: BigNumber,
    public readonly from: string,
    public readonly to: string,
    public readonly value: BigNumber
  ) {
    this.chainDepositTxHash = EthDepositMessage.calculateDepositTxId(
      chainChainId,
      messageNumber,
      from,
      to,
      value
    )
  }

  public async status(): Promise<EthDepositStatus> {
    const receipt = await this.chainProvider.getTransactionReceipt(
      this.chainDepositTxHash
    )
    if (receipt === null) return EthDepositStatus.PENDING
    else return EthDepositStatus.DEPOSITED
  }

  public async wait(confirmations?: number, timeout?: number) {
    const chosenTimeout = isDefined(timeout) ? timeout : DEFAULT_DEPOSIT_TIMEOUT

    if (!this.chainDepositTxReceipt) {
      this.chainDepositTxReceipt = await getTransactionReceipt(
        this.chainProvider,
        this.chainDepositTxHash,
        confirmations,
        chosenTimeout
      )
    }

    return this.chainDepositTxReceipt || null
  }
}
