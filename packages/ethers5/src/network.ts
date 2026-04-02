/**
 * Network functions for ethers v5 users.
 *
 * Re-exports core network functions and adds a convenience function
 * to look up an ArbitrumNetwork from an ethers v5 Provider.
 */
import type { providers } from 'ethers'
import {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
  getNitroGenesisBlock,
  getMulticallAddress,
  mapL2NetworkTokenBridgeToTokenBridge,
  mapL2NetworkToArbitrumNetwork,
  type ArbitrumNetwork,
} from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

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
  getNitroGenesisBlock,
  getMulticallAddress,
  mapL2NetworkTokenBridgeToTokenBridge,
  mapL2NetworkToArbitrumNetwork,
}

export type { ArbitrumNetwork, EthBridge, TokenBridge, Teleporter } from '@arbitrum/core'

/**
 * Look up an ArbitrumNetwork by querying the provider for its chain ID.
 *
 * Convenience function so users don't have to manually call
 * `provider.getNetwork()` and then `getArbitrumNetwork(chainId)`.
 */
export async function getArbitrumNetworkFromProvider(
  provider: providers.Provider
): Promise<ArbitrumNetwork> {
  const wrapped = wrapProvider(provider as unknown as Ethers5Provider)
  const chainId = await wrapped.getChainId()
  return getArbitrumNetwork(chainId)
}
