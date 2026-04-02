/**
 * Tests for the barrel export (index.ts).
 *
 * Verifies that all expected functions and types are accessible
 * from the top-level '@arbitrum/ethers5' package import.
 */
import { describe, it, expect } from 'vitest'
import * as ethers5 from '../src/index'

describe('@arbitrum/ethers5 barrel export', () => {
  it('exports adapter functions', () => {
    expect(typeof ethers5.wrapProvider).toBe('function')
    expect(typeof ethers5.fromEthersReceipt).toBe('function')
    expect(typeof ethers5.fromEthersLog).toBe('function')
  })

  it('exports ETH bridger functions', () => {
    expect(typeof ethers5.getDepositRequest).toBe('function')
    expect(typeof ethers5.getWithdrawalRequest).toBe('function')
    expect(typeof ethers5.getApproveGasTokenRequest).toBe('function')
  })

  it('exports ERC-20 bridger functions', () => {
    expect(typeof ethers5.getApproveTokenRequest).toBe('function')
    expect(typeof ethers5.getErc20DepositRequest).toBe('function')
    expect(typeof ethers5.getErc20WithdrawalRequest).toBe('function')
    expect(typeof ethers5.getParentGatewayAddress).toBe('function')
    expect(typeof ethers5.getChildGatewayAddress).toBe('function')
    expect(typeof ethers5.getChildErc20Address).toBe('function')
    expect(typeof ethers5.getParentErc20Address).toBe('function')
  })

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

  it('exports admin functions', () => {
    expect(typeof ethers5.getRegisterCustomTokenRequest).toBe('function')
    expect(typeof ethers5.getSetGatewaysRequest).toBe('function')
  })

  it('exports message status enums', () => {
    expect(ethers5.ParentToChildMessageStatus).toBeDefined()
    expect(ethers5.ChildToParentMessageStatus).toBeDefined()
    expect(ethers5.EthDepositMessageStatus).toBeDefined()
    expect(ethers5.InboxMessageKind).toBeDefined()
  })

  it('exports constants', () => {
    expect(typeof ethers5.NODE_INTERFACE_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_SYS_ADDRESS).toBe('string')
    expect(typeof ethers5.ARB_RETRYABLE_TX_ADDRESS).toBe('string')
    expect(typeof ethers5.ADDRESS_ZERO).toBe('string')
  })

  it('exports error classes', () => {
    expect(typeof ethers5.ArbSdkError).toBe('function')
    expect(typeof ethers5.MissingProviderArbSdkError).toBe('function')
  })

  it('exports gas estimation functions', () => {
    expect(typeof ethers5.estimateSubmissionFee).toBe('function')
    expect(typeof ethers5.estimateRetryableTicketGasLimit).toBe('function')
    expect(typeof ethers5.estimateMaxFeePerGas).toBe('function')
    expect(typeof ethers5.estimateAll).toBe('function')
  })

  it('exports RetryableDataTools', () => {
    expect(ethers5.RetryableDataTools).toBeDefined()
  })

  it('exports reader classes', () => {
    expect(typeof ethers5.ParentToChildMessageReader).toBe('function')
    expect(typeof ethers5.ChildToParentMessageReader).toBe('function')
    expect(typeof ethers5.EthDepositMessage).toBe('function')
  })
})
