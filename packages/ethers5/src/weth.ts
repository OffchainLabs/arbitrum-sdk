/**
 * WETH detection for ethers v5 users.
 */
import type { providers } from 'ethers'
import { isWethGateway as coreIsWethGateway } from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

export async function isWethGateway(
  gatewayAddress: string,
  parentProvider: providers.Provider
): Promise<boolean> {
  return coreIsWethGateway(
    gatewayAddress,
    wrapProvider(parentProvider as unknown as Ethers5Provider)
  )
}
