/**
 * Backwards-compatible facade layer for @arbitrum/sdk.
 *
 * Presents the same class-based, ethers v5 API as the old SDK,
 * internally delegating to @arbitrum/core and @arbitrum/ethers5.
 */

// Conversion utilities
export {
  toBigInt,
  toBigNumber,
  toCoreReceipt,
  toEthersReceipt,
  toCoreLog,
  toEthersLog,
} from './convert'

// Types and enums
export {
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
  SignerProviderUtils,
} from './types'
export type {
  SignerOrProvider,
  RetryableMessageParams,
  ParentToChildMessageWaitForStatusResult,
  EthDepositMessageWaitForStatusResult,
} from './types'

// Parent transaction receipts and monkey-patching
export {
  ParentTransactionReceipt,
  ParentEthDepositTransactionReceipt,
  ParentContractCallTransactionReceipt,
} from './parentTransaction'
export type {
  ParentContractTransaction,
  ParentEthDepositTransaction,
  ParentContractCallTransaction,
} from './parentTransaction'

// Child transaction receipts and monkey-patching
export { ChildTransactionReceipt } from './childTransaction'
export type {
  ChildContractTransaction,
  RedeemTransaction,
} from './childTransaction'

// Parent-to-child message classes
export {
  ParentToChildMessage,
  ParentToChildMessageReader,
  ParentToChildMessageWriter,
  EthDepositMessage,
} from './parentToChildMessage'
export type { ParentToChildMessageReaderOrWriter } from './parentToChildMessage'

// Child-to-parent message classes
export {
  ChildToParentMessage,
  ChildToParentMessageReader,
  ChildToParentMessageWriter,
} from './childToParentMessage'
export type {
  ChildToParentTransactionEvent,
  ChildToParentMessageReaderOrWriter,
} from './childToParentMessage'

// Bridger facades
export { EthBridger } from './ethBridger'
export { Erc20Bridger, AdminErc20Bridger } from './erc20Bridger'

// Gas estimator
export { ParentToChildMessageGasEstimator } from './gasEstimator'

// Message creator
export { ParentToChildMessageCreator } from './messageCreator'

// Inbox tools
export { InboxTools } from './inboxTools'

// Address
export { Address } from './address'

// ArbitrumProvider
export { ArbitrumProvider } from './arbProvider'

// EventFetcher
export { EventFetcher } from './eventFetcher'

// MultiCaller
export { MultiCaller } from './multicall'

// L1-L3 bridger
export { Erc20L1L3Bridger, EthL1L3Bridger } from './l1l3Bridger'
