/**
 * Compat layer: EventFetcher
 *
 * Backwards-compatible wrapper that delegates to the original
 * lib EventFetcher.
 */
import type { Provider } from '@ethersproject/abstract-provider'
import { EventFetcher as OriginalEventFetcher } from '../lib/utils/eventFetcher'

export type { FetchedEvent } from '../lib/utils/eventFetcher'

export class EventFetcher {
  public readonly provider: Provider

  constructor(provider: Provider) {
    this.provider = provider
  }

  public async getEvents(
    contractFactory: any,
    topicGenerator: any,
    filter: any
  ): Promise<any[]> {
    const original = new OriginalEventFetcher(this.provider)
    return original.getEvents(contractFactory, topicGenerator, filter)
  }
}
