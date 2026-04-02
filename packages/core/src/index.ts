/**
 * @arbitrum/core — Provider-agnostic core library for Arbitrum SDK.
 *
 * This package has zero ethers/viem dependencies.
 * All amounts use bigint. All addresses/hashes use string.
 */

// Encoding utilities
export {
  hexToBytes,
  bytesToHex,
  concat,
  zeroPad,
  padLeft,
  stripZeros,
  hexDataLength,
  isHexString,
} from './encoding/hex'

export { keccak256 } from './encoding/keccak'

export { getAddress, isAddress } from './encoding/address'

export { rlpEncode } from './encoding/rlp'
export type { RlpInput } from './encoding/rlp'

export {
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopic,
  decodeEventLog,
  getFunctionSelector,
  getFunctionSignature,
} from './encoding/abi'

// Types and interfaces
export type {
  TransactionRequestData,
  BlockTag,
  LogFilter,
  ArbitrumLog,
  ArbitrumTransactionReceipt,
  ArbitrumBlock,
  FeeData,
  CallRequest,
} from './interfaces/types'

export type { ArbitrumProvider } from './interfaces/provider'

// Contract class
export { ArbitrumContract } from './contracts/Contract'
export type { ParsedEventLog, WriteOptions, ReadOptions } from './contracts/Contract'

// Errors
export { ArbSdkError, MissingProviderArbSdkError } from './errors'

// Constants
export {
  NODE_INTERFACE_ADDRESS,
  ARB_SYS_ADDRESS,
  ARB_RETRYABLE_TX_ADDRESS,
  ARB_ADDRESS_TABLE_ADDRESS,
  ARB_OWNER_PUBLIC,
  ARB_GAS_INFO,
  ARB_STATISTICS,
  ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  ADDRESS_ALIAS_OFFSET,
  DISABLED_GATEWAY,
  CUSTOM_TOKEN_IS_ENABLED,
  SEVEN_DAYS_IN_SECONDS,
  DEFAULT_DEPOSIT_TIMEOUT,
  ARB1_NITRO_GENESIS_L1_BLOCK,
  ARB1_NITRO_GENESIS_L2_BLOCK,
  ADDRESS_ZERO,
} from './constants'

// Networks
export {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
  getNitroGenesisBlock,
  getMulticallAddress,
  mapL2NetworkTokenBridgeToTokenBridge,
  mapL2NetworkToArbitrumNetwork,
} from './networks'
export type {
  ArbitrumNetwork,
  EthBridge,
  TokenBridge,
  Teleporter,
  L2Network,
  L2NetworkTokenBridge,
  ArbitrumNetworkInformationFromRollup,
} from './networks'

// Message types and enums
export {
  InboxMessageKind,
  ChildToParentMessageStatus,
  ParentToChildMessageStatus,
  EthDepositMessageStatus,
} from './message/types'
export type { RetryableMessageParams } from './message/types'

// Retryable data parsing
export { RetryableDataTools } from './retryableData'
export type { RetryableData } from './retryableData'

// Utility functions
export {
  isDefined,
  wait,
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
} from './utils/lib'

// Address alias utilities
export { applyAlias, undoAlias } from './utils/addressAlias'

// Calldata decode utility
export { getErc20ParentAddressFromParentToChildTxRequest } from './utils/calldata'

// Utility types
export type {
  OmitTyped,
  PartialPick,
  RequiredPick,
  Prettify,
} from './utils/types'

// Transaction request types
export type {
  ParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
} from './interfaces/transactionRequest'
export {
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
} from './interfaces/transactionRequest'

// Event fetching and parsing
export { EventFetcher } from './utils/eventFetcher'
export type { EventFetcherFilter } from './utils/eventFetcher'
export {
  getMessageDeliveredEvents,
  getInboxMessageDeliveredEvents,
  getChildToParentEvents,
  getRedeemScheduledEvents,
} from './events/parsing'

// Message data parser
export { SubmitRetryableMessageDataParser } from './message/messageDataParser'

// Retryable ticket ID computation
export {
  calculateSubmitRetryableId,
  calculateDepositTxId,
} from './message/retryableId'
export type {
  SubmitRetryableIdParams,
  DepositTxIdParams,
} from './message/retryableId'

// Parent transaction receipt event parsing
export {
  getMessageEvents,
  getTokenDepositEvents,
} from './message/parentTransaction'
export type { MessageEventPair } from './message/parentTransaction'

// Parent-to-child message lifecycle
export {
  ParentToChildMessageReader,
  getParentToChildMessages,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
} from './message/parentToChildMessage'
export type { ParentToChildMessageWaitForStatusResult } from './message/parentToChildMessage'

