/**
 * ParentToChildMessage compat layer.
 *
 * Provides the old SDK's ParentToChildMessage, ParentToChildMessageReader,
 * ParentToChildMessageWriter, and EthDepositMessage classes with BigNumber fields.
 *
 * Internally delegates to @arbitrum/core ParentToChildMessageReader and
 * action request functions (getRedeemRequest, getCancelRetryableRequest, getKeepAliveRequest).
 */
import { BigNumber, Overrides } from 'ethers'
import type { TransactionReceipt } from '@ethersproject/providers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { Signer } from '@ethersproject/abstract-signer'
import type { ContractTransaction } from '@ethersproject/contracts'
import {
  ParentToChildMessageReader as CoreParentToChildMessageReader,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
  calculateSubmitRetryableId,
  calculateDepositTxId,
  ArbSdkError,
  isDefined,
  EthDepositMessageStatus,
  DEFAULT_DEPOSIT_TIMEOUT,
} from '@arbitrum/core'
import { wrapProvider } from '@arbitrum/ethers5'
import type { Ethers5Provider } from '@arbitrum/ethers5'
import { toEthersReceipt, toBigNumber } from './convert'
import {
  SignerProviderUtils,
  ParentToChildMessageStatus,
} from './types'
import type {
  SignerOrProvider,
  RetryableMessageParams,
  ParentToChildMessageWaitForStatusResult,
} from './types'
import { ChildTransactionReceipt } from './childTransaction'
import type { RedeemTransaction } from './childTransaction'

// ---------------------------------------------------------------------------
// Conditional type for Reader/Writer
// ---------------------------------------------------------------------------

