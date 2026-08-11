/**
 * Network discovery from rollup contract with viem-native type signatures.
 */
import {
  getArbitrumNetworkInformationFromRollup as coreGetArbitrumNetworkInformationFromRollup,
} from '@arbitrum/core'
import type { ArbitrumNetworkInformationFromRollup } from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

export async function getArbitrumNetworkInformationFromRollup(
  rollupAddress: string,
  parentProvider: ViemPublicClient
): Promise<ArbitrumNetworkInformationFromRollup> {
  return coreGetArbitrumNetworkInformationFromRollup(
    rollupAddress,
    wrapPublicClient(parentProvider)
  )
}
