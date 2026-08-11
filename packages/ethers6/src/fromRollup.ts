/**
 * Network discovery from rollup contract for ethers v6 users.
 */
import {
  getArbitrumNetworkInformationFromRollup as coreGetArbitrumNetworkInformationFromRollup,
} from '@arbitrum/core'
import type { ArbitrumNetworkInformationFromRollup } from '@arbitrum/core'
import { wrapProvider, type Ethers6Provider } from './adapter'

export async function getArbitrumNetworkInformationFromRollup(
  rollupAddress: string,
  parentProvider: Ethers6Provider
): Promise<ArbitrumNetworkInformationFromRollup> {
  return coreGetArbitrumNetworkInformationFromRollup(
    rollupAddress,
    wrapProvider(parentProvider)
  )
}
