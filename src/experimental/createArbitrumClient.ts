import { Chain, PublicClient, createPublicClient, http } from 'viem'
import { arbitrumDepositActions, ArbitrumDepositActions } from './actions'

export type ArbitrumClients = {
  parentPublicClient: PublicClient
  childPublicClient: PublicClient & ArbitrumDepositActions
}

export type CreateArbitrumClientParams = {
  parentChain: Chain
  childChain: Chain
  parentRpcUrl?: string
  childRpcUrl?: string
}

export function createArbitrumClient({
  parentChain,
  childChain,
  parentRpcUrl,
  childRpcUrl,
}: CreateArbitrumClientParams): ArbitrumClients {
  const parentPublicClient = createPublicClient({
    chain: parentChain,
    transport: http(parentRpcUrl || parentChain.rpcUrls.default.http[0]),
  })

  const childPublicClient = createPublicClient({
    chain: childChain,
    transport: http(childRpcUrl || childChain.rpcUrls.default.http[0]),
  }).extend(arbitrumDepositActions())

  return {
    parentPublicClient,
    childPublicClient,
  }
}
