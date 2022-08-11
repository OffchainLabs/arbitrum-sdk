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

import { Signer } from '@ethersproject/abstract-signer'
import { BigNumber, ContractTransaction, Overrides } from 'ethers'
import { MessageDeliveredEvent } from '../abi/Bridge'
import { L2Network } from '../dataEntities/networks'
import { FetchedEvent } from '../utils/eventFetcher'
import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  ClassicForceInclusionParams,
  ClassicMessageDeliveredEvent,
  lookupExistingNetwork,
  isNitroL1,
} from '../utils/migration_types'

type ForceInclusionParams = FetchedEvent<MessageDeliveredEvent> & {
  delayedAcc: string
}

/**
 * Tools for interacting with the inbox and bridge contracts
 */
export class InboxTools {
  private readonly classicInbox: classic.InboxTools
  private readonly nitroInbox: nitro.InboxTools
  constructor(
    private readonly l1Signer: Signer,
    private readonly l2Network: L2Network
  ) {
    this.classicInbox = new classic.InboxTools(
      l1Signer,
      lookupExistingNetwork(l2Network)
    )
    this.nitroInbox = new nitro.InboxTools(l1Signer, l2Network)
  }

  /**
   * Find the event of the latest message that can be force include
   * @param maxSearchRangeBlocks The max range of blocks to search in.
   * Defaults to 3 * 6545 ( = ~3 days) prior to the first eligble block
   * @param startSearchRangeBlocks The start range of block to search in.
   * Moves incrementally up to the maxSearchRangeBlocks. Defaults to 100;
   * @param rangeMultiplier The multiplier to use when increasing the block range
   * Defaults to 2.
   * @returns Null if non can be found.
   */
  public async getForceIncludableEvent(
    maxSearchRangeBlocks: number = 3 * 6545,
    startSearchRangeBlocks = 100,
    rangeMultipler = 2
  ): Promise<ForceInclusionParams | null> {
    if (await isNitroL1(this.l2Network.chainID, this.l1Signer)) {
      return this.nitroInbox.getForceIncludableEvent(
        maxSearchRangeBlocks,
        startSearchRangeBlocks,
        rangeMultipler
      )
    } else {
      const classicParams = await this.classicInbox.getForceIncludableEvent(
        maxSearchRangeBlocks,
        startSearchRangeBlocks,
        rangeMultipler
      )
      if (!classicParams) return null
      const event =
        classicParams.event as unknown as MessageDeliveredEvent['args']
      event[6] = BigNumber.from(0)
      event[7] = BigNumber.from(0)
      event.baseFeeL1 = BigNumber.from(0)
      event.timestamp = BigNumber.from(0)
      return {
        ...classicParams,
        event,
      }
    }
  }

  /**
   * Force includes all eligible messages in the delayed inbox.
   * The inbox contract doesnt allow a message to be force-included
   * until after a delay period has been completed.
   * @param messageDeliveredEvent Provide this to include all messages up to this one. Responsibility is on the caller to check the eligibility of this event.
   * @returns The force include transaction, or null if no eligible message were found for inclusion
   */
  public async forceInclude<T extends ForceInclusionParams | undefined>(
    messageDeliveredEvent?: T,
    overrides?: Overrides
  ): Promise<
    // if a message delivered event was supplied then we'll definitely return
    // a contract transaction or throw an error. If one isnt supplied then we may
    // find no eligible events, and so return null
    T extends ForceInclusionParams
      ? ContractTransaction
      : ContractTransaction | null
  >
  public async forceInclude<T extends ForceInclusionParams | undefined>(
    messageDeliveredEvent?: T,
    overrides?: Overrides
  ): Promise<ContractTransaction | null> {
    if (await isNitroL1(this.l2Network.chainID, this.l1Signer)) {
      return this.nitroInbox.forceInclude(messageDeliveredEvent, overrides)
    } else {
      if (messageDeliveredEvent) {
        const event = messageDeliveredEvent.event
        const tuple = [
          event[0],
          event[1],
          event[2],
          event[3],
          event[4],
          event[5],
        ]

        const typedTuple = tuple as ClassicMessageDeliveredEvent['args']
        typedTuple.beforeInboxAcc = event.beforeInboxAcc
        typedTuple.kind = event.kind
        typedTuple.messageDataHash = event.messageDataHash
        typedTuple.messageDataHash = event.messageDataHash
        typedTuple.messageIndex = event.messageIndex
        typedTuple.sender = event.sender
        typedTuple.inbox = event.inbox

        const classicEvent: ClassicForceInclusionParams = {
          ...messageDeliveredEvent,
          event: typedTuple,
        }

        return this.classicInbox.forceInclude(classicEvent, overrides)
      } else return this.classicInbox.forceInclude(undefined, overrides)
    }
  }
}
