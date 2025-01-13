import {
  Chain,
  PublicClient,
  WalletClient,
  createPublicClient,
  http,
} from 'viem'
import {
  arbitrumChildWalletActions,
  arbitrumParentWalletActions,
} from './actions'

export type ArbitrumClients = {
  parentPublicClient: PublicClient
  childPublicClient: PublicClient
  parentWalletClient: WalletClient & typeof arbitrumParentWalletActions
  childWalletClient?: WalletClient & typeof arbitrumChildWalletActions
}

export type CreateArbitrumClientParams = {
  parentChain: Chain
  childChain: Chain
  parentRpcUrl?: string
  childRpcUrl?: string
  parentWalletClient: WalletClient
  childWalletClient?: WalletClient
}

export function createArbitrumClient({
  parentChain,
  childChain,
  parentRpcUrl,
  childRpcUrl,
  parentWalletClient,
  childWalletClient,
}: CreateArbitrumClientParams): ArbitrumClients {
  const parentPublicClient = createPublicClient({
    chain: parentChain,
    transport: http(parentRpcUrl || parentChain.rpcUrls.default.http[0]),
  })

  const childPublicClient = createPublicClient({
    chain: childChain,
    transport: http(childRpcUrl || childChain.rpcUrls.default.http[0]),
  })

  const extendedParentWalletClient = parentWalletClient.extend(
    arbitrumParentWalletActions(parentPublicClient, childPublicClient)
  )

  const extendedChildWalletClient = childWalletClient?.extend(
    arbitrumChildWalletActions(parentPublicClient, childPublicClient)
  )

  return {
    parentPublicClient,
    childPublicClient,
    parentWalletClient: extendedParentWalletClient,
    childWalletClient: extendedChildWalletClient,
  }
}
