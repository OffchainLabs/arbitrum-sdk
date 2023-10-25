// import { WalletClient, getWalletClient } from '@wagmi/core'

import { WalletClient, createPublicClient, http } from 'viem'
import { Signerish } from '../../assetBridger/ethBridger'
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers'

import { Signer } from 'ethers'

class ViemSigner extends Signer {
  private walletClient: WalletClient

  constructor(walletClient: WalletClient) {
    super()
    this.walletClient = walletClient
  }

  async getAddress(): Promise<string> {
    const addresses = await this.walletClient.getAddresses()
    return addresses[0] // Assume the first address is the desired address
  }

  async signMessage(message: any): Promise<string> {
    return this.walletClient.signMessage(message)
  }

  async signTransaction(transaction: any): Promise<any> {
    return this.walletClient
  }

  connect(provider: any): any {
    return this.walletClient
  }

  async sendTransaction(transaction: any): Promise<any> {
    return this.walletClient.sendTransaction(transaction)
  }
}

export function walletClientToSigner(
  walletClient: WalletClient
): JsonRpcSigner {
  // console.log({ walletClient })
  // const { account, chain, transport } = walletClient
  // const network = {
  //   chainId: chain?.id,
  //   name: chain?.name,
  //   ensAddress: chain?.contracts?.ensRegistry?.address,
  // }
  // const provider = new JsonRpcProvider(transport.url)
  // const signer = provider.getSigner(account?.address)
  // return signer as JsonRpcSigner

  return new ViemSigner(walletClient) as any
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
