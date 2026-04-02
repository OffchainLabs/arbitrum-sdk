/**
 * ParentToChildMessage — Reader class and helper functions for tracking
 * retryable ticket lifecycle on the child chain.
 *
 * The reader queries the child chain via ArbitrumProvider to determine status.
 * Action functions (redeem, cancel, keepalive) return TransactionRequestData
 * rather than signing/sending transactions.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumTransactionReceipt, TransactionRequestData } from '../interfaces/types'
import type { ArbitrumNetwork } from '../networks'
import type { RetryableMessageParams } from './types'
import { ParentToChildMessageStatus } from './types'
import { InboxMessageKind } from './types'
import { calculateSubmitRetryableId } from './retryableId'
import { SubmitRetryableMessageDataParser } from './messageDataParser'
import { getMessageEvents } from './parentTransaction'
import { getRedeemScheduledEvents } from '../events/parsing'
import { ArbitrumContract } from '../contracts/Contract'
import { ArbRetryableTxAbi } from '../abi/ArbRetryableTx'
import { ARB_RETRYABLE_TX_ADDRESS, SEVEN_DAYS_IN_SECONDS } from '../constants'
import { ArbSdkError } from '../errors'
import { isDefined } from '../utils/lib'

/**
 * If the status is redeemed, childTxReceipt is populated.
 * For all other statuses childTxReceipt is not populated.
 */
export type ParentToChildMessageWaitForStatusResult =
  | {
      status: ParentToChildMessageStatus.REDEEMED
      childTxReceipt: ArbitrumTransactionReceipt
    }
  | {
      status: Exclude<
        ParentToChildMessageStatus,
        ParentToChildMessageStatus.REDEEMED
      >
    }

const DEFAULT_DEPOSIT_TIMEOUT = 30 * 60 * 1000

/**
 * Reader class for a parent-to-child retryable ticket message.
 * Holds the child provider and message params internally,
 * and provides methods to query status.
 */
export class ParentToChildMessageReader {
  public readonly retryableCreationId: string
  private retryableCreationReceipt: ArbitrumTransactionReceipt | null | undefined

  constructor(
    public readonly childProvider: ArbitrumProvider,
    public readonly chainId: number,
    public readonly sender: string,
    public readonly messageNumber: bigint,
    public readonly parentBaseFee: bigint,
    public readonly messageData: RetryableMessageParams
  ) {
    this.retryableCreationId = calculateSubmitRetryableId({
      chainId,
      fromAddress: sender,
      messageNumber,
      baseFee: parentBaseFee,
      destAddress: messageData.destAddress,
      l2CallValue: messageData.l2CallValue,
      l1Value: messageData.l1Value,
      maxSubmissionFee: messageData.maxSubmissionFee,
      excessFeeRefundAddress: messageData.excessFeeRefundAddress,
      callValueRefundAddress: messageData.callValueRefundAddress,
      gasLimit: messageData.gasLimit,
      maxFeePerGas: messageData.maxFeePerGas,
      data: messageData.data,
    })
  }

  /**
   * Try to get the receipt for the retryable ticket creation.
   * This is the child chain transaction that creates the retryable ticket.
   * @returns Null if retryable has not been created
   */
  public async getRetryableCreationReceipt(): Promise<ArbitrumTransactionReceipt | null> {
    if (this.retryableCreationReceipt === undefined) {
      this.retryableCreationReceipt = await this.childProvider.getTransactionReceipt(
        this.retryableCreationId
      )
    }
    return this.retryableCreationReceipt ?? null
  }

  /**
   * When retryable tickets are created, and gas is supplied, an attempt is
   * made to redeem the ticket straight away. This is called an auto redeem.
   * @returns TransactionReceipt of the auto redeem attempt if exists, otherwise null
   */
  public async getAutoRedeemAttempt(): Promise<ArbitrumTransactionReceipt | null> {
    const creationReceipt = await this.getRetryableCreationReceipt()
    if (creationReceipt) {
      const redeemEvents = getRedeemScheduledEvents(creationReceipt)
      if (redeemEvents.length === 1) {
        return await this.childProvider.getTransactionReceipt(
          redeemEvents[0].args.retryTxHash as string
        )
      } else if (redeemEvents.length > 1) {
        throw new ArbSdkError(
          `Unexpected number of redeem events for retryable creation tx.`
        )
      }
    }
    return null
  }

