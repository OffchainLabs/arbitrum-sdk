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

import {
  SignerProviderUtils,
  SignerOrProvider,
} from '../dataEntities/signerOrProvider'
import { ArbSdkError } from '../dataEntities/errors'
import { Overrides } from 'ethers'
import { RetryableMessageParams } from '../dataEntities/message'

import * as classic from '@arbitrum/sdk-classic'
import { L1ToL2MessageReaderOrWriter as ClassicL1ToL2MessageReaderOrWriter } from '@arbitrum/sdk-classic/dist/lib/message/L1ToL2Message'
import * as nitro from '@arbitrum/sdk-nitro'
import { L1ToL2MessageReaderOrWriter as NitroL1ToL2MessageReaderOrWriter } from '@arbitrum/sdk-nitro/dist/lib/message/L1ToL2Message'
import {
  IL1ToL2MessageReader,
  IL1ToL2MessageWriter,
  isNitroL2,
  toClassicRetryableParams,
} from '../utils/migration_types'

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
  public static fromClassic<T extends SignerOrProvider>(
    readerOrWriter: ClassicL1ToL2MessageReaderOrWriter<T>
  ): L1ToL2MessageWriter | L1ToL2MessageReader {
    if ((readerOrWriter as classic.L1ToL2MessageWriter).l2Signer) {
      return L1ToL2MessageWriter.fromClassic(
        readerOrWriter as classic.L1ToL2MessageWriter
      )
    } else {
      return L1ToL2MessageReader.fromClassic(readerOrWriter)
    }
  }

  public static fromNitro<T extends SignerOrProvider>(
    readerOrWriter: NitroL1ToL2MessageReaderOrWriter<T>
  ): L1ToL2MessageReader | L1ToL2MessageWriter {
    if ((readerOrWriter as nitro.L1ToL2MessageWriter).l2Signer) {
      return L1ToL2MessageWriter.fromNitro(
        readerOrWriter as nitro.L1ToL2MessageWriter
      )
    } else {
      return L1ToL2MessageReader.fromNitro(readerOrWriter)
    }
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
}

/**
 * If the status is redeemed an l2TxReceipt is populated.
 * For all other statuses l2TxReceipt is not populated
 */
export type L1ToL2MessageWaitResult =
  | { status: L1ToL2MessageStatus.REDEEMED; l2TxReceipt: TransactionReceipt }
  | { status: Exclude<L1ToL2MessageStatus, L1ToL2MessageStatus.REDEEMED> }

export class L1ToL2MessageReader
  extends L1ToL2Message
  implements IL1ToL2MessageReader
{
  public static fromClassic(classicReader: classic.L1ToL2MessageReader) {
    return new L1ToL2MessageReader(
      classicReader.l2Provider,
      undefined,
      undefined,
      classicReader.messageNumber,
      undefined,
      undefined,
      classicReader.retryableCreationId
    )
  }

  public static fromNitro(nitroReader: nitro.L1ToL2MessageReader) {
    return new L1ToL2MessageReader(
      nitroReader.l2Provider,
      nitroReader.chainId,
      nitroReader.sender,
      nitroReader.messageNumber,
      nitroReader.l1BaseFee,
      nitroReader.messageData,
      undefined
    )
  }

  private readonly classicReader?: classic.L1ToL2MessageReader
  private readonly classicPartnerReader?: nitro.L1ToL2MessageReader
  private readonly nitroReader?: nitro.L1ToL2MessageReader
  /**
   * When messages are sent from L1 to L2 a retryable ticket is created on L2.
   * The retryableCreationId can be used to retrieve information about the success or failure of the
   * creation of the retryable ticket.
   */
  public readonly retryableCreationId: string
  public constructor(
    public readonly l2Provider: Provider,
    chainId?: number,
    sender?: string,
    messageNumber?: BigNumber,
    l1BaseFee?: BigNumber,
    messageData?: RetryableMessageParams,
    retryableCreationId?: string
  ) {
    super()
    if (retryableCreationId && messageNumber) {
      this.classicReader = new classic.L1ToL2MessageReader(
        l2Provider,
        retryableCreationId,
        messageNumber
      )
      this.classicPartnerReader = new nitro.L1ToL2MessageReader(
        l2Provider,
        chainId!, // although these can be empty we know that they wont be used by the nitro reader
        sender!,
        messageNumber,
        l1BaseFee!,
        messageData!,
        this.classicReader.l2TxHash
      )
      this.retryableCreationId = retryableCreationId
    } else if (chainId && sender && messageNumber && l1BaseFee && messageData) {
      this.nitroReader = new nitro.L1ToL2MessageReader(
        l2Provider,
        chainId,
        sender,
        messageNumber,
        l1BaseFee,
        messageData
      )
      this.retryableCreationId = this.nitroReader.retryableCreationId
    } else {
      throw new ArbSdkError('Unexpected L1ToL2MessageReader constructor args')
    }
  }

  /**
   * Has this message expired. Once expired the retryable ticket can no longer be redeemed.
   * @returns
   */
  public async isExpired(): Promise<boolean> {
    if (this.nitroReader) {
      return await this.nitroReader.isExpired()
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerReader!.isExpired()
    } else {
      return await this.classicReader!.isExpired()
    }
  }

  public async status(): Promise<L1ToL2MessageStatus> {
    if (this.nitroReader) {
      return await this.nitroReader.status()
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerReader!.status()
    } else {
      return await this.classicReader!.status()
    }
  }

  /**
   * Get and format inputs provided in calldata for retryable messsage (message type 9)
   */
  public async getInputs(): ReturnType<
    classic.L1ToL2MessageReader['getInputs']
  > {
    return this.nitroReader
      ? toClassicRetryableParams(this.nitroReader.messageData)
      : await this.classicReader!.getInputs()
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
    if (this.nitroReader) {
      return await this.nitroReader.waitForStatus(confirmations, timeout)
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerReader!.waitForStatus(
        confirmations,
        timeout
      )
    } else {
      return await this.classicReader!.waitForStatus(confirmations, timeout)
    }
  }

  /**
   * How long until this message expires
   * @returns
   */
  public async getTimeout(): Promise<BigNumber> {
    if (this.nitroReader) {
      return await this.nitroReader.getTimeout()
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerReader!.getTimeout()
    } else {
      return await this.classicReader!.getTimeout()
    }
  }

  /**
   * Address to which CallValue will be credited to on L2 if the retryable ticket times out or is cancelled.
   * The Beneficiary is also the address with the right to cancel a Retryable Ticket (if the ticket hasn’t been redeemed yet).
   * @returns
   */
  public async getBeneficiary(): Promise<string> {
    if (this.nitroReader) {
      return await this.nitroReader.getBeneficiary()
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerReader!.getBeneficiary()
    } else {
      return await this.classicReader!.getBeneficiary()
    }
  }
}

