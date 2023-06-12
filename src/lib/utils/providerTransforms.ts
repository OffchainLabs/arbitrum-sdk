export type Providerish = {
  _getConnection?: () => { url?: unknown }
  currentProvider?: { clientUrl?: unknown }
  transport?: { url?: unknown }
  connection?: { url?: unknown }
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
