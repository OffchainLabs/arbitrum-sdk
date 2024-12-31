import {
  Chain,
  PublicClient,
  WalletClient,
  createPublicClient,
  http,
} from 'viem'
import {
  ArbitrumChildWalletActions,
  ArbitrumDepositActions,
  ArbitrumParentWalletActions,
  arbitrumChildWalletActions,
  arbitrumParentClientActions,
  arbitrumParentWalletActions,
} from './actions'

export type ArbitrumClients = {
  parentPublicClient: PublicClient
  childPublicClient: PublicClient & ArbitrumDepositActions
  parentWalletClient: WalletClient & ArbitrumParentWalletActions
  childWalletClient?: WalletClient & ArbitrumChildWalletActions
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
  }).extend(arbitrumParentClientActions())

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
