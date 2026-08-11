/**
 * Tests for the barrel export (index.ts).
 *
 * Verifies that all expected functions and types are accessible
 * from the top-level '@arbitrum/ethers5' package import.
 */
import { describe, it, expect } from 'vitest'
import * as ethers5 from '../src/index'

describe('@arbitrum/ethers5 barrel export', () => {
  // --- Adapter ---
  it('exports adapter functions', () => {
    expect(typeof ethers5.wrapProvider).toBe('function')
    expect(typeof ethers5.fromEthersReceipt).toBe('function')
    expect(typeof ethers5.fromEthersLog).toBe('function')
  })

  // --- ETH bridging ---
  it('exports ETH bridger functions', () => {
    expect(typeof ethers5.getDepositRequest).toBe('function')
    expect(typeof ethers5.getWithdrawalRequest).toBe('function')
    expect(typeof ethers5.getApproveGasTokenRequest).toBe('function')
  })

  // --- ERC-20 bridging ---
  it('exports ERC-20 bridger functions', () => {
    expect(typeof ethers5.getApproveTokenRequest).toBe('function')
    expect(typeof ethers5.getErc20DepositRequest).toBe('function')
    expect(typeof ethers5.getErc20WithdrawalRequest).toBe('function')
    expect(typeof ethers5.getParentGatewayAddress).toBe('function')
    expect(typeof ethers5.getChildGatewayAddress).toBe('function')
    expect(typeof ethers5.getChildErc20Address).toBe('function')
    expect(typeof ethers5.getParentErc20Address).toBe('function')
  })

  // --- Message lifecycle ---
  it('exports message functions', () => {
    expect(typeof ethers5.getParentToChildMessages).toBe('function')
    expect(typeof ethers5.getChildToParentMessages).toBe('function')
    expect(typeof ethers5.getRedeemRequest).toBe('function')
    expect(typeof ethers5.getCancelRetryableRequest).toBe('function')
    expect(typeof ethers5.getKeepAliveRequest).toBe('function')
    expect(typeof ethers5.getExecuteRequest).toBe('function')
    expect(typeof ethers5.getEthDeposits).toBe('function')
    expect(typeof ethers5.getMessageEvents).toBe('function')
    expect(typeof ethers5.getTokenDepositEvents).toBe('function')
  })

  it('exports reader classes', () => {
    expect(typeof ethers5.ParentToChildMessageReader).toBe('function')
    expect(typeof ethers5.ChildToParentMessageReader).toBe('function')
    expect(typeof ethers5.EthDepositMessage).toBe('function')
  })

  // --- Network ---
  it('exports network functions', () => {
    expect(typeof ethers5.getArbitrumNetwork).toBe('function')
    expect(typeof ethers5.getArbitrumNetworks).toBe('function')
    expect(typeof ethers5.getChildrenForNetwork).toBe('function')
    expect(typeof ethers5.isParentNetwork).toBe('function')
    expect(typeof ethers5.registerCustomArbitrumNetwork).toBe('function')
    expect(typeof ethers5.resetNetworksToDefault).toBe('function')
    expect(typeof ethers5.assertArbitrumNetworkHasTokenBridge).toBe('function')
    expect(typeof ethers5.isArbitrumNetworkNativeTokenEther).toBe('function')
    expect(typeof ethers5.getArbitrumNetworkFromProvider).toBe('function')
  })

  it('exports network mapping helpers', () => {
    expect(typeof ethers5.getNitroGenesisBlock).toBe('function')
    expect(typeof ethers5.getMulticallAddress).toBe('function')
    expect(typeof ethers5.mapL2NetworkTokenBridgeToTokenBridge).toBe('function')
    expect(typeof ethers5.mapL2NetworkToArbitrumNetwork).toBe('function')
  })

  // --- Admin ---
  it('exports admin functions', () => {
    expect(typeof ethers5.getRegisterCustomTokenRequest).toBe('function')
    expect(typeof ethers5.getSetGatewaysRequest).toBe('function')
  })

  // --- Inbox / force inclusion ---
  it('exports inbox / force inclusion functions', () => {
    expect(typeof ethers5.getForceIncludableEvent).toBe('function')
    expect(typeof ethers5.getForceIncludeRequest).toBe('function')
  })

  // --- Gas estimation ---
  it('exports gas estimation functions', () => {
    expect(typeof ethers5.estimateSubmissionFee).toBe('function')
    expect(typeof ethers5.estimateRetryableTicketGasLimit).toBe('function')
    expect(typeof ethers5.estimateMaxFeePerGas).toBe('function')
    expect(typeof ethers5.estimateAll).toBe('function')
    expect(typeof ethers5.populateFunctionParams).toBe('function')
  })

  // --- WETH detection ---
  it('exports isWethGateway', () => {
    expect(typeof ethers5.isWethGateway).toBe('function')
  })

  // --- Network discovery from rollup ---
  it('exports getArbitrumNetworkInformationFromRollup', () => {
    expect(typeof ethers5.getArbitrumNetworkInformationFromRollup).toBe(
      'function'
    )
  })

  // --- Message status enums ---
  it('exports message status enums', () => {
    expect(ethers5.ParentToChildMessageStatus).toBeDefined()
    expect(ethers5.ChildToParentMessageStatus).toBeDefined()
    expect(ethers5.EthDepositMessageStatus).toBeDefined()
    expect(ethers5.InboxMessageKind).toBeDefined()
  })

  // --- Retryable data ---
  it('exports RetryableDataTools', () => {
    expect(ethers5.RetryableDataTools).toBeDefined()
  })

  it('exports SubmitRetryableMessageDataParser', () => {
    expect(typeof ethers5.SubmitRetryableMessageDataParser).toBe('function')
  })

  // --- Retryable ID computation ---
  it('exports retryable ID computation', () => {
    expect(typeof ethers5.calculateSubmitRetryableId).toBe('function')
    expect(typeof ethers5.calculateDepositTxId).toBe('function')
  })

  // --- Address alias ---
  it('exports address alias utilities', () => {
    expect(typeof ethers5.applyAlias).toBe('function')
    expect(typeof ethers5.undoAlias).toBe('function')
  })

  // --- Calldata utilities ---
  it('exports getErc20ParentAddressFromParentToChildTxRequest', () => {
    expect(
      typeof ethers5.getErc20ParentAddressFromParentToChildTxRequest
    ).toBe('function')
  })

  // --- Event fetching ---
  it('exports EventFetcher', () => {
    expect(typeof ethers5.EventFetcher).toBe('function')
  })

  it('exports event parsing functions', () => {
    expect(typeof ethers5.getMessageDeliveredEvents).toBe('function')
    expect(typeof ethers5.getInboxMessageDeliveredEvents).toBe('function')
    expect(typeof ethers5.getChildToParentEvents).toBe('function')
    expect(typeof ethers5.getRedeemScheduledEvents).toBe('function')
  })

  // --- MultiCaller ---
  it('exports MultiCaller', () => {
    expect(typeof ethers5.MultiCaller).toBe('function')
  })

  // --- Constants ---
  it('exports constants', () => {
    expect(typeof ethers5.NODE_INTERFACE_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_SYS_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_RETRYABLE_TX_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_ADDRESS_TABLE_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_OWNER_PUBLIC).toBe('string')
    expect(typeof ethers5.ARB_GAS_INFO).toBe('string')
    expect(typeof ethers5.ARB_STATISTICS).toBe('string')
    expect(typeof ethers5.ADDRESS_ZERO).toBe('string')
    expect(typeof ethers5.ARB_MINIMUM_BLOCK_TIME_IN_SECONDS).toBe('number')
    expect(typeof ethers5.DISABLED_GATEWAY).toBe('string')
    expect(typeof ethers5.CUSTOM_TOKEN_IS_ENABLED).toBe('number')
    expect(typeof ethers5.SEVEN_DAYS_IN_SECONDS).toBe('number')
    expect(typeof ethers5.DEFAULT_DEPOSIT_TIMEOUT).toBe('number')
    expect(typeof ethers5.ARB1_NITRO_GENESIS_L1_BLOCK).toBe('number')
    expect(typeof ethers5.ARB1_NITRO_GENESIS_L2_BLOCK).toBe('number')
    expect(typeof ethers5.ADDRESS_ALIAS_OFFSET).toBe('string')
  })

  // --- Errors ---
  it('exports error classes', () => {
    expect(typeof ethers5.ArbSdkError).toBe('function')
    expect(typeof ethers5.MissingProviderArbSdkError).toBe('function')
  })

  // --- Rollup utilities ---
  it('exports rollup utilities', () => {
    expect(typeof ethers5.isBold).toBe('function')
    expect(typeof ethers5.getSendProps).toBe('function')
  })

  // --- Utility functions ---
  it('exports utility functions', () => {
    expect(typeof ethers5.isDefined).toBe('function')
    expect(typeof ethers5.scaleFrom18DecimalsToNativeTokenDecimals).toBe(
      'function'
    )
    expect(typeof ethers5.scaleFromNativeTokenDecimalsTo18Decimals).toBe(
      'function'
    )
  })

  // --- Transaction request helpers ---
  it('exports transaction request helpers', () => {
    expect(typeof ethers5.isParentToChildTransactionRequest).toBe('function')
    expect(typeof ethers5.isChildToParentTransactionRequest).toBe('function')
  })

  // --- Encoding utilities ---
  it('exports encoding utilities', () => {
    expect(typeof ethers5.hexToBytes).toBe('function')
    expect(typeof ethers5.bytesToHex).toBe('function')
    expect(typeof ethers5.concat).toBe('function')
    expect(typeof ethers5.zeroPad).toBe('function')
    expect(typeof ethers5.padLeft).toBe('function')
    expect(typeof ethers5.stripZeros).toBe('function')
    expect(typeof ethers5.hexDataLength).toBe('function')
    expect(typeof ethers5.isHexString).toBe('function')
    expect(typeof ethers5.keccak256).toBe('function')
    expect(typeof ethers5.getAddress).toBe('function')
    expect(typeof ethers5.isAddress).toBe('function')
    expect(typeof ethers5.rlpEncode).toBe('function')
    expect(typeof ethers5.encodeFunctionData).toBe('function')
    expect(typeof ethers5.decodeFunctionResult).toBe('function')
    expect(typeof ethers5.encodeEventTopic).toBe('function')
    expect(typeof ethers5.decodeEventLog).toBe('function')
    expect(typeof ethers5.getFunctionSelector).toBe('function')
    expect(typeof ethers5.getFunctionSignature).toBe('function')
  })

  // --- ABIs ---
  it('exports all ABI arrays', () => {
    expect(ethers5.ArbAddressTableAbi).toBeDefined()
    expect(ethers5.ArbRetryableTxAbi).toBeDefined()
    expect(ethers5.ArbSysAbi).toBeDefined()
    expect(ethers5.BoldRollupUserLogicAbi).toBeDefined()
    expect(ethers5.BridgeAbi).toBeDefined()
    expect(ethers5.ERC20Abi).toBeDefined()
    expect(ethers5.ERC20InboxAbi).toBeDefined()
    expect(ethers5.IArbTokenAbi).toBeDefined()
    expect(ethers5.ICustomTokenAbi).toBeDefined()
    expect(ethers5.IERC20Abi).toBeDefined()
    expect(ethers5.IERC20BridgeAbi).toBeDefined()
    expect(ethers5.IInboxAbi).toBeDefined()
    expect(ethers5.IL1TeleporterAbi).toBeDefined()
    expect(ethers5.IL2ForwarderFactoryAbi).toBeDefined()
    expect(ethers5.IL2ForwarderPredictorAbi).toBeDefined()
    expect(ethers5.InboxAbi).toBeDefined()
    expect(ethers5.L1ERC20GatewayAbi).toBeDefined()
    expect(ethers5.L1GatewayRouterAbi).toBeDefined()
    expect(ethers5.L1WethGatewayAbi).toBeDefined()
    expect(ethers5.L2ArbitrumGatewayAbi).toBeDefined()
    expect(ethers5.L2ERC20GatewayAbi).toBeDefined()
    expect(ethers5.L2GatewayRouterAbi).toBeDefined()
    expect(ethers5.L2GatewayTokenAbi).toBeDefined()
    expect(ethers5.Multicall2Abi).toBeDefined()
    expect(ethers5.NodeInterfaceAbi).toBeDefined()
    expect(ethers5.OutboxAbi).toBeDefined()
    expect(ethers5.OutboxClassicAbi).toBeDefined()
    expect(ethers5.RollupAdminLogicAbi).toBeDefined()
    expect(ethers5.RollupUserLogicAbi).toBeDefined()
    expect(ethers5.SequencerInboxAbi).toBeDefined()
  })

  // --- ArbitrumContract ---
  it('exports ArbitrumContract', () => {
    expect(typeof ethers5.ArbitrumContract).toBe('function')
  })
})
