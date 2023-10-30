import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers'
import { Signer } from '@ethersproject/abstract-signer'
import {
  PublicClient,
  TransactionRequest,
  WalletClient,
  createPublicClient,
  http,
} from 'viem'
import { Signerish } from '../../assetBridger/ethBridger'
import { signMessage } from 'viem/dist/types/actions/wallet/signMessage'
import { BlockTag, TransactionResponse } from 'ethers-v6'
import { Deferrable } from 'ethers/lib/utils'

class ViemSigner extends Signer {
  private walletClient: WalletClient
  private publicClient: PublicClient
  private _index: number
  private _address: string
  _legacySignMessage() {
    throw new Error('Method not implemented.')
  }
  _signTypedData() {
    throw new Error('Method not implemented.')
  }
  unlock() {
    throw new Error('Method not implemented.')
  }

  constructor(walletClient: WalletClient) {
    super()
    this.publicClient = createPublicClient({
      chain: walletClient.chain,
      transport: http(walletClient.transport.url),
    })
    this.walletClient = walletClient
    this._index = 0
    this._address = walletClient.account?.address ?? ''
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

  async sendTransaction(transaction: Deferrable<TransactionRequest>) {
    const gasEstimate = await this.publicClient.estimateGas({
      ...(this.walletClient as any),
      ...transaction,
    })
    const hash = await this.walletClient.sendTransaction(transaction as any)
    const blockNumber = ((await this.publicClient.getBlockNumber()) ??
      null) as any
    const transactionReceipt = await this.publicClient.getTransactionReceipt({
      hash,
    })
    const confirmations = (await this.publicClient.getTransactionConfirmations({
      transactionReceipt,
    })) as any
    const nonce = await this.publicClient.getTransactionCount({
      address: (await this.getAddress()) as `0x${string}`,
    })

    return {
      hash,
      // blockNumber: blockNumber ? blockNumber : null,
      wait: async () => {
        return this.publicClient.waitForTransactionReceipt({ hash })
      },
      ...transactionReceipt,
      confirmations,
      nonce,
      ...transaction,
      blockNumber,
      gasLimit: gasEstimate,
      chainId: this.publicClient.getChainId(),
      // data,
      // value,
      // chainId,
    } as any
  }

  connectUnchecked(): Signer {
    return this
  }
  sendUncheckedTransaction(): Promise<string> {
    throw new Error('Method not implemented.')
  }
}

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient
  // @ts-expect-error - private key
  if (account?.source === 'privateKey') {
    return new ViemSigner(walletClient)
  }
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
): Promise<Signer> => {
  if (isWalletClient(signer)) {
    return walletClientToSigner(signer)
  }
  return signer as JsonRpcSigner
}
