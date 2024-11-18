import { Chain, PublicClient, createPublicClient, http } from 'viem'
import { ArbitrumNetwork } from '../../lib/dataEntities/networks'
import { arbitrumDepositActions } from './actions'

export type ArbitrumChain = Chain & ArbitrumNetwork

export type ArbitrumClients = {
  parentChainPublicClient: PublicClient
  childChainPublicClient: PublicClient &
    ReturnType<typeof arbitrumDepositActions>
}
export type ChildChainPublicClient = PublicClient &
  ReturnType<typeof arbitrumDepositActions>

export type CreateArbitrumClientParams = {
  parentChain: Chain
  childChain: ArbitrumChain
  parentRpcUrl?: string
  childRpcUrl?: string
}

export function createArbitrumClient({
  parentChain,
  childChain,
  parentRpcUrl,
  childRpcUrl,
}: CreateArbitrumClientParams): ArbitrumClients {
  const parentChainPublicClient = createPublicClient({
    chain: parentChain,
    transport: http(parentRpcUrl || parentChain.rpcUrls.default.http[0]),
  })

  const childChainPublicClient = createPublicClient({
    chain: childChain,
    transport: http(childRpcUrl || childChain.rpcUrls.default.http[0]),
  }).extend(arbitrumDepositActions())

  return {
    parentChainPublicClient,
    childChainPublicClient,
  } as any as ArbitrumClients
}
