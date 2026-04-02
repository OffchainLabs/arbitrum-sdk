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
import { EventFetcher } from '../utils/eventFetcher'
import { ArbRetryableTxAbi } from '../abi/ArbRetryableTx'
import { ARB_RETRYABLE_TX_ADDRESS, SEVEN_DAYS_IN_SECONDS } from '../constants'
import { ArbSdkError, ContractCallError } from '../errors'
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
   *
   * Full implementation that scans blocks for RedeemScheduled events
   * across the ticket's full lifetime, including handling LifetimeExtended events.
   *
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

    // Retryable doesn't exist and wasn't auto-redeemed successfully.
    // Scan blocks from creation to timeout for manual RedeemScheduled events.
    return this.scanForManualRedeem(creationReceipt)
  }

  /**
   * Scan blocks from creation through the ticket's lifetime looking for
   * a successful manual redeem. Handles LifetimeExtended events that push
   * out the timeout window.
   *
   * Follows the same algorithm as the old SDK's getSuccessfulRedeem.
   */
  private async scanForManualRedeem(
    creationReceipt: ArbitrumTransactionReceipt
  ): Promise<ParentToChildMessageWaitForStatusResult> {
    const eventFetcher = new EventFetcher(this.childProvider)

    let increment = 1000
    let fromBlock = await this.childProvider.getBlock(creationReceipt.blockNumber)
    if (!fromBlock) {
      return { status: ParentToChildMessageStatus.EXPIRED }
    }

    let timeout = fromBlock.timestamp + SEVEN_DAYS_IN_SECONDS
    const queriedRange: { from: number; to: number }[] = []
    const maxBlock = await this.childProvider.getBlockNumber()

    while (fromBlock.number < maxBlock) {
      const toBlockNumber = Math.min(fromBlock.number + increment, maxBlock)
      const outerBlockRange = { from: fromBlock.number, to: toBlockNumber }
      queriedRange.push(outerBlockRange)

      // Search for RedeemScheduled events in this block range
      const redeemEvents = await eventFetcher.getEvents(
        ArbRetryableTxAbi,
        'RedeemScheduled',
        {
          fromBlock: outerBlockRange.from,
          toBlock: outerBlockRange.to,
          address: ARB_RETRYABLE_TX_ADDRESS,
        }
      )

      // Filter events for this specific retryable ticket
      const relevantRedeemEvents = redeemEvents.filter(
        e => (e.args.ticketId as string) === this.retryableCreationId
      )

      // Check if any of these redeems were successful
      const receipts = await Promise.all(
        relevantRedeemEvents.map(e =>
          this.childProvider.getTransactionReceipt(e.args.retryTxHash as string)
        )
      )
      const successfulRedeems = receipts.filter(
        r => isDefined(r) && r.status === 1
      ) as ArbitrumTransactionReceipt[]

      if (successfulRedeems.length > 1) {
        throw new ArbSdkError(
          `Unexpected number of successful redeems. Expected only one redeem for ticket ${this.retryableCreationId}, but found ${successfulRedeems.length}.`
        )
      }
      if (successfulRedeems.length === 1) {
        return {
          childTxReceipt: successfulRedeems[0],
          status: ParentToChildMessageStatus.REDEEMED,
        }
      }

      const toBlock = await this.childProvider.getBlock(toBlockNumber)
      if (!toBlock) break

      if (toBlock.timestamp > timeout) {
        // Check for LifetimeExtended events in the queried ranges
        while (queriedRange.length > 0) {
          const blockRange = queriedRange.shift()!
          const keepaliveEvents = await eventFetcher.getEvents(
            ArbRetryableTxAbi,
            'LifetimeExtended',
            {
              fromBlock: blockRange.from,
              toBlock: blockRange.to,
              address: ARB_RETRYABLE_TX_ADDRESS,
            }
          )

          // Filter for this ticket's keepalive events
          const relevantKeepalives = keepaliveEvents.filter(
            e => (e.args.ticketId as string) === this.retryableCreationId
          )

          if (relevantKeepalives.length > 0) {
            // Update timeout to the latest extended timeout
            const newTimeouts = relevantKeepalives.map(
              e => Number(e.args.newTimeout as bigint)
            )
            timeout = Math.max(...newTimeouts)
            break
          }
        }

        // If still past timeout after checking keepalives, the ticket expired
        if (toBlock.timestamp > timeout) break

        // Clear queried ranges except the last one (may contain more keepalives)
        while (queriedRange.length > 1) queriedRange.shift()
      }

      // Adjust increment to cover approximately 1 day per query
      const processedSeconds = toBlock.timestamp - fromBlock.timestamp
      if (processedSeconds !== 0) {
        increment = Math.ceil((increment * 86400) / processedSeconds)
      }

      fromBlock = toBlock
    }

    // If we searched the entire lifetime without finding a redeem, it expired
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
    } catch (err) {
      // NoTicketWithID error means ticket doesn't exist
      if (err instanceof ContractCallError && err.isCallException) {
        return false
      }
      throw err
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
