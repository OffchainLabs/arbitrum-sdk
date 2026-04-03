/**
 * @arbitrum/sdk — backwards-compatible package.
 *
 * Presents the same class-based, ethers v5 API as previous versions.
 * Internally delegates to @arbitrum/core (provider-agnostic).
 */

// Compat layer: classes, types, conversion utilities
export * from './compat'

// Network types and functions (from original lib — unchanged API)
export {
  ArbitrumNetwork,
  getArbitrumNetwork,
  getArbitrumNetworks,
  ArbitrumNetworkInformationFromRollup,
  getArbitrumNetworkInformationFromRollup,
  getChildrenForNetwork,
  registerCustomArbitrumNetwork,
  L2Network,
  L2NetworkTokenBridge,
  mapL2NetworkToArbitrumNetwork,
  mapL2NetworkTokenBridgeToTokenBridge,
} from './lib/dataEntities/networks'

// Constants (namespace export)
export * as constants from './lib/dataEntities/constants'

// Retryable data
export {
  RetryableData,
  RetryableDataTools,
} from './lib/dataEntities/retryableData'

// Transaction request types
export {
  ParentToChildTransactionRequest,
  isParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
  isChildToParentTransactionRequest,
} from './lib/dataEntities/transactionRequest'

// Scaling functions
export {
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
} from './lib/utils/lib'

// Event types
export { EventArgs } from './lib/dataEntities/event'

// Byte serialization
export { argSerializerConstructor } from './lib/utils/byte_serialize_params'

// L1-L3 types
export type {
  EthL1L3DepositStatus,
  EthL1L3DepositRequestParams,
  Erc20L1L3DepositStatus,
  Erc20L1L3DepositRequestParams,
  Erc20L1L3DepositRequestRetryableOverrides,
  GetL1L3DepositStatusParams,
} from './lib/assetBridger/l1l3Bridger'

// Message enums (also in compat/types.ts but re-export from original for type compat)
export {
  ChildToParentMessageStatus,
  RetryableMessageParams,
} from './lib/dataEntities/message'

// CallInput type for MultiCaller
export type { CallInput } from './lib/utils/multicall'
