import { describe, it, expect } from 'vitest'
import { ArbitrumProvider } from '../../../src/compat/arbProvider'

describe('ArbitrumProvider (compat)', () => {
  it('is exported as a class', () => {
    expect(typeof ArbitrumProvider).to.eq('function')
  })
})
