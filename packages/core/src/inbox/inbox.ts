/**
 * Force inclusion functions for the Arbitrum inbox.
 *
 * These functions produce TransactionRequestData (calldata only, never sign or send).
 * They use ArbitrumProvider, ArbitrumContract, and the SequencerInbox / Bridge ABIs.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type { TransactionRequestData } from '../interfaces/types'
import type { ArbitrumNetwork } from '../networks'
import type { ParsedEventLog } from '../contracts/Contract'
import { ArbitrumContract } from '../contracts/Contract'
import { EventFetcher } from '../utils/eventFetcher'
import { MultiCaller } from '../utils/multicall'
import { SequencerInboxAbi } from '../abi/SequencerInbox'
import { BridgeAbi } from '../abi/Bridge'
import { encodeFunctionData, decodeFunctionResult } from '../encoding/abi'

/**
 * Data for a force-includable event.
 */
export interface ForceInclusionParams {
  /** The parsed MessageDelivered event */
  event: ParsedEventLog
  /** The delayed accumulator hash at this message index */
  delayedAcc: string
}

/**
 * Find the latest message event that is eligible for force inclusion.
 *
 * Returns null if no eligible event is found within the search range.
 *
 * @param params.parentProvider - Provider for the parent chain
 * @param params.network - The Arbitrum network configuration
 * @param params.maxSearchRangeBlocks - Max range of blocks to search (default: ~3 days)
 * @param params.startSearchRangeBlocks - Initial search range (default: 100)
 * @param params.rangeMultiplier - Multiplier for expanding search (default: 2)
 */
export async function getForceIncludableEvent(params: {
  parentProvider: ArbitrumProvider
  network: ArbitrumNetwork
  maxSearchRangeBlocks?: number
  startSearchRangeBlocks?: number
  rangeMultiplier?: number
}): Promise<ForceInclusionParams | null> {
  const {
    parentProvider,
    network,
    maxSearchRangeBlocks = 3 * 6545,
    startSearchRangeBlocks = 100,
    rangeMultiplier = 2,
  } = params

  const bridgeAddress = network.ethBridge.bridge
  const sequencerInboxAddress = network.ethBridge.sequencerInbox

  // Get the block range eligible for force inclusion
  const blockRange = await getForceIncludableBlockRange(
    parentProvider,
    network,
    startSearchRangeBlocks
  )

  if (!blockRange) return null

  // Search for MessageDelivered events with increasing range
  const events = await searchForEventsWithIncreasingRange(
    parentProvider,
    bridgeAddress,
    network,
    startSearchRangeBlocks,
    maxSearchRangeBlocks,
    rangeMultiplier
  )

  if (events.length === 0) return null

  // Take the last event -- including this one will include all previous events
  const eventInfo = events[events.length - 1]

  // Check if the sequencer has already read past this message
  const sequencerInbox = new ArbitrumContract(
    SequencerInboxAbi,
    sequencerInboxAddress,
    parentProvider
  )
  const [totalDelayedRead] = (await sequencerInbox.read(
    'totalDelayedMessagesRead',
    []
  )) as [bigint]

  const messageIndex = eventInfo.args.messageIndex as bigint

  if (totalDelayedRead > messageIndex) {
    // More delayed messages have already been read than this index
    return null
  }

  // Get the delayed accumulator for this message index
  const bridge = new ArbitrumContract(BridgeAbi, bridgeAddress, parentProvider)
  const [delayedAcc] = (await bridge.read('delayedInboxAccs', [
    messageIndex,
  ])) as [string]

  return {
    event: eventInfo,
    delayedAcc,
  }
}

/**
 * Build a transaction request to force include all eligible delayed messages.
 *
 * @param params.parentProvider - Provider for the parent chain
 * @param params.network - The Arbitrum network configuration
 * @param params.event - The force-includable event (from getForceIncludableEvent)
 * @param params.from - Sender address
 * @returns TransactionRequestData for the forceInclusion call, or null if no eligible event found
 */
