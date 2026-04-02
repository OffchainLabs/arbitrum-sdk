/**
 * @arbitrum/viem — Viem adapter for Arbitrum SDK.
 *
 * Users install this package and pass viem PublicClient / TransactionReceipt
 * directly. ArbitrumProvider is internal to the adapter — never exposed.
 */

// Adapter utilities (conversion functions only — wrapPublicClient is internal)
export { fromViemReceipt, fromViemLog } from './adapter'

// ETH bridging
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

// ERC-20 bridging
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
  ViemGetApproveTokenRequestParams,
  ViemGetErc20DepositRequestParams,
  GetErc20WithdrawalRequestParams,
} from './erc20'

// Message lifecycle
export {
  getParentToChildMessages,
  getChildToParentMessages,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
  getExecuteRequest,
} from './message'
export type {
  ParentToChildMessageReader,
  ChildToParentMessageReader,
  ChildToParentEventData,
} from './message'

// Network
export {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  getArbitrumNetworkFromProvider,
} from './network'
export type { ArbitrumNetwork } from './network'

// Admin
export {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from './admin'
export type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
} from './admin'

// Re-export core enums (runtime values) that users need
export {
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
} from '@arbitrum/core'

// Re-export core types that users need for return values and params
export type {
  TransactionRequestData,
  ArbitrumTransactionReceipt,
  ArbitrumLog,
  ArbitrumBlock,
  FeeData,
  BlockTag,
  LogFilter,
  EthBridge,
  TokenBridge,
  Teleporter,
  GasOverrides,
  GasEstimateResult,
  PercentIncrease,
} from '@arbitrum/core'
