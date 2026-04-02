/**
 * Pure functions for parsing events from parent chain transaction receipts.
 *
 * These pair MessageDelivered (Bridge) and InboxMessageDelivered (Inbox) events,
 * and also parse DepositInitiated events from L1ERC20Gateway.
 */
import {
  getMessageDeliveredEvents,
  getInboxMessageDeliveredEvents,
} from '../events/parsing'
import { ArbitrumContract, type ParsedEventLog } from '../contracts/Contract'
import type { ArbitrumLog, ArbitrumTransactionReceipt } from '../interfaces/types'
import { L1ERC20GatewayAbi } from '../abi/L1ERC20Gateway'
import { ArbSdkError } from '../errors'

const l1Erc20GatewayContract = new ArbitrumContract(
  L1ERC20GatewayAbi,
  '0x0000000000000000000000000000000000000000'
)

export interface MessageEventPair {
  inboxMessageEvent: ParsedEventLog
  bridgeMessageEvent: ParsedEventLog
}

/**
 * Get combined data for any InboxMessageDelivered and MessageDelivered events
 * emitted during this transaction. Pairs them by matching messageNum (inbox)
 * to messageIndex (bridge).
 */
export function getMessageEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): MessageEventPair[] {
  const bridgeMessages = getMessageDeliveredEvents(receipt)
  const inboxMessages = getInboxMessageDeliveredEvents(receipt)

  if (bridgeMessages.length !== inboxMessages.length) {
    throw new ArbSdkError(
      `Unexpected missing events. Inbox message count: ${inboxMessages.length} does not equal bridge message count: ${bridgeMessages.length}.`
    )
  }

  const messages: MessageEventPair[] = []
  for (const bm of bridgeMessages) {
    const im = inboxMessages.find(
      i => (i.args.messageNum as bigint) === (bm.args.messageIndex as bigint)
    )
    if (!im) {
      throw new ArbSdkError(
        `Unexpected missing event for message index: ${String(bm.args.messageIndex)}.`
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
 * Parse DepositInitiated events from L1ERC20Gateway contract logs.
 */
export function getTokenDepositEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): ParsedEventLog[] {
  const logs = Array.isArray(receipt) ? receipt : receipt.logs
  return l1Erc20GatewayContract.parseEventLogs('DepositInitiated', logs)
}
