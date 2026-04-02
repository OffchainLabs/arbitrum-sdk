/**
 * @arbitrum/ethers6 — Ethers v6 adapter for the Arbitrum SDK.
 *
 * Users install this package and pass ethers v6 Provider / TransactionReceipt
 * directly. All bigint types pass through natively (no conversion needed).
 *
 * Usage:
 *   import { getDepositRequest, getArbitrumNetwork } from '@arbitrum/ethers6'
 *   const network = getArbitrumNetwork(42161)
 *   const tx = getDepositRequest({ network, amount: 1000n, from: '0x...' })
 *   await signer.sendTransaction(tx)
 */

// Adapter (internal, but exported for advanced users)
export { wrapProvider, fromEthersReceipt, fromEthersLog } from './adapter'
export type { Ethers6Provider, Ethers6Receipt, Ethers6Log, Ethers6Block } from './adapter'

// ETH bridger
export {
  getDepositRequest,
  getWithdrawalRequest,
  getApproveGasTokenRequest,
} from './eth'
export type {
  GetDepositRequestParams,
  GetWithdrawalRequestParams,
  GetApproveGasTokenRequestParams,
} from './eth'

// ERC-20 bridger
export {
  getApproveTokenRequest,
  getErc20DepositRequest,
  getErc20WithdrawalRequest,
  getParentGatewayAddress,
  getChildGatewayAddress,
  getChildErc20Address,
  getParentErc20Address,
} from './erc20'
export type {
  GetApproveTokenRequestParams,
  GetErc20DepositRequestParams,
  GetErc20WithdrawalRequestParams,
} from './erc20'

// Message lifecycle
export {
  getParentToChildMessages,
  getChildToParentMessages,
  ParentToChildMessageReader,
  ChildToParentMessageReader,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
  getExecuteRequest,
  EthDepositMessage,
  getEthDeposits,
  getMessageEvents,
  getTokenDepositEvents,
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
  InboxMessageKind,
} from './message'
export type {
  ParentToChildMessageWaitForStatusResult,
  MessageEventPair,
  ChildToParentEventData,
  RetryableMessageParams,
} from './message'

// Network
export {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
  getArbitrumNetworkFromProvider,
} from './network'
export type {
  ArbitrumNetwork,
  EthBridge,
  TokenBridge,
  Teleporter,
} from './network'

// Admin
export {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from './admin'
export type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
} from './admin'

// Core types (re-export for convenience so users don't need @arbitrum/core)
export type {
  TransactionRequestData,
  ArbitrumLog,
  ArbitrumTransactionReceipt,
  ArbitrumBlock,
  FeeData,
  BlockTag,
  LogFilter,
  CallRequest,
} from '@arbitrum/core'

// Retryable data
export {
  RetryableDataTools,
} from '@arbitrum/core'
export type {
  RetryableData,
} from '@arbitrum/core'

// Gas estimation
export {
  estimateSubmissionFee,
  estimateRetryableTicketGasLimit,
  estimateMaxFeePerGas,
  estimateAll,
} from '@arbitrum/core'
export type {
  PercentIncrease,
  GasOverrides,
  RetryableTicketGasParams,
  GasEstimateResult,
} from '@arbitrum/core'

// Constants
export {
  NODE_INTERFACE_ADDRESS,
  ARB_SYS_ADDRESS,
  ARB_RETRYABLE_TX_ADDRESS,
  ARB_ADDRESS_TABLE_ADDRESS,
  ARB_OWNER_PUBLIC,
  ARB_GAS_INFO,
  ARB_STATISTICS,
  ADDRESS_ZERO,
} from '@arbitrum/core'

// Errors
export {
  ArbSdkError,
  MissingProviderArbSdkError,
} from '@arbitrum/core'
