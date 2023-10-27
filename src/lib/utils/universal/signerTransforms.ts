import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers'
import { WalletClient, createPublicClient, http } from 'viem'
import { Signerish } from '../../assetBridger/ethBridger'

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain?.id,
    name: chain?.name,
    ensAddress: chain?.contracts?.ensRegistry?.address,
  }
  //@ts-ignore
  const provider = new Web3Provider(transport, network)
  const signer = provider.getSigner(account?.address)
  return signer
}

export const transformEthersSignerToPublicClient = async (
  signer: JsonRpcSigner
) => {
  const url = signer.provider.connection.url
  if (typeof url === 'string') {
    const publicClient = createPublicClient({
      transport: http(url),
    })
    return publicClient
  }
  throw new Error('Invalid provider')
}

export function isWalletClient(object: any): object is WalletClient {
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

export const transformUniversalSignerToEthersV5Signer = async (
  signer: Signerish
): Promise<JsonRpcSigner> => {
  if (isWalletClient(signer)) {
    return walletClientToSigner(signer)
  }
  return signer as JsonRpcSigner
}
