/**
 * Network discovery from rollup contract for ethers v5 users.
 */
import type { providers } from 'ethers'
import {
  getArbitrumNetworkInformationFromRollup as coreGetArbitrumNetworkInformationFromRollup,
} from '@arbitrum/core'
import type { ArbitrumNetworkInformationFromRollup } from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

export async function getArbitrumNetworkInformationFromRollup(
  rollupAddress: string,
  parentProvider: providers.Provider
): Promise<ArbitrumNetworkInformationFromRollup> {
  return coreGetArbitrumNetworkInformationFromRollup(
    rollupAddress,
    wrapProvider(parentProvider as unknown as Ethers5Provider)
  )
}