export class L1ToL2MessageWriter
  extends L1ToL2MessageReader
  implements IL1ToL2MessageWriter
{
  private readonly nitroWriter?: nitro.L1ToL2MessageWriter
  private readonly classicWriter?: classic.L1ToL2MessageWriter
  private readonly classicPartnerWriter?: nitro.L1ToL2MessageWriter

  public static fromClassic(classicWriter: classic.L1ToL2MessageWriter) {
    return new L1ToL2MessageWriter(
      classicWriter.l2Signer,
      undefined,
      undefined,
      classicWriter.messageNumber,
      undefined,
      undefined,
      classicWriter.retryableCreationId
    )
  }

  public static fromNitro(nitroWriter: nitro.L1ToL2MessageWriter) {
    return new L1ToL2MessageWriter(
      nitroWriter.l2Signer,
      nitroWriter.chainId,
      nitroWriter.sender,
      nitroWriter.messageNumber,
      nitroWriter.l1BaseFee,
      nitroWriter.messageData,
      undefined
    )
  }

  public constructor(
    public readonly l2Signer: Signer,
    chainId?: number,
    sender?: string,
    messageNumber?: BigNumber,
    l1BaseFee?: BigNumber,
    messageData?: RetryableMessageParams,
    retryableCreationId?: string
  ) {
    super(
      l2Signer.provider!,
      chainId,
      sender,
      messageNumber,
      l1BaseFee,
      messageData,
      retryableCreationId
    )

    if (!l2Signer.provider) throw new Error('Signer not connected to provider.')

    // super(chainId, sender, messageNumber, l1BaseFee, messageData)
    if (retryableCreationId && messageNumber) {
      this.classicWriter = new classic.L1ToL2MessageWriter(
        l2Signer,
        retryableCreationId,
        messageNumber
      )
      this.classicPartnerWriter = new nitro.L1ToL2MessageWriter(
        l2Signer,
        chainId!,
        sender!,
        messageNumber!,
        l1BaseFee!,
        messageData!,
        this.classicWriter.l2TxHash
      )
    } else if (chainId && sender && messageNumber && l1BaseFee && messageData) {
      this.nitroWriter = new nitro.L1ToL2MessageWriter(
        l2Signer,
        chainId,
        sender,
        messageNumber,
        l1BaseFee,
        messageData
      )
    } else {
      throw new ArbSdkError('Unexpected L1ToL2MessageWriter constructor args')
    }
  }

  /**
   * Manually redeem the retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.NOT_YET_REDEEMED
   */
  public async redeem(overrides?: Overrides): Promise<ContractTransaction> {
    if (this.nitroWriter) {
      return await this.nitroWriter.redeem(overrides)
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerWriter!.redeem(overrides)
    } else {
      return await this.classicWriter!.redeem()
    }
  }

  /**
   * Cancel the retryable ticket.
   * Throws if message status is not L1ToL2MessageStatus.NOT_YET_REDEEMED
   */
  public async cancel(overrides?: Overrides): Promise<ContractTransaction> {
    if (this.nitroWriter) {
      return await this.nitroWriter.cancel(overrides)
    } else if (await isNitroL2(this.l2Provider)) {
      return await this.classicPartnerWriter!.cancel(overrides)
    } else {
      return await this.classicWriter!.cancel()
    }
  }
}
