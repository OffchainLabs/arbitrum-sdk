/**
 * Tests for the barrel export (index.ts).
 *
 * Verifies that all expected functions and types are accessible
 * from the top-level '@arbitrum/ethers6' package import.
 */
import { describe, it, expect } from 'vitest'
import * as ethers6 from '../src/index'

describe('@arbitrum/ethers6 barrel export', () => {
  // --- Adapter ---
  it('exports adapter functions', () => {
    expect(typeof ethers6.wrapProvider).toBe('function')
    expect(typeof ethers6.fromEthersReceipt).toBe('function')
    expect(typeof ethers6.fromEthersLog).toBe('function')
  })

  // --- ETH bridging ---
  it('exports ETH bridger functions', () => {
    expect(typeof ethers6.getDepositRequest).toBe('function')
    expect(typeof ethers6.getWithdrawalRequest).toBe('function')
    expect(typeof ethers6.getApproveGasTokenRequest).toBe('function')
  })

  // --- ERC-20 bridging ---
  it('exports ERC-20 bridger functions', () => {
    expect(typeof ethers6.getApproveTokenRequest).toBe('function')
    expect(typeof ethers6.getErc20DepositRequest).toBe('function')
    expect(typeof ethers6.getErc20WithdrawalRequest).toBe('function')
    expect(typeof ethers6.getParentGatewayAddress).toBe('function')
    expect(typeof ethers6.getChildGatewayAddress).toBe('function')
    expect(typeof ethers6.getChildErc20Address).toBe('function')
    expect(typeof ethers6.getParentErc20Address).toBe('function')
  })

  // --- Message lifecycle ---
  it('exports message functions', () => {
    expect(typeof ethers6.getParentToChildMessages).toBe('function')
    expect(typeof ethers6.getChildToParentMessages).toBe('function')
    expect(typeof ethers6.getRedeemRequest).toBe('function')
    expect(typeof ethers6.getCancelRetryableRequest).toBe('function')
    expect(typeof ethers6.getKeepAliveRequest).toBe('function')
    expect(typeof ethers6.getExecuteRequest).toBe('function')
    expect(typeof ethers6.getEthDeposits).toBe('function')
    expect(typeof ethers6.getMessageEvents).toBe('function')
    expect(typeof ethers6.getTokenDepositEvents).toBe('function')
  })

  it('exports reader classes', () => {
    expect(typeof ethers6.ParentToChildMessageReader).toBe('function')
    expect(typeof ethers6.ChildToParentMessageReader).toBe('function')
    expect(typeof ethers6.EthDepositMessage).toBe('function')
  })

  // --- Network ---
  it('exports network functions', () => {
    expect(typeof ethers6.getArbitrumNetwork).toBe('function')
    expect(typeof ethers6.getArbitrumNetworks).toBe('function')
    expect(typeof ethers6.getChildrenForNetwork).toBe('function')
    expect(typeof ethers6.isParentNetwork).toBe('function')
    expect(typeof ethers6.registerCustomArbitrumNetwork).toBe('function')
    expect(typeof ethers6.resetNetworksToDefault).toBe('function')
    expect(typeof ethers6.assertArbitrumNetworkHasTokenBridge).toBe('function')
    expect(typeof ethers6.isArbitrumNetworkNativeTokenEther).toBe('function')
    expect(typeof ethers6.getArbitrumNetworkFromProvider).toBe('function')
  })

  it('exports network mapping helpers', () => {
    expect(typeof ethers6.getNitroGenesisBlock).toBe('function')
    expect(typeof ethers6.getMulticallAddress).toBe('function')
    expect(typeof ethers6.mapL2NetworkTokenBridgeToTokenBridge).toBe('function')
    expect(typeof ethers6.mapL2NetworkToArbitrumNetwork).toBe('function')
  })

  // --- Admin ---
  it('exports admin functions', () => {
    expect(typeof ethers6.getRegisterCustomTokenRequest).toBe('function')
    expect(typeof ethers6.getSetGatewaysRequest).toBe('function')
  })

  // --- Inbox / force inclusion ---
  it('exports inbox / force inclusion functions', () => {
    expect(typeof ethers6.getForceIncludableEvent).toBe('function')
    expect(typeof ethers6.getForceIncludeRequest).toBe('function')
  })

  // --- Gas estimation ---
  it('exports gas estimation functions', () => {
    expect(typeof ethers6.estimateSubmissionFee).toBe('function')
    expect(typeof ethers6.estimateRetryableTicketGasLimit).toBe('function')
    expect(typeof ethers6.estimateMaxFeePerGas).toBe('function')
    expect(typeof ethers6.estimateAll).toBe('function')
    expect(typeof ethers6.populateFunctionParams).toBe('function')
  })

  // --- WETH detection ---
  it('exports isWethGateway', () => {
    expect(typeof ethers6.isWethGateway).toBe('function')
  })

  // --- Network discovery from rollup ---
  it('exports getArbitrumNetworkInformationFromRollup', () => {
    expect(typeof ethers6.getArbitrumNetworkInformationFromRollup).toBe(
      'function'
    )
  })

  // --- Message status enums ---
  it('exports message status enums', () => {
    expect(ethers6.ParentToChildMessageStatus).toBeDefined()
    expect(ethers6.ChildToParentMessageStatus).toBeDefined()
    expect(ethers6.EthDepositMessageStatus).toBeDefined()
    expect(ethers6.InboxMessageKind).toBeDefined()
  })

  // --- Retryable data ---
  it('exports RetryableDataTools', () => {
    expect(ethers6.RetryableDataTools).toBeDefined()
  })

  it('exports SubmitRetryableMessageDataParser', () => {
    expect(typeof ethers6.SubmitRetryableMessageDataParser).toBe('function')
  })

  // --- Retryable ID computation ---
  it('exports retryable ID computation', () => {
    expect(typeof ethers6.calculateSubmitRetryableId).toBe('function')
    expect(typeof ethers6.calculateDepositTxId).toBe('function')
  })

  // --- Address alias ---
  it('exports address alias utilities', () => {
    expect(typeof ethers6.applyAlias).toBe('function')
    expect(typeof ethers6.undoAlias).toBe('function')
  })

  // --- Calldata utilities ---
  it('exports getErc20ParentAddressFromParentToChildTxRequest', () => {
    expect(
      typeof ethers6.getErc20ParentAddressFromParentToChildTxRequest
    ).toBe('function')
  })

  // --- Event fetching ---
  it('exports EventFetcher', () => {
    expect(typeof ethers6.EventFetcher).toBe('function')
  })

  it('exports event parsing functions', () => {
    expect(typeof ethers6.getMessageDeliveredEvents).toBe('function')
    expect(typeof ethers6.getInboxMessageDeliveredEvents).toBe('function')
    expect(typeof ethers6.getChildToParentEvents).toBe('function')
    expect(typeof ethers6.getRedeemScheduledEvents).toBe('function')
  })

  // --- MultiCaller ---
  it('exports MultiCaller', () => {
    expect(typeof ethers6.MultiCaller).toBe('function')
  })

  // --- Constants ---
  it('exports constants', () => {
    expect(typeof ethers6.NODE_INTERFACE_ADDRESS).toBe('string')
    expect(typeof ethers6.ARB_SYS_ADDRESS).toBe('string')
    expect(typeof ethers6.ARB_RETRYABLE_TX_ADDRESS).toBe('string')
    expect(typeof ethers6.ARB_ADDRESS_TABLE_ADDRESS).toBe('string')
    expect(typeof ethers6.ARB_OWNER_PUBLIC).toBe('string')
    expect(typeof ethers6.ARB_GAS_INFO).toBe('string')
    expect(typeof ethers6.ARB_STATISTICS).toBe('string')
    expect(typeof ethers6.ADDRESS_ZERO).toBe('string')
    expect(typeof ethers6.ARB_MINIMUM_BLOCK_TIME_IN_SECONDS).toBe('number')
    expect(typeof ethers6.DISABLED_GATEWAY).toBe('string')
    expect(typeof ethers6.CUSTOM_TOKEN_IS_ENABLED).toBe('number')
    expect(typeof ethers6.SEVEN_DAYS_IN_SECONDS).toBe('number')
    expect(typeof ethers6.DEFAULT_DEPOSIT_TIMEOUT).toBe('number')
    expect(typeof ethers6.ARB1_NITRO_GENESIS_L1_BLOCK).toBe('number')
    expect(typeof ethers6.ARB1_NITRO_GENESIS_L2_BLOCK).toBe('number')
    expect(typeof ethers6.ADDRESS_ALIAS_OFFSET).toBe('string')
  })

  // --- Errors ---
  it('exports error classes', () => {
    expect(typeof ethers6.ArbSdkError).toBe('function')
    expect(typeof ethers6.MissingProviderArbSdkError).toBe('function')
  })

  // --- Rollup utilities ---
  it('exports rollup utilities', () => {
    expect(typeof ethers6.isBold).toBe('function')
    expect(typeof ethers6.getSendProps).toBe('function')
  })

  // --- Utility functions ---
  it('exports utility functions', () => {
    expect(typeof ethers6.isDefined).toBe('function')
    expect(typeof ethers6.scaleFrom18DecimalsToNativeTokenDecimals).toBe(
      'function'
    )
    expect(typeof ethers6.scaleFromNativeTokenDecimalsTo18Decimals).toBe(
      'function'
    )
  })

  // --- Transaction request helpers ---
  it('exports transaction request helpers', () => {
    expect(typeof ethers6.isParentToChildTransactionRequest).toBe('function')
    expect(typeof ethers6.isChildToParentTransactionRequest).toBe('function')
  })

  // --- Encoding utilities ---
  it('exports encoding utilities', () => {
    expect(typeof ethers6.hexToBytes).toBe('function')
    expect(typeof ethers6.bytesToHex).toBe('function')
    expect(typeof ethers6.concat).toBe('function')
    expect(typeof ethers6.zeroPad).toBe('function')
    expect(typeof ethers6.padLeft).toBe('function')
    expect(typeof ethers6.stripZeros).toBe('function')
    expect(typeof ethers6.hexDataLength).toBe('function')
    expect(typeof ethers6.isHexString).toBe('function')
    expect(typeof ethers6.keccak256).toBe('function')
    expect(typeof ethers6.getAddress).toBe('function')
    expect(typeof ethers6.isAddress).toBe('function')
    expect(typeof ethers6.rlpEncode).toBe('function')
    expect(typeof ethers6.encodeFunctionData).toBe('function')
    expect(typeof ethers6.decodeFunctionResult).toBe('function')
    expect(typeof ethers6.encodeEventTopic).toBe('function')
    expect(typeof ethers6.decodeEventLog).toBe('function')
    expect(typeof ethers6.getFunctionSelector).toBe('function')
    expect(typeof ethers6.getFunctionSignature).toBe('function')
  })

  // --- ABIs ---
  it('exports all ABI arrays', () => {
    expect(ethers6.ArbAddressTableAbi).toBeDefined()
    expect(ethers6.ArbRetryableTxAbi).toBeDefined()
    expect(ethers6.ArbSysAbi).toBeDefined()
    expect(ethers6.BoldRollupUserLogicAbi).toBeDefined()
    expect(ethers6.BridgeAbi).toBeDefined()
    expect(ethers6.ERC20Abi).toBeDefined()
    expect(ethers6.ERC20InboxAbi).toBeDefined()
    expect(ethers6.IArbTokenAbi).toBeDefined()
    expect(ethers6.ICustomTokenAbi).toBeDefined()
    expect(ethers6.IERC20Abi).toBeDefined()
    expect(ethers6.IERC20BridgeAbi).toBeDefined()
    expect(ethers6.IInboxAbi).toBeDefined()
    expect(ethers6.IL1TeleporterAbi).toBeDefined()
    expect(ethers6.IL2ForwarderFactoryAbi).toBeDefined()
    expect(ethers6.IL2ForwarderPredictorAbi).toBeDefined()
    expect(ethers6.InboxAbi).toBeDefined()
    expect(ethers6.L1ERC20GatewayAbi).toBeDefined()
    expect(ethers6.L1GatewayRouterAbi).toBeDefined()
    expect(ethers6.L1WethGatewayAbi).toBeDefined()
    expect(ethers6.L2ArbitrumGatewayAbi).toBeDefined()
    expect(ethers6.L2ERC20GatewayAbi).toBeDefined()
    expect(ethers6.L2GatewayRouterAbi).toBeDefined()
    expect(ethers6.L2GatewayTokenAbi).toBeDefined()
    expect(ethers6.Multicall2Abi).toBeDefined()
    expect(ethers6.NodeInterfaceAbi).toBeDefined()
    expect(ethers6.OutboxAbi).toBeDefined()
    expect(ethers6.OutboxClassicAbi).toBeDefined()
    expect(ethers6.RollupAdminLogicAbi).toBeDefined()
    expect(ethers6.RollupUserLogicAbi).toBeDefined()
    expect(ethers6.SequencerInboxAbi).toBeDefined()
  })

  // --- ArbitrumContract ---
  it('exports ArbitrumContract', () => {
    expect(typeof ethers6.ArbitrumContract).toBe('function')
  })
})
