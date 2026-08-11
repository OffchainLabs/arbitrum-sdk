/**
 * Pure functions for parsing specific Arbitrum event types from
 * transaction receipt logs.
 *
 * Each function takes a receipt (or its logs) and returns decoded
 * event objects using the core ABI decoder.
 */
import { ArbitrumContract, type ParsedEventLog } from '../contracts/Contract'
import type { ArbitrumLog, ArbitrumTransactionReceipt } from '../interfaces/types'
import { BridgeAbi } from '../abi/Bridge'
import { InboxAbi } from '../abi/Inbox'
import { ArbSysAbi } from '../abi/ArbSys'
import { ArbRetryableTxAbi } from '../abi/ArbRetryableTx'

// Singleton contract instances for parsing (address doesn't matter for log parsing)
const bridgeContract = new ArbitrumContract(BridgeAbi, '0x0000000000000000000000000000000000000000')
const inboxContract = new ArbitrumContract(InboxAbi, '0x0000000000000000000000000000000000000000')
const arbSysContract = new ArbitrumContract(ArbSysAbi, '0x0000000000000000000000000000000000000000')
const arbRetryableTxContract = new ArbitrumContract(ArbRetryableTxAbi, '0x0000000000000000000000000000000000000000')

/**
 * Parse MessageDelivered events from the Bridge contract out of receipt logs.
 *
 * Event signature: MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc,
 *   address inbox, uint8 kind, address sender, bytes32 messageDataHash, uint256 baseFeeL1, uint64 timestamp)
 */
export function getMessageDeliveredEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): ParsedEventLog[] {
  const logs = Array.isArray(receipt) ? receipt : receipt.logs
  return bridgeContract.parseEventLogs('MessageDelivered', logs)
}

/**
 * Parse InboxMessageDelivered events from the Inbox contract out of receipt logs.
 *
 * Event signature: InboxMessageDelivered(uint256 indexed messageNum, bytes data)
 */
export function getInboxMessageDeliveredEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): ParsedEventLog[] {
  const logs = Array.isArray(receipt) ? receipt : receipt.logs
  return inboxContract.parseEventLogs('InboxMessageDelivered', logs)
}

/**
 * Parse L2ToL1Tx events from ArbSys out of receipt logs.
 *
 * Event signature: L2ToL1Tx(address caller, address indexed destination,
 *   uint256 indexed hash, uint256 indexed position, uint256 arbBlockNum,
 *   uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)
 */
export function getChildToParentEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): ParsedEventLog[] {
  const logs = Array.isArray(receipt) ? receipt : receipt.logs
  return arbSysContract.parseEventLogs('L2ToL1Tx', logs)
}

/**
 * Parse RedeemScheduled events from ArbRetryableTx out of receipt logs.
 *
 * Event signature: RedeemScheduled(bytes32 indexed ticketId, bytes32 indexed retryTxHash,
 *   uint64 indexed sequenceNum, uint64 donatedGas, address gasDonor, uint256 maxRefund,
 *   uint256 submissionFeeRefund)
 */
export function getRedeemScheduledEvents(
  receipt: ArbitrumTransactionReceipt | ArbitrumLog[]
): ParsedEventLog[] {
  const logs = Array.isArray(receipt) ? receipt : receipt.logs
  return arbRetryableTxContract.parseEventLogs('RedeemScheduled', logs)
}
