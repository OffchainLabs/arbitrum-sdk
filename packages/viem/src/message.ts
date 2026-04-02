/**
 * Message lifecycle functions with viem-native type signatures.
 *
 * Functions that accept a provider use viem PublicClient.
 * Functions that accept a receipt use core ArbitrumTransactionReceipt
 * (users should convert via fromViemReceipt first).
 */
import {
  getParentToChildMessages as coreGetParentToChildMessages,
  getChildToParentMessages as coreGetChildToParentMessages,
  getRedeemRequest as coreGetRedeemRequest,
  getCancelRetryableRequest as coreGetCancelRetryableRequest,
  getKeepAliveRequest as coreGetKeepAliveRequest,
  getExecuteRequest as coreGetExecuteRequest,
  getEthDeposits as coreGetEthDeposits,
  EthDepositMessage,
  getMessageEvents,
  getTokenDepositEvents,
} from '@arbitrum/core'
import type {
  ArbitrumTransactionReceipt,
  ArbitrumNetwork,
  TransactionRequestData,
  ChildToParentEventData,
  ParentToChildMessageReader,
  ChildToParentMessageReader,
  MessageEventPair,
} from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

/**
 * Extract ParentToChildMessageReader instances from a parent chain transaction receipt.
 * Accepts a viem PublicClient for the child chain.
 */
export function getParentToChildMessages(
  receipt: ArbitrumTransactionReceipt,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork
): ParentToChildMessageReader[] {
  return coreGetParentToChildMessages(
    receipt,
    wrapPublicClient(childProvider),
    network
  )
}

/**
 * Extract ChildToParentMessageReader instances from a child chain transaction receipt.
 * Accepts a viem PublicClient for the parent chain.
 */
export function getChildToParentMessages(
  receipt: ArbitrumTransactionReceipt,
  parentProvider: ViemPublicClient,
  network: ArbitrumNetwork
): ChildToParentMessageReader[] {
  return coreGetChildToParentMessages(
    receipt,
    wrapPublicClient(parentProvider),
    network
  )
}

/**
 * Build a TransactionRequestData to redeem a retryable ticket.
 * Pure calldata builder — no provider needed.
 */
export function getRedeemRequest(
  retryableCreationId: string
): TransactionRequestData {
  return coreGetRedeemRequest(retryableCreationId)
}

/**
 * Build a TransactionRequestData to cancel a retryable ticket.
 * Pure calldata builder — no provider needed.
 */
export function getCancelRetryableRequest(
  retryableCreationId: string
): TransactionRequestData {
  return coreGetCancelRetryableRequest(retryableCreationId)
}

/**
 * Build a TransactionRequestData to extend the lifetime of a retryable ticket.
 * Pure calldata builder — no provider needed.
 */
export function getKeepAliveRequest(
  retryableCreationId: string
): TransactionRequestData {
  return coreGetKeepAliveRequest(retryableCreationId)
}

/**
 * Build a TransactionRequestData to execute a child-to-parent message
 * through the Outbox contract.
 * Pure calldata builder — no provider needed.
 */
export function getExecuteRequest(
  event: ChildToParentEventData,
  proof: string[],
  network: ArbitrumNetwork
): TransactionRequestData {
  return coreGetExecuteRequest(event, proof, network)
}

/**
 * Extract EthDepositMessage instances from a parent chain transaction receipt.
 * Accepts a viem PublicClient for the child chain.
 */
export function getEthDeposits(
  receipt: ArbitrumTransactionReceipt,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork
): EthDepositMessage[] {
  return coreGetEthDeposits(receipt, wrapPublicClient(childProvider), network)
}

// Re-export provider-agnostic functions and types
export { EthDepositMessage, getMessageEvents, getTokenDepositEvents }
export type {
  ParentToChildMessageReader,
  ChildToParentMessageReader,
  ChildToParentEventData,
  MessageEventPair,
}
