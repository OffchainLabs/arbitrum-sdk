/**
 * Message lifecycle functions for ethers v6 users.
 *
 * These functions accept ethers v6 TransactionReceipt and Provider,
 * converting them internally to core types.
 */
import {
  getParentToChildMessages as coreGetParentToChildMessages,
  getChildToParentMessages as coreGetChildToParentMessages,
  type ArbitrumNetwork,
  type ParentToChildMessageReader,
  type ChildToParentMessageReader,
} from '@arbitrum/core'
import {
  wrapProvider,
  fromEthersReceipt,
  type Ethers6Provider,
  type Ethers6Receipt,
} from './adapter'

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
 * Get parent-to-child messages from an ethers v6 transaction receipt.
 *
 * Converts the ethers v6 receipt to ArbitrumTransactionReceipt and wraps
 * the child provider as ArbitrumProvider.
 */
export function getParentToChildMessages(
  receipt: Ethers6Receipt,
  childProvider: Ethers6Provider,
  network: ArbitrumNetwork
): ParentToChildMessageReader[] {
  const coreReceipt = fromEthersReceipt(receipt)
  const coreProvider = wrapProvider(childProvider)
  return coreGetParentToChildMessages(coreReceipt, coreProvider, network)
}

/**
 * Get child-to-parent messages from an ethers v6 transaction receipt.
 *
 * Converts the ethers v6 receipt to ArbitrumTransactionReceipt and wraps
 * the parent provider as ArbitrumProvider.
 */
export function getChildToParentMessages(
  receipt: Ethers6Receipt,
  parentProvider: Ethers6Provider,
  network: ArbitrumNetwork
): ChildToParentMessageReader[] {
  const coreReceipt = fromEthersReceipt(receipt)
  const coreProvider = wrapProvider(parentProvider)
  return coreGetChildToParentMessages(coreReceipt, coreProvider, network)
}
