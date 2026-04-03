/**
 * Smoke tests verifying key symbols are importable from @arbitrum/sdk
 * (which now re-exports from @arbitrum/ethers5).
 */
import { describe, it, expect } from 'vitest'
import {
  getArbitrumNetwork,
  getDepositRequest,
  ParentToChildMessageStatus,
  getErc20L1L3ApproveTokenRequest,
  getErc20L1L3ApproveGasTokenRequest,
  getArbitrumNetworks,
  isArbitrumNetworkNativeTokenEther,
  NODE_INTERFACE_ADDRESS,
  ADDRESS_ZERO,
  ArbSdkError,
} from '../../src/index'

import type {
  ArbitrumNetwork,
  TransactionRequestData,
  GetEthL1L3DepositRequestParams,
  GetErc20L1L3DepositRequestParams,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
} from '../../src/index'

describe('SDK re-export smoke tests', () => {
  it('getArbitrumNetwork(42161) returns Arbitrum One', () => {
    const network = getArbitrumNetwork(42161)
    expect(network).toBeDefined()
    expect(network.chainId).toBe(42161)
    expect(network.name).toBe('Arbitrum One')
  })

  it('getDepositRequest is a function', () => {
    expect(typeof getDepositRequest).toBe('function')
  })

  it('ParentToChildMessageStatus enum exists with expected values', () => {
    expect(ParentToChildMessageStatus).toBeDefined()
    expect(ParentToChildMessageStatus.REDEEMED).toBeDefined()
  })

  it('ArbitrumNetwork type is available (compile-time check)', () => {
    const network: ArbitrumNetwork = getArbitrumNetwork(42161)
    expect(network.chainId).toBe(42161)
  })

  it('getArbitrumNetworks returns an array', () => {
    const networks = getArbitrumNetworks()
    expect(Array.isArray(networks)).toBe(true)
    expect(networks.length).toBeGreaterThan(0)
  })

  it('constants are re-exported', () => {
    expect(typeof NODE_INTERFACE_ADDRESS).toBe('string')
    expect(typeof ADDRESS_ZERO).toBe('string')
  })

  it('error classes are re-exported', () => {
    expect(ArbSdkError).toBeDefined()
    const err = new ArbSdkError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('test')
  })

  it('isArbitrumNetworkNativeTokenEther works', () => {
    const network = getArbitrumNetwork(42161)
    expect(isArbitrumNetworkNativeTokenEther(network)).toBe(true)
  })

  it('L1L3 pure functions are re-exported', () => {
    expect(typeof getErc20L1L3ApproveTokenRequest).toBe('function')
    expect(typeof getErc20L1L3ApproveGasTokenRequest).toBe('function')
  })

  it('L1L3 types compile (compile-time only)', () => {
    // These are compile-time checks -- the types are imported above
    // and used in type positions. If this file compiles, the types work.
    const _check1: GetEthL1L3DepositRequestParams | undefined = undefined
    const _check2: GetErc20L1L3DepositRequestParams | undefined = undefined
    const _check3: L1L3DepositStatus | undefined = undefined
    const _check4: Erc20L1L3DepositStatus | undefined = undefined
    const _check5: TransactionRequestData | undefined = undefined
    expect(true).toBe(true)
  })
})
