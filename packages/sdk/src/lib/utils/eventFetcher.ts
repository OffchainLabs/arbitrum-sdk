/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { Provider, BlockTag, Filter } from '@ethersproject/abstract-provider'
import { Contract, Event } from '@ethersproject/contracts'
import { constants } from 'ethers'
import { TypedEvent, TypedEventFilter } from '../abi/common'
import { EventArgs, TypeChainContractFactory } from '../dataEntities/event'

export type FetchedEvent<TEvent extends Event> = {
  event: EventArgs<TEvent>
  topic: string
  name: string
  blockNumber: number
  blockHash: string
  transactionHash: string
  address: string
  topics: string[]
  data: string
}

// I'm not sure why, but I wasn't able to get the getEvents function to properly
// infer the Event return type. It would always infer it as TypedEvent<any, any>
// instead of the strong typed event that should be available. This type correctly
// infers the event type so we can force getEvents to return the correct type
// using this.
type TEventOf<T> = T extends TypedEventFilter<infer TEvent> ? TEvent : never

/**
 * Fetches and parses blockchain logs, with optional chunked querying
 * for RPC providers that limit block ranges.
 */
export class EventFetcher {
  /**
   * @param provider The provider to fetch logs from
   * @param maxBlockRange Optional maximum block range per query. When set,
   *   queries spanning more than this many blocks are automatically split
   *   into sequential chunks. Useful for RPC providers with block range limits
   *   (e.g. free-tier nodes that cap at 10,000 blocks).
   */
  public constructor(
    public readonly provider: Provider,
    public readonly maxBlockRange?: number
  ) {}

  /**
   * Fetch logs and parse logs
   * @param contractFactory A contract factory for generating a contract of type TContract at the addr
   * @param topicGenerator Generator function for creating
   * @param filter Block and address filter parameters
   * @returns
   */
  public async getEvents<
    TContract extends Contract,
    TEventFilter extends TypedEventFilter<TypedEvent>
  >(
    contractFactory: TypeChainContractFactory<TContract>,
    topicGenerator: (t: TContract) => TEventFilter,
    filter: {
      fromBlock: BlockTag
      toBlock: BlockTag
      address?: string
    }
  ): Promise<FetchedEvent<TEventOf<TEventFilter>>[]> {
    const contract = contractFactory.connect(
      filter.address || constants.AddressZero,
      this.provider
    )
    const eventFilter = topicGenerator(contract)
    const fullFilter: Filter = {
      ...eventFilter,
      address: filter.address,
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
    }
    const logs = await this.getLogsWithChunking(fullFilter)
    return logs
      .filter(l => l.removed === false)
      .map(l => {
        const pLog = contract.interface.parseLog(l)

        return {
          event: pLog.args,
          topic: pLog.topic,
          name: pLog.name,
          blockNumber: l.blockNumber,
          blockHash: l.blockHash,
          transactionHash: l.transactionHash,

          address: l.address,
          topics: l.topics,
          data: l.data,
        }
      }) as FetchedEvent<TEventOf<TEventFilter>>[]
  }

  private async getLogsWithChunking(
    filter: Filter
  ): Promise<import('@ethersproject/abstract-provider').Log[]> {
    if (!this.maxBlockRange) {
      return this.provider.getLogs(filter)
    }

    const fromBlock =
      typeof filter.fromBlock === 'number'
        ? filter.fromBlock
        : typeof filter.fromBlock === 'string' && filter.fromBlock !== 'latest'
          ? parseInt(filter.fromBlock, 16)
          : null

    let toBlock: number | null = null
    if (typeof filter.toBlock === 'number') {
      toBlock = filter.toBlock
    } else if (filter.toBlock === 'latest' || filter.toBlock === undefined) {
      toBlock = await this.provider.getBlockNumber()
    } else if (typeof filter.toBlock === 'string') {
      toBlock = parseInt(filter.toBlock, 16)
    }

    if (fromBlock === null || toBlock === null) {
      return this.provider.getLogs(filter)
    }

    const range = toBlock - fromBlock
    if (range <= this.maxBlockRange) {
      return this.provider.getLogs(filter)
    }

    const allLogs: import('@ethersproject/abstract-provider').Log[] = []
    for (
      let start = fromBlock;
      start <= toBlock;
      start += this.maxBlockRange + 1
    ) {
      const end = Math.min(start + this.maxBlockRange, toBlock)
      const chunkLogs = await this.provider.getLogs({
        ...filter,
        fromBlock: start,
        toBlock: end,
      })
      allLogs.push(...chunkLogs)
    }

    return allLogs
  }
}