export type ParentToChildMessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? ParentToChildMessageReader : ParentToChildMessageWriter

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class ParentToChildMessage {
  /**
   * The retryable ticket creation ID (hash of the submit retryable tx).
   */
  public readonly retryableCreationId: string

  public static calculateSubmitRetryableId(
    childChainId: number,
    fromAddress: string,
    messageNumber: BigNumber,
    parentBaseFee: BigNumber,
    destAddress: string,
    childCallValue: BigNumber,
    parentCallValue: BigNumber,
    maxSubmissionFee: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    gasLimit: BigNumber,
    maxFeePerGas: BigNumber,
    data: string
  ): string {
    return calculateSubmitRetryableId({
      chainId: childChainId,
      fromAddress,
      messageNumber: messageNumber.toBigInt(),
      baseFee: parentBaseFee.toBigInt(),
      destAddress,
      l2CallValue: childCallValue.toBigInt(),
      l1Value: parentCallValue.toBigInt(),
      maxSubmissionFee: maxSubmissionFee.toBigInt(),
      excessFeeRefundAddress,
      callValueRefundAddress,
      gasLimit: gasLimit.toBigInt(),
      maxFeePerGas: maxFeePerGas.toBigInt(),
      data,
    })
  }

  public static fromEventComponents<T extends SignerOrProvider>(
    chainSignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): ParentToChildMessageReaderOrWriter<T>
  public static fromEventComponents<T extends SignerOrProvider>(
    chainSignerOrProvider: T,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ): ParentToChildMessageReader | ParentToChildMessageWriter {
    return SignerProviderUtils.isSigner(chainSignerOrProvider)
      ? new ParentToChildMessageWriter(
          chainSignerOrProvider,
          chainId,
          sender,
          messageNumber,
          parentBaseFee,
          messageData
        )
      : new ParentToChildMessageReader(
          chainSignerOrProvider,
          chainId,
          sender,
          messageNumber,
          parentBaseFee,
          messageData
        )
  }

  protected constructor(
    public readonly chainId: number,
    public readonly sender: string,
    public readonly messageNumber: BigNumber,
    public readonly parentBaseFee: BigNumber,
    public readonly messageData: RetryableMessageParams
  ) {
    this.retryableCreationId = ParentToChildMessage.calculateSubmitRetryableId(
      chainId,
      sender,
      messageNumber,
      parentBaseFee,
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

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export class ParentToChildMessageReader extends ParentToChildMessage {
  private readonly coreReader: CoreParentToChildMessageReader

  public constructor(
    public readonly childProvider: Provider,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(chainId, sender, messageNumber, parentBaseFee, messageData)

    // Create the core reader with wrapped provider and bigint params
    const wrappedProvider = wrapProvider(childProvider as unknown as Ethers5Provider)
    this.coreReader = new CoreParentToChildMessageReader(
      wrappedProvider,
      chainId,
      sender,
      messageNumber.toBigInt(),
      parentBaseFee.toBigInt(),
      {
        destAddress: messageData.destAddress,
        l2CallValue: messageData.l2CallValue.toBigInt(),
        l1Value: messageData.l1Value.toBigInt(),
        maxSubmissionFee: messageData.maxSubmissionFee.toBigInt(),
        excessFeeRefundAddress: messageData.excessFeeRefundAddress,
        callValueRefundAddress: messageData.callValueRefundAddress,
        gasLimit: messageData.gasLimit.toBigInt(),
        maxFeePerGas: messageData.maxFeePerGas.toBigInt(),
        data: messageData.data,
      }
    )
  }

  /**
   * Try to get the receipt for the retryable ticket creation.
   */
  public async getRetryableCreationReceipt(
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    const coreReceipt = await this.coreReader.getRetryableCreationReceipt()
    if (!coreReceipt) return null
    return toEthersReceipt(coreReceipt)
  }

  /**
   * Get the auto-redeem attempt receipt.
   */
  public async getAutoRedeemAttempt(): Promise<TransactionReceipt | null> {
    const coreReceipt = await this.coreReader.getAutoRedeemAttempt()
    if (!coreReceipt) return null
    return toEthersReceipt(coreReceipt)
  }

  /**
   * Get the successful redeem result.
   */
  public async getSuccessfulRedeem(): Promise<ParentToChildMessageWaitForStatusResult> {
    const coreResult = await this.coreReader.getSuccessfulRedeem()
    if (coreResult.status === ParentToChildMessageStatus.REDEEMED) {
      return {
        status: ParentToChildMessageStatus.REDEEMED,
        childTxReceipt: toEthersReceipt(coreResult.childTxReceipt),
      }
    }
    return { status: coreResult.status }
  }

  /**
   * Get the current status of this message.
   */
  public async status(): Promise<ParentToChildMessageStatus> {
    return await this.coreReader.status()
  }

  /**
   * Wait for the retryable ticket to be created and get the final status.
   */
  public async waitForStatus(
    confirmations?: number,
    timeout?: number
  ): Promise<ParentToChildMessageWaitForStatusResult> {
    const coreResult = await this.coreReader.waitForStatus(timeout)
    if (coreResult.status === ParentToChildMessageStatus.REDEEMED) {
      return {
        status: ParentToChildMessageStatus.REDEEMED,
        childTxReceipt: toEthersReceipt(coreResult.childTxReceipt),
      }
    }
    return { status: coreResult.status }
  }

  /**
   * The minimum lifetime of a retryable tx.
   */
  public static async getLifetime(childProvider: Provider): Promise<BigNumber> {
    // Default: 7 days in seconds
    return BigNumber.from(7 * 24 * 60 * 60)
  }

  /**
   * Timestamp at which this message expires.
   */
  public async getTimeout(): Promise<BigNumber> {
    // Delegate to the core reader's wrapped provider to call the contract
    const wrappedProvider = wrapProvider(this.childProvider as unknown as Ethers5Provider)
    const { ArbitrumContract, ArbRetryableTxAbi, ARB_RETRYABLE_TX_ADDRESS } = await import('@arbitrum/core')
    const arbRetryableTx = new ArbitrumContract(
      ArbRetryableTxAbi,
      ARB_RETRYABLE_TX_ADDRESS,
      wrappedProvider
    )
    const result = await arbRetryableTx.read('getTimeout', [this.retryableCreationId])
    return BigNumber.from(result[0] as bigint)
  }

  /**
   * Address to which CallValue will be credited if the retryable ticket times out or is cancelled.
   */
  public async getBeneficiary(): Promise<string> {
    const wrappedProvider = wrapProvider(this.childProvider as unknown as Ethers5Provider)
    const { ArbitrumContract, ArbRetryableTxAbi, ARB_RETRYABLE_TX_ADDRESS } = await import('@arbitrum/core')
    const arbRetryableTx = new ArbitrumContract(
      ArbRetryableTxAbi,
      ARB_RETRYABLE_TX_ADDRESS,
      wrappedProvider
    )
    const result = await arbRetryableTx.read('getBeneficiary', [this.retryableCreationId])
    return result[0] as string
  }
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export class ParentToChildMessageWriter extends ParentToChildMessageReader {
  public constructor(
    public readonly chainSigner: Signer,
    chainId: number,
    sender: string,
    messageNumber: BigNumber,
    parentBaseFee: BigNumber,
    messageData: RetryableMessageParams
  ) {
    super(
      chainSigner.provider!,
      chainId,
      sender,
      messageNumber,
      parentBaseFee,
      messageData
    )
    if (!chainSigner.provider) {
      throw new ArbSdkError('Signer not connected to provider.')
    }
  }

  /**
   * Manually redeem the retryable ticket.
   */
  public async redeem(overrides?: Overrides): Promise<RedeemTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD) {
      const txRequest = getRedeemRequest(this.retryableCreationId)

      const redeemTx = await this.chainSigner.sendTransaction({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value,
        ...overrides,
      })

      return ChildTransactionReceipt.toRedeemTransaction(
        ChildTransactionReceipt.monkeyPatchWait(redeemTx as ContractTransaction),
        this.childProvider
      )
    } else {
      throw new ArbSdkError(
        `Cannot redeem as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD
          ]
        }.`
      )
    }
  }

  /**
   * Cancel the retryable ticket.
   */
  public async cancel(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD) {
      const txRequest = getCancelRetryableRequest(this.retryableCreationId)

      return (await this.chainSigner.sendTransaction({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value,
        ...overrides,
      })) as ContractTransaction
    } else {
      throw new ArbSdkError(
        `Cannot cancel as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD
          ]
        }.`
      )
    }
  }

  /**
   * Increase the timeout of a retryable ticket.
   */
  public async keepAlive(overrides?: Overrides): Promise<ContractTransaction> {
    const status = await this.status()
    if (status === ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD) {
      const txRequest = getKeepAliveRequest(this.retryableCreationId)

      return (await this.chainSigner.sendTransaction({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value,
        ...overrides,
      })) as ContractTransaction
    } else {
      throw new ArbSdkError(
        `Cannot keep alive as retryable does not exist. Message status: ${
          ParentToChildMessageStatus[status]
        } must be: ${
          ParentToChildMessageStatus[
            ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD
          ]
        }.`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// EthDepositMessage
// ---------------------------------------------------------------------------

export class EthDepositMessage {
  public readonly childTxHash: string
  private childTxReceipt: TransactionReceipt | undefined | null

  public static calculateDepositTxId(
    childChainId: number,
    messageNumber: BigNumber,
    fromAddress: string,
    toAddress: string,
    value: BigNumber
  ): string {
    return calculateDepositTxId({
      chainId: childChainId,
      messageNumber: messageNumber.toBigInt(),
      fromAddress,
      toAddress,
      value: value.toBigInt(),
    })
  }

  /**
   * Create an EthDepositMessage from event data.
   */
  public static fromEventComponents(
    childProvider: Provider,
    childChainId: number,
    messageNumber: BigNumber,
    senderAddr: string,
    inboxMessageEventData: string
  ): EthDepositMessage {
    // Parse the packed data: 20-byte address + remaining value
    const hex = inboxMessageEventData.startsWith('0x')
      ? inboxMessageEventData.slice(2)
      : inboxMessageEventData
    const addressEnd = 40
    const to = '0x' + hex.substring(0, addressEnd)
    const value = BigNumber.from('0x' + hex.substring(addressEnd))

    return new EthDepositMessage(
      childProvider,
      childChainId,
      messageNumber,
      senderAddr,
      to,
      value
    )
  }

  constructor(
    private readonly childProvider: Provider,
    public readonly childChainId: number,
    public readonly messageNumber: BigNumber,
    public readonly from: string,
    public readonly to: string,
    public readonly value: BigNumber
  ) {
    this.childTxHash = EthDepositMessage.calculateDepositTxId(
      childChainId,
      messageNumber,
      from,
      to,
      value
    )
  }

  public async status(): Promise<EthDepositMessageStatus> {
    const wrappedProvider = wrapProvider(this.childProvider as unknown as Ethers5Provider)
    const receipt = await wrappedProvider.getTransactionReceipt(this.childTxHash)
    if (receipt === null) return EthDepositMessageStatus.PENDING
    return EthDepositMessageStatus.DEPOSITED
  }

  public async wait(
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt | null> {
    const chosenTimeout = isDefined(timeout) ? timeout : DEFAULT_DEPOSIT_TIMEOUT

    if (this.childTxReceipt !== undefined) {
      return this.childTxReceipt ?? null
    }

    const wrappedProvider = wrapProvider(this.childProvider as unknown as Ethers5Provider)
    const startTime = Date.now()
    while (Date.now() - startTime < chosenTimeout) {
      const receipt = await wrappedProvider.getTransactionReceipt(this.childTxHash)
      if (receipt) {
        const ethersReceipt = toEthersReceipt(receipt)
        this.childTxReceipt = ethersReceipt
        return ethersReceipt
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    this.childTxReceipt = null
    return null
  }
}
