import { describe, it, expect, vi } from 'vitest'
import { MultiCaller } from '../../../src/compat/multicall'

describe('MultiCaller (compat)', () => {
  it('constructs with a provider and address', () => {
    const mockProvider = {} as any
    const address = '0x5ba1e12693dc8f9c48aad8770482f4739beed696'
    const caller = new MultiCaller(mockProvider, address)
    expect(caller.address).to.eq(address)
  })

  it('has static fromProvider method', () => {
    expect(typeof MultiCaller.fromProvider).to.eq('function')
  })

  it('has multiCall method', () => {
    const mockProvider = {} as any
    const caller = new MultiCaller(
      mockProvider,
      '0x5ba1e12693dc8f9c48aad8770482f4739beed696'
    )
    expect(typeof caller.multiCall).to.eq('function')
  })

  it('has getBlockNumberInput method', () => {
    const mockProvider = {} as any
    const caller = new MultiCaller(
      mockProvider,
      '0x5ba1e12693dc8f9c48aad8770482f4739beed696'
    )
    expect(typeof caller.getBlockNumberInput).to.eq('function')
  })

  it('has getCurrentBlockTimestampInput method', () => {
    const mockProvider = {} as any
    const caller = new MultiCaller(
      mockProvider,
      '0x5ba1e12693dc8f9c48aad8770482f4739beed696'
    )
    expect(typeof caller.getCurrentBlockTimestampInput).to.eq('function')
  })

  it('has getTokenData method', () => {
    const mockProvider = {} as any
    const caller = new MultiCaller(
      mockProvider,
      '0x5ba1e12693dc8f9c48aad8770482f4739beed696'
    )
    expect(typeof caller.getTokenData).to.eq('function')
  })
})
