/**
 * WETH detection for ethers v6 users.
 */
import { isWethGateway as coreIsWethGateway } from '@arbitrum/core'
import { wrapProvider, type Ethers6Provider } from './adapter'

export async function isWethGateway(
  gatewayAddress: string,
  parentProvider: Ethers6Provider
): Promise<boolean> {
  return coreIsWethGateway(gatewayAddress, wrapProvider(parentProvider))
}