export async function getForceIncludeRequest(params: {
  parentProvider: ArbitrumProvider
  network: ArbitrumNetwork
  event?: ForceInclusionParams
  from: string
}): Promise<TransactionRequestData | null> {
  const { parentProvider, network, from } = params

  // Find an event if none was provided
  const eventInfo =
    params.event ??
    (await getForceIncludableEvent({ parentProvider, network }))

  if (!eventInfo) return null

  // Get the block for the event to retrieve its timestamp
  const blockNumber = eventInfo.event.blockNumber
  const block = await parentProvider.getBlock(blockNumber)
  if (!block) return null

  const messageIndex = eventInfo.event.args.messageIndex as bigint
  const kind = eventInfo.event.args.kind as bigint
  const sender = eventInfo.event.args.sender as string
  const messageDataHash = eventInfo.event.args.messageDataHash as string
  const baseFeeL1 = eventInfo.event.args.baseFeeL1 as bigint

  // Encode the forceInclusion call
  const calldata = encodeFunctionData(SequencerInboxAbi, 'forceInclusion', [
    messageIndex + 1n, // _totalDelayedMessagesRead
    kind, // kind
    [BigInt(blockNumber), BigInt(block.timestamp)], // l1BlockAndTime
    baseFeeL1, // baseFeeL1
    sender, // sender
    messageDataHash, // messageDataHash
  ])

  return {
    to: network.ethBridge.sequencerInbox,
    data: calldata,
    value: 0n,
    from,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the block range within which messages are eligible for force inclusion.
 */
async function getForceIncludableBlockRange(
  parentProvider: ArbitrumProvider,
  network: ArbitrumNetwork,
  blockNumberRangeSize: number
): Promise<{ startBlock: number; endBlock: number } | null> {
  const multicall = await MultiCaller.fromProvider(parentProvider)

  const sequencerInbox = new ArbitrumContract(
    SequencerInboxAbi,
    network.ethBridge.sequencerInbox,
    parentProvider
  )

  // Batch: maxTimeVariation + getBlockNumber + getCurrentBlockTimestamp
  const multicallInput: [
    CallInput<{
      delayBlocks: bigint
      futureBlocks: bigint
      delaySeconds: bigint
      futureSeconds: bigint
    }>,
    CallInput<bigint>,
    CallInput<bigint>,
  ] = [
    {
      targetAddr: network.ethBridge.sequencerInbox,
      encoder: () =>
        encodeFunctionData(SequencerInboxAbi, 'maxTimeVariation', []),
      decoder: (returnData: string) => {
        const result = decodeFunctionResult(
          SequencerInboxAbi,
          'maxTimeVariation',
          returnData
        )
        return {
          delayBlocks: result[0] as bigint,
          futureBlocks: result[1] as bigint,
          delaySeconds: result[2] as bigint,
          futureSeconds: result[3] as bigint,
        }
      },
    },
    multicall.getBlockNumberInput(),
    multicall.getCurrentBlockTimestampInput(),
  ]

  const [maxTimeVariation, currentBlockNumber, currentBlockTimestamp] =
    await multicall.multiCall(multicallInput, true)

  if (!maxTimeVariation || !currentBlockNumber || !currentBlockTimestamp) {
    return null
  }

  const blockNumber = Number(currentBlockNumber)
  const firstEligibleBlockNumber =
    blockNumber - Number(maxTimeVariation.delayBlocks)
  const firstEligibleTimestamp =
    Number(currentBlockTimestamp) - Number(maxTimeVariation.delaySeconds)

  // Find a block that is before the eligible threshold
  const endBlock = await findFirstBlockBelow(
    parentProvider,
    firstEligibleBlockNumber,
    firstEligibleTimestamp
  )
  if (!endBlock) return null

  return {
    endBlock: endBlock.number,
    startBlock: endBlock.number - blockNumberRangeSize,
  }
}

// Import type for multicall input
type CallInput<T> = import('../utils/multicall').CallInput<T>

/**
 * Recursively find the first block below the given number whose timestamp
 * is below the given timestamp.
 */
async function findFirstBlockBelow(
  provider: ArbitrumProvider,
  blockNumber: number,
  blockTimestamp: number
): Promise<{ number: number; timestamp: number } | null> {
  if (blockNumber < 0) return null

  const block = await provider.getBlock(blockNumber)
  if (!block) return null

  const diff = block.timestamp - blockTimestamp
  if (diff < 0) return { number: block.number, timestamp: block.timestamp }

  // Move at least 10 blocks, or estimate based on ~12s block time
  const diffBlocks = Math.max(Math.ceil(diff / 12), 10)

  return findFirstBlockBelow(provider, blockNumber - diffBlocks, blockTimestamp)
}

/**
 * Search for MessageDelivered events, expanding the search range if none are found.
 */
async function searchForEventsWithIncreasingRange(
  parentProvider: ArbitrumProvider,
  bridgeAddress: string,
  network: ArbitrumNetwork,
  searchRangeBlocks: number,
  maxSearchRangeBlocks: number,
  rangeMultiplier: number
): Promise<ParsedEventLog[]> {
  const cappedSearchRangeBlocks = Math.min(
    searchRangeBlocks,
    maxSearchRangeBlocks
  )

  const blockRange = await getForceIncludableBlockRange(
    parentProvider,
    network,
    cappedSearchRangeBlocks
  )

  if (!blockRange) return []

  const eFetcher = new EventFetcher(parentProvider)
  const events = await eFetcher.getEvents(BridgeAbi, 'MessageDelivered', {
    fromBlock: blockRange.startBlock,
    toBlock: blockRange.endBlock,
    address: bridgeAddress,
  })

  if (events.length !== 0) return events
  if (cappedSearchRangeBlocks === maxSearchRangeBlocks) return []

  return searchForEventsWithIncreasingRange(
    parentProvider,
    bridgeAddress,
    network,
    searchRangeBlocks * rangeMultiplier,
    maxSearchRangeBlocks,
    rangeMultiplier
  )
}
