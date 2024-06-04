import EthersV5, {
  JsonRpcProvider,
  StaticJsonRpcProvider,
  WebSocketProvider,
} from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import EthersV6 from 'ethers-v6'
import { PublicClient, createWalletClient, http } from 'viem'
import Web3, { Web3BaseProvider } from 'web3'
import { isWalletClient, createViemSigner } from './signerTransforms'

export type Providerish =
  | PublicClient
  | EthersV5.JsonRpcProvider
  | EthersV6.JsonRpcProvider
  | Web3BaseProvider
  | Web3
  | any

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
  const { transport, chain } = publicClient
  if (!transport) throw new Error('Missing transport')
  if (!chain) throw new Error('Missing chain')

  return new StaticJsonRpcProvider(transport.url, {
    name: chain.name,
    chainId: chain.id,
  })
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
    typeof object.transport.url === 'string' &&
    object.type === 'publicClient'
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

export const transformEthersProviderToWalletClient = async (
  provider: JsonRpcProvider
) => {
  const url = provider.connection.url
  if (typeof url === 'string') {
    const walletClient = createWalletClient({
      transport: http(url),
    })
    return walletClient
  }
  throw new Error('Invalid provider')
}

export function useViemSigner(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value

  descriptor.value = function (...args: any[]) {
    args = args.map(arg => {
      if (arg && typeof arg === 'object') {
        Object.keys(arg).forEach(key => {
          // Check if the property is a PublicClient instance
          if (isPublicClient(arg[key])) {
            arg[key] = publicClientToProvider(arg[key])
          }

          // Check if the property is a WalletClient instance
          if (isWalletClient(arg[key])) {
            arg[key] = createViemSigner(arg[key])
          }
          // Check and convert bigint to BigNumber
          if (typeof arg[key] === 'bigint') {
            arg[key] = BigNumber.from(arg[key].toString())
          }
        })
      }
      return arg
    })

    // Call the original method with the transformed arguments
    return originalMethod.apply(this, args)
  }

  return descriptor
}

export function applyUseViemSignerToAllMethods(constructor: any) {
  Object.getOwnPropertyNames(constructor.prototype).forEach(method => {
    if (
      typeof constructor.prototype[method] === 'function' &&
      method !== 'constructor'
    ) {
      const descriptor = Object.getOwnPropertyDescriptor(
        constructor.prototype,
        method
      )
      if (descriptor) {
        Object.defineProperty(
          constructor.prototype,
          method,
          useViemSigner(constructor.prototype, method, descriptor)
        )
      }
    }
  })
}
