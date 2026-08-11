/**
 * Message lifecycle functions for ethers v5 users.
 *
 * These functions accept ethers v5 TransactionReceipt and Provider,
 * converting them internally to core types.
 */
import type { providers } from 'ethers'
import {
  getParentToChildMessages as coreGetParentToChildMessages,
  getChildToParentMessages as coreGetChildToParentMessages,
  type ArbitrumNetwork,
  type ParentToChildMessageReader,
  type ChildToParentMessageReader,
} from '@arbitrum/core'
import { wrapProvider, fromEthersReceipt, type Ethers5Provider, type Ethers5Receipt } from './adapter'

// ---------------------------------------------------------------------------
// Re-exports that don't need provider wrapping
// ---------------------------------------------------------------------------

export {
  ParentToChildMessageReader,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
  ChildToParentMessageReader,
  getExecuteRequest,
  EthDepositMessage,
  getEthDeposits,
  getMessageEvents,
  getTokenDepositEvents,
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
  InboxMessageKind,
} from '@arbitrum/core'

export type {
  ParentToChildMessageWaitForStatusResult,
  MessageEventPair,
  ChildToParentEventData,
  RetryableMessageParams,
} from '@arbitrum/core'

// ---------------------------------------------------------------------------
// Wrapped functions
// ---------------------------------------------------------------------------

/**
 * Get parent-to-child messages from an ethers v5 transaction receipt.
 *
 * Converts the ethers v5 receipt to ArbitrumTransactionReceipt and wraps
 * the child provider as ArbitrumProvider.
 */
export function getParentToChildMessages(
  receipt: providers.TransactionReceipt,
  childProvider: providers.Provider,
  network: ArbitrumNetwork
): ParentToChildMessageReader[] {
  const coreReceipt = fromEthersReceipt(receipt as unknown as Ethers5Receipt)
  const coreProvider = wrapProvider(childProvider as unknown as Ethers5Provider)
  return coreGetParentToChildMessages(coreReceipt, coreProvider, network)
}

/**
 * Get child-to-parent messages from an ethers v5 transaction receipt.
 *
 * Converts the ethers v5 receipt to ArbitrumTransactionReceipt and wraps
 * the parent provider as ArbitrumProvider.
 */
export function getChildToParentMessages(
  receipt: providers.TransactionReceipt,
  parentProvider: providers.Provider,
  network: ArbitrumNetwork
): ChildToParentMessageReader[] {
  const coreReceipt = fromEthersReceipt(receipt as unknown as Ethers5Receipt)
  const coreProvider = wrapProvider(parentProvider as unknown as Ethers5Provider)
  return coreGetChildToParentMessages(coreReceipt, coreProvider, network)
}
