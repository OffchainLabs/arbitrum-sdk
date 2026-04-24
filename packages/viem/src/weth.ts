/**
 * WETH detection with viem-native type signatures.
 */
import { isWethGateway as coreIsWethGateway } from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

export async function isWethGateway(
  gatewayAddress: string,
  parentProvider: ViemPublicClient
): Promise<boolean> {
  return coreIsWethGateway(gatewayAddress, wrapPublicClient(parentProvider))
}
