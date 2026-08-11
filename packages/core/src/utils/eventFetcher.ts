/**
 * EventFetcher — fetches and parses blockchain event logs using
 * ArbitrumProvider.getLogs() and ArbitrumContract.parseEventLogs().
 *
 * This replaces the ethers-based EventFetcher with a provider-agnostic
 * implementation that uses the core ABI decoder.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type { BlockTag, ArbitrumLog } from '../interfaces/types'
import { ArbitrumContract, type ParsedEventLog } from '../contracts/Contract'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Abi = readonly any[]

export interface EventFetcherFilter {
  fromBlock: BlockTag
  toBlock: BlockTag
  /** Contract address to filter by. If omitted, logs from all addresses are returned. */
  address?: string
}

/**
 * Fetches and parses blockchain event logs using ArbitrumProvider.
 */
export class EventFetcher {
  constructor(public readonly provider: ArbitrumProvider) {}

  /**
   * Fetch logs matching a specific event from a contract ABI, then parse them.
   *
   * @param abi - The contract ABI containing the event definition
   * @param eventName - The name of the event to filter for
   * @param filter - Block range and optional address filter
   * @returns Parsed event logs with decoded arguments
   */
  async getEvents(
    abi: Abi,
    eventName: string,
    filter: EventFetcherFilter
  ): Promise<ParsedEventLog[]> {
    const contract = new ArbitrumContract(abi, filter.address ?? '0x0000000000000000000000000000000000000000')
    const topic = contract.getEventTopic(eventName)

    const logs = await this.provider.getLogs({
      address: filter.address,
      topics: [topic],
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
    })

    return contract.parseEventLogs(eventName, logs)
  }
}
