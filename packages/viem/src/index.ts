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
  EthDepositMessage,
  getEthDeposits,
  getMessageEvents,
  getTokenDepositEvents,
} from './message'
export type {
  ParentToChildMessageReader,
  ChildToParentMessageReader,
  ChildToParentEventData,
  MessageEventPair,
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
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
  getNitroGenesisBlock,
  getMulticallAddress,
  mapL2NetworkTokenBridgeToTokenBridge,
  mapL2NetworkToArbitrumNetwork,
} from './network'
export type { ArbitrumNetwork, EthBridge, TokenBridge, Teleporter } from './network'

// Admin
export {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from './admin'
export type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
} from './admin'

// Inbox / force inclusion
export {
  getForceIncludableEvent,
  getForceIncludeRequest,
} from './inbox'

// Gas estimation
export {
  estimateSubmissionFee,
  estimateRetryableTicketGasLimit,
  estimateMaxFeePerGas,
  estimateAll,
  populateFunctionParams,
} from './gas'

// WETH detection
export { isWethGateway } from './weth'

// Network discovery from rollup
export { getArbitrumNetworkInformationFromRollup } from './fromRollup'

// Re-export core enums (runtime values) that users need
export {
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
  InboxMessageKind,
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
  CallRequest,
  RetryableMessageParams,
  ForceInclusionParams,
  GasOverrides,
  GasEstimateResult,
  PercentIncrease,
  RetryableTicketGasParams,
  PopulateFunctionGasParams,
  PopulateFunctionTxRequest,
  PopulateFunctionResult,
  ArbitrumNetworkInformationFromRollup,
  L2Network,
  L2NetworkTokenBridge,
  ParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
  ParentToChildMessageWaitForStatusResult,
  EventFetcherFilter,
  SubmitRetryableIdParams,
  DepositTxIdParams,
  ParsedEventLog,
  WriteOptions,
  ReadOptions,
  RetryableData,
  CallInput,
  TokenData,
  SendProps,
  OmitTyped,
  PartialPick,
  RequiredPick,
  Prettify,
  RlpInput,
} from '@arbitrum/core'

// Retryable data
export { RetryableDataTools } from '@arbitrum/core'

// Retryable ID computation
export { calculateSubmitRetryableId, calculateDepositTxId } from '@arbitrum/core'

// Message data parser
export { SubmitRetryableMessageDataParser } from '@arbitrum/core'

// Address alias utilities
export { applyAlias, undoAlias } from '@arbitrum/core'

// Calldata utilities
export { getErc20ParentAddressFromParentToChildTxRequest } from '@arbitrum/core'

// Event fetching and parsing
export { EventFetcher } from '@arbitrum/core'
export {
  getMessageDeliveredEvents,
  getInboxMessageDeliveredEvents,
  getChildToParentEvents,
  getRedeemScheduledEvents,
} from '@arbitrum/core'

// MultiCaller
export { MultiCaller } from '@arbitrum/core'

// Rollup utilities
export { isBold, getSendProps } from '@arbitrum/core'

// Utility functions
export {
  isDefined,
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
} from '@arbitrum/core'

// Transaction request helpers
export {
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
} from '@arbitrum/core'

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
} from '@arbitrum/core'
export { keccak256 } from '@arbitrum/core'
export { getAddress, isAddress } from '@arbitrum/core'
export { rlpEncode } from '@arbitrum/core'
export {
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopic,
  decodeEventLog,
  getFunctionSelector,
  getFunctionSignature,
} from '@arbitrum/core'

// Contract class
export { ArbitrumContract } from '@arbitrum/core'

// Errors
export { ArbSdkError, MissingProviderArbSdkError } from '@arbitrum/core'

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
} from '@arbitrum/core'

// ABIs
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
} from '@arbitrum/core'