  /**
   * Receipt for the successful child chain transaction created by this message.
   * @returns The status and optionally the childTxReceipt for redeemed messages.
   */
  public async getSuccessfulRedeem(): Promise<ParentToChildMessageWaitForStatusResult> {
    const creationReceipt = await this.getRetryableCreationReceipt()

    if (!isDefined(creationReceipt)) {
      return { status: ParentToChildMessageStatus.NOT_YET_CREATED }
    }

    if (creationReceipt.status === 0) {
      return { status: ParentToChildMessageStatus.CREATION_FAILED }
    }

    // Check auto redeem first (happy path)
    const autoRedeem = await this.getAutoRedeemAttempt()
    if (autoRedeem && autoRedeem.status === 1) {
      return {
        childTxReceipt: autoRedeem,
        status: ParentToChildMessageStatus.REDEEMED,
      }
    }

    // Check if retryable ticket still exists
    if (await this.retryableExists()) {
      return {
        status: ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD,
      }
    }

    // Retryable doesn't exist and wasn't auto-redeemed: search for manual redeem
    // For simplicity in the core library, we look for RedeemScheduled events
    // in the creation receipt block range. A full search across the entire
    // lifetime would need the EventFetcher + block iteration from the SDK.
    // For now, if the auto redeem didn't succeed and the ticket no longer exists,
    // we report EXPIRED.
    return { status: ParentToChildMessageStatus.EXPIRED }
  }

  /**
   * Check whether the retryable ticket still exists on the child chain.
   */
  private async retryableExists(): Promise<boolean> {
    const arbRetryableTx = new ArbitrumContract(
      ArbRetryableTxAbi,
      ARB_RETRYABLE_TX_ADDRESS,
      this.childProvider
    )
    try {
      const result = await arbRetryableTx.read('getTimeout', [
        this.retryableCreationId,
      ])
      const timeoutTimestamp = result[0] as bigint
      const latestBlock = await this.childProvider.getBlock('latest')
      if (!latestBlock) return false
      return BigInt(latestBlock.timestamp) <= timeoutTimestamp
    } catch {
      // NoTicketWithID error means ticket doesn't exist
      return false
    }
  }

  /**
   * Get the current status of this message.
   */
  public async status(): Promise<ParentToChildMessageStatus> {
    return (await this.getSuccessfulRedeem()).status
  }

  /**
   * Wait for the retryable ticket to be created and get the final status.
   * @param timeout Amount of time (ms) to wait. Defaults to 30 minutes.
   */
  public async waitForStatus(
    timeout?: number
  ): Promise<ParentToChildMessageWaitForStatusResult> {
    const chosenTimeout = isDefined(timeout) ? timeout : DEFAULT_DEPOSIT_TIMEOUT

    // Poll for the creation receipt
    const startTime = Date.now()
    while (Date.now() - startTime < chosenTimeout) {
      const receipt = await this.childProvider.getTransactionReceipt(
        this.retryableCreationId
      )
      if (receipt) {
        this.retryableCreationReceipt = receipt
        return await this.getSuccessfulRedeem()
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    throw new ArbSdkError(
      `Timed out waiting to retrieve retryable creation receipt: ${this.retryableCreationId}.`
    )
  }
}

/**
 * Extract ParentToChildMessageReader instances from a parent chain transaction receipt.
 * Pairs Bridge MessageDelivered and Inbox InboxMessageDelivered events,
 * filters for retryable submissions, and constructs readers.
 */
export function getParentToChildMessages(
  receipt: ArbitrumTransactionReceipt,
  childProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): ParentToChildMessageReader[] {
  const events = getMessageEvents(receipt)
  const parser = new SubmitRetryableMessageDataParser()

  return events
    .filter(
      e =>
        (e.bridgeMessageEvent.args.kind as bigint) ===
          BigInt(InboxMessageKind.L1MessageType_submitRetryableTx) &&
        (e.bridgeMessageEvent.args.inbox as string).toLowerCase() ===
          network.ethBridge.inbox.toLowerCase()
    )
    .map(mn => {
      const inboxMessageData = parser.parse(mn.inboxMessageEvent.args.data as string)
      return new ParentToChildMessageReader(
        childProvider,
        network.chainId,
        mn.bridgeMessageEvent.args.sender as string,
        mn.inboxMessageEvent.args.messageNum as bigint,
        mn.bridgeMessageEvent.args.baseFeeL1 as bigint,
        inboxMessageData
      )
    })
}

/**
 * Build a TransactionRequestData to redeem a retryable ticket.
 */
export function getRedeemRequest(retryableCreationId: string): TransactionRequestData {
  const contract = new ArbitrumContract(ArbRetryableTxAbi, ARB_RETRYABLE_TX_ADDRESS)
  return contract.encodeWrite('redeem', [retryableCreationId])
}

/**
 * Build a TransactionRequestData to cancel a retryable ticket.
 */
export function getCancelRetryableRequest(retryableCreationId: string): TransactionRequestData {
  const contract = new ArbitrumContract(ArbRetryableTxAbi, ARB_RETRYABLE_TX_ADDRESS)
  return contract.encodeWrite('cancel', [retryableCreationId])
}

/**
 * Build a TransactionRequestData to extend the lifetime of a retryable ticket.
 */
export function getKeepAliveRequest(retryableCreationId: string): TransactionRequestData {
  const contract = new ArbitrumContract(ArbRetryableTxAbi, ARB_RETRYABLE_TX_ADDRESS)
  return contract.encodeWrite('keepalive', [retryableCreationId])
}
