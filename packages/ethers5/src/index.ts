/**
 * @arbitrum/ethers5 — Ethers v5 adapter for the Arbitrum SDK.
 *
 * Users install this package and pass ethers v5 Provider / TransactionReceipt
 * directly. All BigNumber-to-bigint conversion happens automatically.
 *
 * Usage:
 *   import { getDepositRequest, getArbitrumNetwork } from '@arbitrum/ethers5'
 *   const network = getArbitrumNetwork(42161)
 *   const tx = getDepositRequest({ network, amount: 1000n, from: '0x...' })
 *   await signer.sendTransaction(tx)
 */

// Adapter (internal, but exported for advanced users)
export { wrapProvider, fromEthersReceipt, fromEthersLog } from './adapter'
export type { Ethers5Provider, Ethers5Receipt, Ethers5Log, Ethers5Block } from './adapter'

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
  getNitroGenesisBlock,
  getMulticallAddress,
  mapL2NetworkTokenBridgeToTokenBridge,
  mapL2NetworkToArbitrumNetwork,
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

// Inbox / force inclusion
export {
  getForceIncludableEvent,
  getForceIncludeRequest,
} from './inbox'

// Gas estimation (wrapped with ethers v5 provider)
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
export {
  ArbSdkError,
  MissingProviderArbSdkError,
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
