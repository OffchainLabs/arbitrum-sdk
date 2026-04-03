import { describe, it, expect, vi } from 'vitest'
import { ParentToChildMessageCreator } from '../../../src/compat/messageCreator'

describe('ParentToChildMessageCreator (compat)', () => {
  it('constructs with a parent signer that has a provider', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const creator = new ParentToChildMessageCreator(mockSigner)
    expect(creator.parentSigner).to.equal(mockSigner)
  })

  it('throws when signer has no provider', () => {
    const mockSigner = {
      signMessage: vi.fn(),
    } as any
    expect(() => new ParentToChildMessageCreator(mockSigner)).to.throw()
  })

  it('has static getTicketCreationRequest method', () => {
    expect(typeof ParentToChildMessageCreator.getTicketCreationRequest).to.eq(
      'function'
    )
  })

  it('has createRetryableTicket method', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const creator = new ParentToChildMessageCreator(mockSigner)
    expect(typeof creator.createRetryableTicket).to.eq('function')
  })
})
