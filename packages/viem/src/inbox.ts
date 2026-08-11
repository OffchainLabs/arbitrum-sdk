/**
 * Inbox / force inclusion functions with viem-native type signatures.
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
import { wrapPublicClient, type ViemPublicClient } from './adapter'

export async function getForceIncludableEvent(params: {
  parentProvider: ViemPublicClient
  network: ArbitrumNetwork
  maxSearchRangeBlocks?: number
  startSearchRangeBlocks?: number
  rangeMultiplier?: number
}): Promise<ForceInclusionParams | null> {
  return coreGetForceIncludableEvent({
    ...params,
    parentProvider: wrapPublicClient(params.parentProvider),
  })
}

export async function getForceIncludeRequest(params: {
  parentProvider: ViemPublicClient
  network: ArbitrumNetwork
  event?: ForceInclusionParams
  from: string
}): Promise<TransactionRequestData | null> {
  return coreGetForceIncludeRequest({
    ...params,
    parentProvider: wrapPublicClient(params.parentProvider),
  })
}
