import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Chain, Client, PublicClient, Transport } from 'viem'

// based on https://wagmi.sh/react/ethers-adapters#reference-implementation
export function publicClientToProvider<TChain extends Chain | undefined>(
  publicClient: PublicClient<Transport, TChain>
) {
  const { chain } = publicClient

  if (typeof chain === 'undefined') {
    throw new Error(`[publicClientToProvider] "chain" is undefined`)
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }

  return new StaticJsonRpcProvider(chain.rpcUrls.default.http[0], network)
}

function isPublicClient(object: any): object is PublicClient {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    'transport' in object &&
    object.transport !== null &&
    typeof object.transport === 'object' &&
    'url' in object.transport &&
    typeof object.transport.url === 'string' &&
    object.type === 'publicClient'
  )
}

export const transformPublicClientToProvider = (
  provider: PublicClient | Client
): StaticJsonRpcProvider => {
  if (isPublicClient(provider)) {
    return publicClientToProvider(provider)
  }
  throw new Error('Invalid provider')
}
