/**
 * Tests for the barrel export — verifies the public API surface.
 *
 * Key invariant: ArbitrumProvider is NOT exported from @arbitrum/viem.
 * Users only interact with viem types.
 */
import { describe, it, expect } from 'vitest'
import * as viemPkg from '../src/index'

describe('@arbitrum/viem public API', () => {
  it('exports getDepositRequest', () => {
    expect(typeof viemPkg.getDepositRequest).toBe('function')
  })

  it('exports getWithdrawalRequest', () => {
    expect(typeof viemPkg.getWithdrawalRequest).toBe('function')
  })

  it('exports getApproveGasTokenRequest', () => {
    expect(typeof viemPkg.getApproveGasTokenRequest).toBe('function')
  })

  it('exports getErc20WithdrawalRequest', () => {
    expect(typeof viemPkg.getErc20WithdrawalRequest).toBe('function')
  })

  it('exports getApproveTokenRequest', () => {
    expect(typeof viemPkg.getApproveTokenRequest).toBe('function')
  })

  it('exports getErc20DepositRequest', () => {
    expect(typeof viemPkg.getErc20DepositRequest).toBe('function')
  })

  it('exports getParentToChildMessages', () => {
    expect(typeof viemPkg.getParentToChildMessages).toBe('function')
  })

  it('exports getChildToParentMessages', () => {
    expect(typeof viemPkg.getChildToParentMessages).toBe('function')
  })

  it('exports getRedeemRequest', () => {
    expect(typeof viemPkg.getRedeemRequest).toBe('function')
  })

  it('exports getCancelRetryableRequest', () => {
    expect(typeof viemPkg.getCancelRetryableRequest).toBe('function')
  })

  it('exports getKeepAliveRequest', () => {
    expect(typeof viemPkg.getKeepAliveRequest).toBe('function')
  })

  it('exports getExecuteRequest', () => {
    expect(typeof viemPkg.getExecuteRequest).toBe('function')
  })

  it('exports getArbitrumNetwork', () => {
    expect(typeof viemPkg.getArbitrumNetwork).toBe('function')
  })

  it('exports getArbitrumNetworks', () => {
    expect(typeof viemPkg.getArbitrumNetworks).toBe('function')
  })

  it('exports getArbitrumNetworkFromProvider', () => {
    expect(typeof viemPkg.getArbitrumNetworkFromProvider).toBe('function')
  })

  it('exports getRegisterCustomTokenRequest', () => {
    expect(typeof viemPkg.getRegisterCustomTokenRequest).toBe('function')
  })

  it('exports getSetGatewaysRequest', () => {
    expect(typeof viemPkg.getSetGatewaysRequest).toBe('function')
  })

  it('exports fromViemReceipt adapter', () => {
    expect(typeof viemPkg.fromViemReceipt).toBe('function')
  })

  it('exports fromViemLog adapter', () => {
    expect(typeof viemPkg.fromViemLog).toBe('function')
  })

  it('does NOT export ArbitrumProvider', () => {
    // ArbitrumProvider is internal to the adapter — users should never see it
    expect((viemPkg as any).ArbitrumProvider).toBeUndefined()
  })

  it('does NOT export wrapPublicClient (internal adapter)', () => {
    // wrapPublicClient is internal — users don't need to call it directly
    expect((viemPkg as any).wrapPublicClient).toBeUndefined()
  })

  it('exports ERC-20 gateway resolution functions', () => {
    expect(typeof viemPkg.getParentGatewayAddress).toBe('function')
    expect(typeof viemPkg.getChildGatewayAddress).toBe('function')
    expect(typeof viemPkg.getChildErc20Address).toBe('function')
    expect(typeof viemPkg.getParentErc20Address).toBe('function')
  })

  it('exports network utility functions', () => {
    expect(typeof viemPkg.registerCustomArbitrumNetwork).toBe('function')
    expect(typeof viemPkg.isParentNetwork).toBe('function')
    expect(typeof viemPkg.getChildrenForNetwork).toBe('function')
  })
})
