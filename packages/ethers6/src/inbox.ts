/**
 * Inbox / force inclusion functions for ethers v6 users.
 */
import {
  getForceIncludableEvent as coreGetForceIncludableEvent,
  getForceIncludeRequest as coreGetForceIncludeRequest,
} from '@arbitrum/core'
import type {
  ArbitrumNetwork,
  TransactionRequestData,
  ForceInclusionParams,
} from '@arbitrum/core'
import { wrapProvider, type Ethers6Provider } from './adapter'

export async function getForceIncludableEvent(params: {
  parentProvider: Ethers6Provider
  network: ArbitrumNetwork
  maxSearchRangeBlocks?: number
  startSearchRangeBlocks?: number
  rangeMultiplier?: number
}): Promise<ForceInclusionParams | null> {
  return coreGetForceIncludableEvent({
    ...params,
    parentProvider: wrapProvider(params.parentProvider),
  })
}

export async function getForceIncludeRequest(params: {
  parentProvider: Ethers6Provider
  network: ArbitrumNetwork
  event?: ForceInclusionParams
  from: string
}): Promise<TransactionRequestData | null> {
  return coreGetForceIncludeRequest({
    ...params,
    parentProvider: wrapProvider(params.parentProvider),
  })
}
