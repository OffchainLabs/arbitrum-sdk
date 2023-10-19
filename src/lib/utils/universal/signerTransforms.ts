import { type WalletClient, getWalletClient } from '@wagmi/core'
import { providers } from 'ethers'
import { createPublicClient, http } from 'viem'

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(transport, network)
  const signer = provider.getSigner(account.address)
  return signer
}

/** Action to convert a viem Wallet Client to an ethers.js Signer. */
export async function getEthersSigner({ chainId }: { chainId?: number } = {}) {
  const walletClient = await getWalletClient({ chainId })
  if (!walletClient) return undefined
  return walletClientToSigner(walletClient)
}

export const transformEthersSignerToPublicClient = async (
  signer: providers.JsonRpcSigner
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
