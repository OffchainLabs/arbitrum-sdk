import { EthBridger } from '../assetBridger/ethBridger'
import { getL2Network } from '../dataEntities/networks'
import { JsonRpcProvider, WebSocketProvider } from '@ethersproject/providers'

export type Providerish = {
  _getConnection?: () => { url?: unknown }
  currentProvider?: { clientUrl?: unknown }
  transport?: { url?: unknown }
  connection?: { url?: unknown }
  clientUrl?: unknown
  _socketPath?: unknown
}

export const getEthersV5Url = (provider: Providerish) => {
  if (typeof provider.connection === 'object') {
    const connection = provider.connection
    const url = connection.url
    if (typeof url === 'string') {
      return url
    }
  }
  return undefined
}

export const getEthersV6Url = (provider: Providerish) => {
  if (typeof provider._getConnection === 'function') {
    const connection = provider._getConnection()
    const url = connection.url
    if (typeof url === 'string') {
      return url
    }
  }
  return undefined
}

export const getWeb3Url = (provider: Providerish) => {
  if ('clientUrl' in provider && typeof provider.clientUrl === 'string') {
    const url = provider.clientUrl
    return url
  }
  if (
    'currentProvider' in provider &&
    typeof provider.currentProvider === 'object' &&
    'clientUrl' in provider?.currentProvider &&
    typeof provider.currentProvider.clientUrl === 'string'
  ) {
    const url = provider.currentProvider.clientUrl
    if (typeof url === 'string') {
      return url
    }
  }
  if ('_socketPath' in provider && typeof provider._socketPath === 'string') {
    const url = provider._socketPath
    return url
  }

  return undefined
}

export const getViemUrl = (publicClient: Providerish) => {
  if (publicClient?.transport && 'url' in publicClient.transport) {
    const url = publicClient.transport.url
    if (typeof url === 'string') {
      return url
    }
  }
  return undefined
}

const providerGetters = [getEthersV5Url, getEthersV6Url, getWeb3Url, getViemUrl]

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
