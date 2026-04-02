/**
 * Network functions for ethers v6 users.
 *
 * Re-exports core network functions and adds a convenience function
 * to look up an ArbitrumNetwork from an ethers v6 Provider.
 */
import {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
  type ArbitrumNetwork,
} from '@arbitrum/core'
import { wrapProvider, type Ethers6Provider } from './adapter'

// Direct re-exports
export {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
}

export type { ArbitrumNetwork, EthBridge, TokenBridge, Teleporter } from '@arbitrum/core'

/**
 * Look up an ArbitrumNetwork by querying the provider for its chain ID.
 *
 * Convenience function so users don't have to manually call
 * `provider.getNetwork()` and then `getArbitrumNetwork(chainId)`.
 */
export async function getArbitrumNetworkFromProvider(
  provider: Ethers6Provider
): Promise<ArbitrumNetwork> {
  const wrapped = wrapProvider(provider)
  const chainId = await wrapped.getChainId()
  return getArbitrumNetwork(chainId)
}
