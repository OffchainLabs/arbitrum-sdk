/**
 * Inbox / force inclusion functions for ethers v5 users.
 */
import type { providers } from 'ethers'
import {
  getForceIncludableEvent as coreGetForceIncludableEvent,
  getForceIncludeRequest as coreGetForceIncludeRequest,
} from '@arbitrum/core'
import type {
  ArbitrumNetwork,
  TransactionRequestData,
  ForceInclusionParams,
} from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

export async function getForceIncludableEvent(params: {
  parentProvider: providers.Provider
  network: ArbitrumNetwork
  maxSearchRangeBlocks?: number
  startSearchRangeBlocks?: number
  rangeMultiplier?: number
}): Promise<ForceInclusionParams | null> {
  return coreGetForceIncludableEvent({
    ...params,
    parentProvider: wrapProvider(
      params.parentProvider as unknown as Ethers5Provider
    ),
  })
}

export async function getForceIncludeRequest(params: {
  parentProvider: providers.Provider
  network: ArbitrumNetwork
  event?: ForceInclusionParams
  from: string
}): Promise<TransactionRequestData | null> {
  return coreGetForceIncludeRequest({
    ...params,
    parentProvider: wrapProvider(
      params.parentProvider as unknown as Ethers5Provider
    ),
  })
}
