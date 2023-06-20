import EthersV5, {
  JsonRpcProvider,
  WebSocketProvider,
  FallbackProvider,
} from '@ethersproject/providers'
import { HttpTransport, PublicClient } from 'viem'
import EthersV6 from 'ethers-v6'
import Web3, { Web3BaseProvider } from 'web3'

export type Providerish =
  | PublicClient
  | EthersV5.JsonRpcProvider
  | EthersV6.JsonRpcProvider
  | Web3BaseProvider
  | Web3

export const getEthersV5Url = (provider: Providerish) => {
  if (isEthersV5JsonRpcProvider(provider)) {
    const url = provider.connection.url
    if (typeof url === 'string') {
      return url
    }
  }
  return undefined
}

export const getEthersV6Url = (provider: Providerish) => {
  if (isEthers6Provider(provider)) {
    const connection = provider._getConnection()
    const url = connection.url
    if (typeof url === 'string') {
      return url
    }
  }
  return undefined
}

export const getWeb3Url = (provider: Providerish) => {
  if (isHttpProvider(provider)) {
    // @ts-expect-error - private member
    if (provider.clientUrl) {
      // @ts-expect-error - private member
      return provider.clientUrl
      // @ts-expect-error - private member
    } else if (provider.currentProvider && provider.currentProvider.clientUrl) {
      // @ts-expect-error - private member
      return provider.currentProvider.clientUrl
      // @ts-expect-error - private member
    } else if (provider._socketPath) {
      // @ts-expect-error - private member
      return provider._socketPath
    }
  }
  return undefined
}

export function isEthersV5JsonRpcProvider(
  object: any
): object is EthersV5.JsonRpcProvider {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    'connection' in object &&
    typeof object.connection === 'object' &&
    'url' in object.connection &&
    typeof object.connection.url === 'string'
  )
}

export function isEthers6Provider(
  object: any
): object is EthersV6.JsonRpcProvider {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    '_getConnection' in object &&
    typeof object._getConnection === 'function'
  )
}

export function isHttpProvider(object: any): object is Web3BaseProvider {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    (('clientUrl' in object && typeof object.clientUrl === 'string') ||
      ('currentProvider' in object &&
        typeof object.currentProvider === 'object' &&
        'clientUrl' in object.currentProvider &&
        typeof object.currentProvider.clientUrl === 'string') ||
      ('_socketPath' in object && typeof object._socketPath === 'string'))
  )
}

export function publicClientToProvider(publicClient: PublicClient) {
  const { chain, transport } = publicClient
  if (!chain) throw new Error('Missing chain')
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain?.contracts?.ensRegistry?.address,
  }
  if (transport.type === 'fallback' && network)
    return new FallbackProvider(
      (transport.transports as ReturnType<HttpTransport>[]).map(
        ({ value }) => new JsonRpcProvider(value?.url, network)
      )
    )
  return new JsonRpcProvider(transport.url, network)
}

export function isPublicClient(object: any): object is PublicClient {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    'transport' in object &&
    object.transport !== null &&
    typeof object.transport === 'object' &&
    'url' in object.transport &&
    typeof object.transport.url === 'string'
  )
}

const providerGetters = [getEthersV5Url, getEthersV6Url, getWeb3Url]

export const getProviderUrl = (provider: Providerish) => {
  for (const getter of providerGetters) {
    const url = getter(provider)
    if (url) return url
  }
  return undefined
}

export const transformUniversalProviderToEthersV5Provider = async (
  provider: Providerish
) => {
  if (isPublicClient(provider)) {
    return publicClientToProvider(provider)
  }
  const url = getProviderUrl(provider)

  if (!url) {
    throw new Error('Unable to get URL from provider')
  }

  if (url.startsWith('ws')) {
    return new WebSocketProvider(url)
  }

  try {
    new URL(url)
  } catch (_) {
    throw new Error('Invalid URL received from provider')
  }

  return new JsonRpcProvider(url)
}
