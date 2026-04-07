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

import {
  Provider,
  BlockTag,
  Filter,
  Log,
} from '@ethersproject/abstract-provider'
import { Contract, Event } from '@ethersproject/contracts'
import { constants } from 'ethers'
import { TypedEvent, TypedEventFilter } from '../abi/common'
import { EventArgs, TypeChainContractFactory } from '../dataEntities/event'

export const DEFAULT_MAX_BLOCK_RANGE = 10_000
const MIN_CHUNK_SIZE = 500

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
 * Fetches and parses blockchain logs
 */
export class EventFetcher {
  private static maxBlockRange: number = DEFAULT_MAX_BLOCK_RANGE

  /**
   * Set the maximum block range used by all EventFetcher instances
   * when chunking log queries after an initial failure.
   */
  public static setMaxBlockRange(maxBlockRange: number): void {
    EventFetcher.maxBlockRange = maxBlockRange
  }

  public constructor(public readonly provider: Provider) {}

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

  private async resolveBlockTag(
    blockTag: BlockTag | undefined
  ): Promise<number | null> {
    if (typeof blockTag === 'number') {
      if (blockTag >= 0) return blockTag

      const latestBlock = await this.provider.getBlockNumber()
      return Math.max(latestBlock + blockTag, 0)
    }
    if (blockTag === 'earliest') return 0
    if (typeof blockTag === 'string' && blockTag.startsWith('0x')) {
      const parsed = parseInt(blockTag, 16)
      return isNaN(parsed) ? null : parsed
    }
    // 'latest', 'pending', 'safe', 'finalized', undefined
    const block = await this.provider.getBlock(blockTag ?? 'latest')
    return block?.number ?? null
  }

  private async getLogsWithChunking(filter: Filter): Promise<Log[]> {
    try {
      return await this.provider.getLogs(filter)
    } catch (error) {
      const fromBlock = await this.resolveBlockTag(filter.fromBlock)
      const toBlock = await this.resolveBlockTag(filter.toBlock)

      if (fromBlock === null || toBlock === null) {
        throw error
      }

      const initialChunkSize = Math.min(
        EventFetcher.maxBlockRange,
        toBlock - fromBlock + 1
      )

      if (initialChunkSize <= 0) {
        throw error
      }

      return this.fetchLogsInRange(filter, fromBlock, toBlock, initialChunkSize)
    }
  }

  private async fetchLogsInRange(
    filter: Filter,
    fromBlock: number,
    toBlock: number,
    chunkSize: number
  ): Promise<Log[]> {
    const allLogs: Log[] = []
    let start = fromBlock

    while (start <= toBlock) {
      if (start > fromBlock) {
        await new Promise(r => setTimeout(r, 100))
      }

      const end = Math.min(start + chunkSize - 1, toBlock)
      try {
        const chunkLogs = await this.provider.getLogs({
          ...filter,
          fromBlock: start,
          toBlock: end,
        })
        allLogs.push(...chunkLogs)
      } catch (error) {
        if (chunkSize > MIN_CHUNK_SIZE) {
          const retryLogs = await this.fetchLogsInRange(
            filter,
            start,
            end,
            Math.floor(chunkSize / 2)
          )
          allLogs.push(...retryLogs)
        } else {
          throw error
        }
      }
      start = end + 1
    }

    return allLogs
  }
}