// ETH deposit message
export {
  EthDepositMessage,
  getEthDeposits,
} from './message/ethDepositMessage'

// Child-to-parent message lifecycle
export {
  ChildToParentMessageReader,
  getChildToParentMessages,
  getExecuteRequest,
} from './message/childToParentMessage'
export type { ChildToParentEventData } from './message/childToParentMessage'

// Rollup utilities (BOLD detection, assertion queries)
export { isBold, getSendProps } from './message/rollupUtils'
export type { SendProps } from './message/rollupUtils'

// Child transaction receipt event parsing
// (getChildToParentEvents and getRedeemScheduledEvents are already
// exported above from './events/parsing')

// ETH bridger functions
export { getDepositRequest, getApproveGasTokenRequest } from './eth/deposit'
export type {
  GetDepositRequestParams,
  GetApproveGasTokenRequestParams,
} from './eth/deposit'

export { getWithdrawalRequest } from './eth/withdraw'
export type { GetWithdrawalRequestParams } from './eth/withdraw'

// ERC-20 bridger functions
export {
  getApproveTokenRequest,
  getErc20DepositRequest,
} from './erc20/deposit'
export type {
  GetApproveTokenRequestParams,
  GetErc20DepositRequestParams,
} from './erc20/deposit'

export { getErc20WithdrawalRequest } from './erc20/withdraw'
export type { GetErc20WithdrawalRequestParams } from './erc20/withdraw'

// ERC-20 gateway resolution
export {
  getParentGatewayAddress,
  getChildGatewayAddress,
  getChildErc20Address,
  getParentErc20Address,
} from './erc20/gateway'

// WETH detection
export { isWethGateway } from './erc20/wethDetection'

// Network discovery from rollup contract
export { getArbitrumNetworkInformationFromRollup } from './networks/fromRollup'

// Admin functions
export {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from './admin/registerToken'
export type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
} from './admin/registerToken'

// Multicall
export { MultiCaller } from './utils/multicall'
export type { CallInput, TokenData } from './utils/multicall'

// Inbox / force inclusion
export {
  getForceIncludableEvent,
  getForceIncludeRequest,
} from './inbox/inbox'
export type { ForceInclusionParams } from './inbox/inbox'

// Gas estimation
export {
  estimateSubmissionFee,
  estimateRetryableTicketGasLimit,
  estimateMaxFeePerGas,
  estimateAll,
  populateFunctionParams,
} from './message/gasEstimator'
export type {
  PercentIncrease,
  GasOverrides,
  RetryableTicketGasParams,
  GasEstimateResult,
  PopulateFunctionGasParams,
  PopulateFunctionTxRequest,
  PopulateFunctionResult,
} from './message/gasEstimator'

// ABIs — raw `as const` arrays for all contracts used by the SDK
export {
  ArbAddressTableAbi,
  ArbRetryableTxAbi,
  ArbSysAbi,
  BoldRollupUserLogicAbi,
  BridgeAbi,
  ERC20Abi,
  ERC20InboxAbi,
  IArbTokenAbi,
  ICustomTokenAbi,
  IERC20Abi,
  IERC20BridgeAbi,
  IInboxAbi,
  IL1TeleporterAbi,
  IL2ForwarderFactoryAbi,
  IL2ForwarderPredictorAbi,
  InboxAbi,
  L1ERC20GatewayAbi,
  L1GatewayRouterAbi,
  L1WethGatewayAbi,
  L2ArbitrumGatewayAbi,
  L2ERC20GatewayAbi,
  L2GatewayRouterAbi,
  L2GatewayTokenAbi,
  Multicall2Abi,
  NodeInterfaceAbi,
  OutboxAbi,
  OutboxClassicAbi,
  RollupAdminLogicAbi,
  RollupUserLogicAbi,
  SequencerInboxAbi,
} from './abi'

// L1→L3 teleportation functions
export {
  getEthL1L3DepositRequest,
  getErc20L1L3DepositRequest,
  getErc20L1L3ApproveTokenRequest,
  getErc20L1L3ApproveGasTokenRequest,
  predictL2ForwarderAddress,
} from './l1l3'
export type {
  GetEthL1L3DepositRequestParams,
  GetErc20L1L3DepositRequestParams,
  Erc20L1L3DepositRequestResult,
  GetErc20L1L3ApproveTokenRequestParams,
  GetErc20L1L3ApproveGasTokenRequestParams,
  TeleporterRetryableGasParams,
  PredictL2ForwarderAddressParams,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
} from './l1l3'
