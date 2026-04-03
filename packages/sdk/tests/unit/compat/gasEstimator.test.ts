import { describe, it, expect } from 'vitest'
import { ParentToChildMessageGasEstimator } from '../../../src/compat/gasEstimator'

describe('ParentToChildMessageGasEstimator (compat)', () => {
  it('constructs with a child provider', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(estimator.childProvider).to.equal(mockProvider)
  })

  it('has estimateSubmissionFee method', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(typeof estimator.estimateSubmissionFee).to.eq('function')
  })

  it('has estimateRetryableTicketGasLimit method', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(typeof estimator.estimateRetryableTicketGasLimit).to.eq('function')
  })

  it('has estimateMaxFeePerGas method', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(typeof estimator.estimateMaxFeePerGas).to.eq('function')
  })

  it('has estimateAll method', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(typeof estimator.estimateAll).to.eq('function')
  })

  it('has populateFunctionParams method', () => {
    const mockProvider = {} as any
    const estimator = new ParentToChildMessageGasEstimator(mockProvider)
    expect(typeof estimator.populateFunctionParams).to.eq('function')
  })

  it('has static isValid method', () => {
    expect(typeof ParentToChildMessageGasEstimator.isValid).to.eq('function')
  })
})
