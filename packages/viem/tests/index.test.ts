/**
 * Tests for the barrel export — verifies the public API surface.
 *
 * Key invariant: ArbitrumProvider is NOT exported from @arbitrum/viem.
 * Users only interact with viem types.
 */
import { describe, it, expect } from 'vitest'
import * as viemPkg from '../src/index'

describe('@arbitrum/viem public API', () => {
  // --- Adapter utilities ---
  it('exports fromViemReceipt adapter', () => {
    expect(typeof viemPkg.fromViemReceipt).toBe('function')
  })

  it('exports fromViemLog adapter', () => {
    expect(typeof viemPkg.fromViemLog).toBe('function')
  })

  // --- ETH bridging ---
  it('exports ETH bridging functions', () => {
    expect(typeof viemPkg.getDepositRequest).toBe('function')
    expect(typeof viemPkg.getWithdrawalRequest).toBe('function')
    expect(typeof viemPkg.getApproveGasTokenRequest).toBe('function')
  })

  // --- ERC-20 bridging ---
  it('exports ERC-20 bridging functions', () => {
    expect(typeof viemPkg.getApproveTokenRequest).toBe('function')
    expect(typeof viemPkg.getErc20DepositRequest).toBe('function')
    expect(typeof viemPkg.getErc20WithdrawalRequest).toBe('function')
  })

  it('exports ERC-20 gateway resolution functions', () => {
    expect(typeof viemPkg.getParentGatewayAddress).toBe('function')
    expect(typeof viemPkg.getChildGatewayAddress).toBe('function')
    expect(typeof viemPkg.getChildErc20Address).toBe('function')
    expect(typeof viemPkg.getParentErc20Address).toBe('function')
  })

  // --- Message lifecycle ---
  it('exports message lifecycle functions', () => {
    expect(typeof viemPkg.getParentToChildMessages).toBe('function')
    expect(typeof viemPkg.getChildToParentMessages).toBe('function')
    expect(typeof viemPkg.getRedeemRequest).toBe('function')
    expect(typeof viemPkg.getCancelRetryableRequest).toBe('function')
    expect(typeof viemPkg.getKeepAliveRequest).toBe('function')
    expect(typeof viemPkg.getExecuteRequest).toBe('function')
  })

  it('exports ETH deposit functions', () => {
    expect(typeof viemPkg.EthDepositMessage).toBe('function')
    expect(typeof viemPkg.getEthDeposits).toBe('function')
  })

  it('exports parent transaction receipt parsing', () => {
    expect(typeof viemPkg.getMessageEvents).toBe('function')
    expect(typeof viemPkg.getTokenDepositEvents).toBe('function')
  })

  // --- Network ---
  it('exports network functions', () => {
    expect(typeof viemPkg.getArbitrumNetwork).toBe('function')
    expect(typeof viemPkg.getArbitrumNetworks).toBe('function')
    expect(typeof viemPkg.getChildrenForNetwork).toBe('function')
    expect(typeof viemPkg.isParentNetwork).toBe('function')
    expect(typeof viemPkg.registerCustomArbitrumNetwork).toBe('function')
    expect(typeof viemPkg.resetNetworksToDefault).toBe('function')
    expect(typeof viemPkg.getArbitrumNetworkFromProvider).toBe('function')
  })

  it('exports network assertion helpers', () => {
    expect(typeof viemPkg.assertArbitrumNetworkHasTokenBridge).toBe('function')
    expect(typeof viemPkg.isArbitrumNetworkNativeTokenEther).toBe('function')
  })

  // --- Admin ---
  it('exports admin functions', () => {
    expect(typeof viemPkg.getRegisterCustomTokenRequest).toBe('function')
    expect(typeof viemPkg.getSetGatewaysRequest).toBe('function')
  })

  // --- Inbox / force inclusion ---
  it('exports inbox / force inclusion functions', () => {
    expect(typeof viemPkg.getForceIncludableEvent).toBe('function')
    expect(typeof viemPkg.getForceIncludeRequest).toBe('function')
  })

  // --- Gas estimation ---
  it('exports gas estimation functions', () => {
    expect(typeof viemPkg.estimateSubmissionFee).toBe('function')
    expect(typeof viemPkg.estimateRetryableTicketGasLimit).toBe('function')
    expect(typeof viemPkg.estimateMaxFeePerGas).toBe('function')
    expect(typeof viemPkg.estimateAll).toBe('function')
    expect(typeof viemPkg.populateFunctionParams).toBe('function')
  })

  // --- WETH detection ---
  it('exports isWethGateway', () => {
    expect(typeof viemPkg.isWethGateway).toBe('function')
  })

  // --- Network discovery from rollup ---
  it('exports getArbitrumNetworkInformationFromRollup', () => {
    expect(typeof viemPkg.getArbitrumNetworkInformationFromRollup).toBe(
      'function'
    )
  })

  // --- Message status enums ---
  it('exports message status enums', () => {
    expect(viemPkg.ParentToChildMessageStatus).toBeDefined()
    expect(viemPkg.ChildToParentMessageStatus).toBeDefined()
    expect(viemPkg.EthDepositMessageStatus).toBeDefined()
    expect(viemPkg.InboxMessageKind).toBeDefined()
  })

  // --- Retryable data ---
  it('exports RetryableDataTools', () => {
    expect(viemPkg.RetryableDataTools).toBeDefined()
  })

  it('exports SubmitRetryableMessageDataParser', () => {
    expect(typeof viemPkg.SubmitRetryableMessageDataParser).toBe('function')
  })

  // --- Retryable ID computation ---
  it('exports retryable ID computation', () => {
    expect(typeof viemPkg.calculateSubmitRetryableId).toBe('function')
    expect(typeof viemPkg.calculateDepositTxId).toBe('function')
  })

  // --- Address alias utilities ---
  it('exports address alias utilities', () => {
    expect(typeof viemPkg.applyAlias).toBe('function')
    expect(typeof viemPkg.undoAlias).toBe('function')
  })

  // --- Calldata utilities ---
  it('exports getErc20ParentAddressFromParentToChildTxRequest', () => {
    expect(
      typeof viemPkg.getErc20ParentAddressFromParentToChildTxRequest
    ).toBe('function')
  })

  // --- Event fetching ---
  it('exports EventFetcher', () => {
    expect(typeof viemPkg.EventFetcher).toBe('function')
  })

  it('exports event parsing functions', () => {
    expect(typeof viemPkg.getMessageDeliveredEvents).toBe('function')
    expect(typeof viemPkg.getInboxMessageDeliveredEvents).toBe('function')
    expect(typeof viemPkg.getChildToParentEvents).toBe('function')
    expect(typeof viemPkg.getRedeemScheduledEvents).toBe('function')
  })

  // --- MultiCaller ---
  it('exports MultiCaller', () => {
    expect(typeof viemPkg.MultiCaller).toBe('function')
  })

  // --- Constants ---
  it('exports constants', () => {
    expect(typeof viemPkg.NODE_INTERFACE_ADDRESS).toBe('string')
    expect(typeof viemPkg.ARB_SYS_ADDRESS).toBe('string')
    expect(typeof viemPkg.ARB_RETRYABLE_TX_ADDRESS).toBe('string')
    expect(typeof viemPkg.ARB_ADDRESS_TABLE_ADDRESS).toBe('string')
    expect(typeof viemPkg.ARB_OWNER_PUBLIC).toBe('string')
    expect(typeof viemPkg.ARB_GAS_INFO).toBe('string')
    expect(typeof viemPkg.ARB_STATISTICS).toBe('string')
    expect(typeof viemPkg.ADDRESS_ZERO).toBe('string')
    expect(typeof viemPkg.ARB_MINIMUM_BLOCK_TIME_IN_SECONDS).toBe('number')
    expect(typeof viemPkg.DISABLED_GATEWAY).toBe('string')
    expect(typeof viemPkg.CUSTOM_TOKEN_IS_ENABLED).toBe('number')
    expect(typeof viemPkg.SEVEN_DAYS_IN_SECONDS).toBe('number')
    expect(typeof viemPkg.DEFAULT_DEPOSIT_TIMEOUT).toBe('number')
    expect(typeof viemPkg.ARB1_NITRO_GENESIS_L1_BLOCK).toBe('number')
    expect(typeof viemPkg.ARB1_NITRO_GENESIS_L2_BLOCK).toBe('number')
    expect(typeof viemPkg.ADDRESS_ALIAS_OFFSET).toBe('string')
  })

  // --- Errors ---
  it('exports error classes', () => {
    expect(typeof viemPkg.ArbSdkError).toBe('function')
    expect(typeof viemPkg.MissingProviderArbSdkError).toBe('function')
  })

  // --- Rollup utilities ---
  it('exports rollup utilities', () => {
    expect(typeof viemPkg.isBold).toBe('function')
    expect(typeof viemPkg.getSendProps).toBe('function')
  })

  // --- Utility functions ---
  it('exports utility functions', () => {
    expect(typeof viemPkg.isDefined).toBe('function')
    expect(typeof viemPkg.scaleFrom18DecimalsToNativeTokenDecimals).toBe(
      'function'
    )
    expect(typeof viemPkg.scaleFromNativeTokenDecimalsTo18Decimals).toBe(
      'function'
    )
  })

  // --- Transaction request helpers ---
  it('exports transaction request helpers', () => {
    expect(typeof viemPkg.isParentToChildTransactionRequest).toBe('function')
    expect(typeof viemPkg.isChildToParentTransactionRequest).toBe('function')
  })

  // --- Network mapping helpers ---
  it('exports network mapping helpers', () => {
    expect(typeof viemPkg.getNitroGenesisBlock).toBe('function')
    expect(typeof viemPkg.getMulticallAddress).toBe('function')
    expect(typeof viemPkg.mapL2NetworkTokenBridgeToTokenBridge).toBe('function')
    expect(typeof viemPkg.mapL2NetworkToArbitrumNetwork).toBe('function')
  })

  // --- Encoding utilities ---
  it('exports encoding utilities', () => {
    expect(typeof viemPkg.hexToBytes).toBe('function')
    expect(typeof viemPkg.bytesToHex).toBe('function')
    expect(typeof viemPkg.concat).toBe('function')
    expect(typeof viemPkg.zeroPad).toBe('function')
    expect(typeof viemPkg.padLeft).toBe('function')
    expect(typeof viemPkg.stripZeros).toBe('function')
    expect(typeof viemPkg.hexDataLength).toBe('function')
    expect(typeof viemPkg.isHexString).toBe('function')
    expect(typeof viemPkg.keccak256).toBe('function')
    expect(typeof viemPkg.getAddress).toBe('function')
    expect(typeof viemPkg.isAddress).toBe('function')
    expect(typeof viemPkg.rlpEncode).toBe('function')
    expect(typeof viemPkg.encodeFunctionData).toBe('function')
    expect(typeof viemPkg.decodeFunctionResult).toBe('function')
    expect(typeof viemPkg.encodeEventTopic).toBe('function')
    expect(typeof viemPkg.decodeEventLog).toBe('function')
    expect(typeof viemPkg.getFunctionSelector).toBe('function')
    expect(typeof viemPkg.getFunctionSignature).toBe('function')
  })

  // --- ABIs ---
  it('exports all ABI arrays', () => {
    expect(viemPkg.ArbAddressTableAbi).toBeDefined()
    expect(viemPkg.ArbRetryableTxAbi).toBeDefined()
    expect(viemPkg.ArbSysAbi).toBeDefined()
    expect(viemPkg.BoldRollupUserLogicAbi).toBeDefined()
    expect(viemPkg.BridgeAbi).toBeDefined()
    expect(viemPkg.ERC20Abi).toBeDefined()
    expect(viemPkg.ERC20InboxAbi).toBeDefined()
    expect(viemPkg.IArbTokenAbi).toBeDefined()
    expect(viemPkg.ICustomTokenAbi).toBeDefined()
    expect(viemPkg.IERC20Abi).toBeDefined()
    expect(viemPkg.IERC20BridgeAbi).toBeDefined()
    expect(viemPkg.IInboxAbi).toBeDefined()
    expect(viemPkg.IL1TeleporterAbi).toBeDefined()
    expect(viemPkg.IL2ForwarderFactoryAbi).toBeDefined()
    expect(viemPkg.IL2ForwarderPredictorAbi).toBeDefined()
    expect(viemPkg.InboxAbi).toBeDefined()
    expect(viemPkg.L1ERC20GatewayAbi).toBeDefined()
    expect(viemPkg.L1GatewayRouterAbi).toBeDefined()
    expect(viemPkg.L1WethGatewayAbi).toBeDefined()
    expect(viemPkg.L2ArbitrumGatewayAbi).toBeDefined()
    expect(viemPkg.L2ERC20GatewayAbi).toBeDefined()
    expect(viemPkg.L2GatewayRouterAbi).toBeDefined()
    expect(viemPkg.L2GatewayTokenAbi).toBeDefined()
    expect(viemPkg.Multicall2Abi).toBeDefined()
    expect(viemPkg.NodeInterfaceAbi).toBeDefined()
    expect(viemPkg.OutboxAbi).toBeDefined()
    expect(viemPkg.OutboxClassicAbi).toBeDefined()
    expect(viemPkg.RollupAdminLogicAbi).toBeDefined()
    expect(viemPkg.RollupUserLogicAbi).toBeDefined()
    expect(viemPkg.SequencerInboxAbi).toBeDefined()
  })

  // --- ArbitrumContract ---
  it('exports ArbitrumContract', () => {
    expect(typeof viemPkg.ArbitrumContract).toBe('function')
  })

  // --- Negative tests ---
  it('does NOT export ArbitrumProvider', () => {
    expect((viemPkg as any).ArbitrumProvider).toBeUndefined()
  })

  it('does NOT export wrapPublicClient (internal adapter)', () => {
    expect((viemPkg as any).wrapPublicClient).toBeUndefined()
  })
})
