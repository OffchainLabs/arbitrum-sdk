/**
 * Network functions with viem-native type signatures.
 *
 * Most network functions don't need a provider, so they are re-exported directly.
 * getArbitrumNetworkFromProvider is a viem-specific convenience function.
 */
import {
  getArbitrumNetwork as coreGetArbitrumNetwork,
  getArbitrumNetworks as coreGetArbitrumNetworks,
  getChildrenForNetwork as coreGetChildrenForNetwork,
  isParentNetwork as coreIsParentNetwork,
  registerCustomArbitrumNetwork as coreRegisterCustomArbitrumNetwork,
  resetNetworksToDefault as coreResetNetworksToDefault,
} from '@arbitrum/core'
import type { ArbitrumNetwork } from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

/**
 * Get an ArbitrumNetwork by chain ID.
 */
export function getArbitrumNetwork(chainId: number): ArbitrumNetwork {
  return coreGetArbitrumNetwork(chainId)
}

/**
 * Get all registered ArbitrumNetworks.
 */
export function getArbitrumNetworks(): ArbitrumNetwork[] {
  return coreGetArbitrumNetworks()
}

/**
 * Get children (L2/L3) for a given parent chain ID.
 */
export function getChildrenForNetwork(
  parentChainId: number
): ArbitrumNetwork[] {
  return coreGetChildrenForNetwork(parentChainId)
}

/**
 * Check if a chain ID is a parent chain for any registered Arbitrum network.
 */
export function isParentNetwork(chainId: number): boolean {
  return coreIsParentNetwork(chainId)
}

/**
 * Register a custom Arbitrum network.
 */
export function registerCustomArbitrumNetwork(
  network: ArbitrumNetwork
): ArbitrumNetwork {
  return coreRegisterCustomArbitrumNetwork(network)
}

/**
 * Reset networks to default (remove custom registrations).
 */
export function resetNetworksToDefault(): void {
  coreResetNetworksToDefault()
}

/**
 * Viem-specific convenience: resolve an ArbitrumNetwork from a viem PublicClient
 * by querying its chain ID.
 */
export async function getArbitrumNetworkFromProvider(
  client: ViemPublicClient
): Promise<ArbitrumNetwork> {
  const provider = wrapPublicClient(client)
  const chainId = await provider.getChainId()
  return coreGetArbitrumNetwork(chainId)
}

export type { ArbitrumNetwork }
