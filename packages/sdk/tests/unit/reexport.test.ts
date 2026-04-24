/**
 * Smoke tests verifying the old SDK API surface is preserved.
 * Every symbol that was importable from @arbitrum/sdk should still be importable.
 */
import { describe, it, expect } from 'vitest'
import {
  // Bridger classes
  EthBridger,
  Erc20Bridger,
  AdminErc20Bridger,
  // Transaction receipt classes
  ParentTransactionReceipt,
  ChildTransactionReceipt,
  // Message classes
  ParentToChildMessageReader,
  ParentToChildMessageWriter,
  ChildToParentMessageReader,
  ChildToParentMessageWriter,
  ChildToParentMessage,
  EthDepositMessage,
  // Gas estimator
  ParentToChildMessageGasEstimator,
  // Utilities
  InboxTools,
  EventFetcher,
  MultiCaller,
  ArbitrumProvider,
  Address,
  // Network functions
  getArbitrumNetwork,
  getArbitrumNetworks,
  registerCustomArbitrumNetwork,
  getChildrenForNetwork,
  // Enums
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
  // Retryable data
  RetryableDataTools,
  // Scaling
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
  // Constants
  constants,
  // L1-L3
  EthL1L3Bridger,
  Erc20L1L3Bridger,
} from '../../src/index'

import type { ArbitrumNetwork } from '../../src/index'

describe('SDK backwards-compat smoke tests', () => {
  it('EthBridger class is constructable', () => {
    const network = getArbitrumNetwork(42161)
    const bridger = new EthBridger(network)
    expect(bridger).toBeDefined()
    expect(bridger.childNetwork.chainId).toBe(42161)
  })

  it('Erc20Bridger class is constructable', () => {
    const network = getArbitrumNetwork(42161)
    const bridger = new Erc20Bridger(network)
    expect(bridger).toBeDefined()
  })

  it('AdminErc20Bridger extends Erc20Bridger', () => {
    const network = getArbitrumNetwork(42161)
    const bridger = new AdminErc20Bridger(network)
    expect(bridger).toBeInstanceOf(Erc20Bridger)
  })

  it('ParentTransactionReceipt has monkeyPatchWait static methods', () => {
    expect(typeof ParentTransactionReceipt.monkeyPatchWait).toBe('function')
    expect(typeof ParentTransactionReceipt.monkeyPatchEthDepositWait).toBe(
      'function'
    )
    expect(typeof ParentTransactionReceipt.monkeyPatchContractCallWait).toBe(
      'function'
    )
  })

  it('ChildTransactionReceipt has monkeyPatchWait', () => {
    expect(typeof ChildTransactionReceipt.monkeyPatchWait).toBe('function')
  })

  it('Message classes exist', () => {
    expect(ParentToChildMessageReader).toBeDefined()
    expect(ParentToChildMessageWriter).toBeDefined()
    expect(ChildToParentMessageReader).toBeDefined()
    expect(ChildToParentMessageWriter).toBeDefined()
    expect(ChildToParentMessage).toBeDefined()
    expect(EthDepositMessage).toBeDefined()
  })

  it('Enums have correct values', () => {
    expect(ParentToChildMessageStatus.REDEEMED).toBeDefined()
    expect(ChildToParentMessageStatus.EXECUTED).toBeDefined()
    expect(EthDepositMessageStatus.DEPOSITED).toBeDefined()
  })

  it('Network functions work', () => {
    const network = getArbitrumNetwork(42161)
    expect(network.chainId).toBe(42161)
    expect(network.name).toBe('Arbitrum One')
    const all = getArbitrumNetworks()
    expect(all.length).toBeGreaterThan(0)
  })

  it('Utility classes exist', () => {
    expect(ParentToChildMessageGasEstimator).toBeDefined()
    expect(InboxTools).toBeDefined()
    expect(EventFetcher).toBeDefined()
    expect(MultiCaller).toBeDefined()
    expect(ArbitrumProvider).toBeDefined()
    expect(Address).toBeDefined()
    expect(RetryableDataTools).toBeDefined()
  })

  it('Constants namespace is exported', () => {
    expect(constants).toBeDefined()
    expect(typeof constants.NODE_INTERFACE_ADDRESS).toBe('string')
  })

  it('Scaling functions exist', () => {
    expect(typeof scaleFrom18DecimalsToNativeTokenDecimals).toBe('function')
    expect(typeof scaleFromNativeTokenDecimalsTo18Decimals).toBe('function')
  })

  it('L1-L3 bridger classes exist', () => {
    expect(EthL1L3Bridger).toBeDefined()
    expect(Erc20L1L3Bridger).toBeDefined()
  })

  it('Address class works', () => {
    const addr = new Address('0x1234567890123456789012345678901234567890')
    expect(addr.value).toBe('0x1234567890123456789012345678901234567890')
    const aliased = addr.applyAlias()
    expect(aliased).toBeInstanceOf(Address)
    const unaliased = aliased.undoAlias()
    expect(unaliased.value.toLowerCase()).toBe(addr.value.toLowerCase())
  })
})
