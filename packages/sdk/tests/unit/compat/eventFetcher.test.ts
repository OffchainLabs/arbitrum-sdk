import { describe, it, expect, vi } from 'vitest'
import { EventFetcher } from '../../../src/compat/eventFetcher'

describe('EventFetcher (compat)', () => {
  it('constructs with a provider', () => {
    const mockProvider = { getLogs: vi.fn() } as any
    const fetcher = new EventFetcher(mockProvider)
    expect(fetcher.provider).to.equal(mockProvider)
  })

  it('has getEvents method', () => {
    const mockProvider = { getLogs: vi.fn() } as any
    const fetcher = new EventFetcher(mockProvider)
    expect(typeof fetcher.getEvents).to.eq('function')
  })
})
