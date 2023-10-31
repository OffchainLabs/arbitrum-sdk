import { Signer } from '@ethersproject/abstract-signer'
import {
  JsonRpcSigner,
  StaticJsonRpcProvider,
  Web3Provider,
} from '@ethersproject/providers'
import { WalletClient, createPublicClient, hexToSignature, http } from 'viem'
import { Signerish } from '../../assetBridger/ethBridger'
import { publicClientToProvider } from './providerTransforms'

class ViemSigner extends Signer {
  private walletClient: any
  private publicClient: any
  private _index: number
  private _address: string
  public provider: StaticJsonRpcProvider

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
    this.provider = publicClientToProvider(this.publicClient)
  }

  async getAddress(): Promise<string> {
    const account = await this.walletClient.account
    return account?.address as string
  }

  async signMessage(message: any): Promise<string> {
    // return this.walletClient.signMessage(message)
    throw new Error('Method not implemented.')
  }

  async signTransaction(transaction: any): Promise<any> {
    return this.walletClient
  }

  connect(provider: any): any {
    return this.walletClient
  }

  async sendTransaction(transaction: any) {
    const gasEstimate = await this.publicClient.estimateGas({
      ...(this.walletClient as any),
      ...transaction,
    })

    const request = await this.walletClient.prepareTransactionRequest({
      ...(transaction as any),
      ...this.walletClient,
    })
    const serializedTransaction = await this.walletClient.signTransaction(
      request
    )
    const hash = await this.walletClient.sendRawTransaction({
      serializedTransaction,
    })
    const blockNumber = ((await this.publicClient.getBlockNumber()) ??
      null) as any
    const transactionReceipt =
      await this.publicClient.waitForTransactionReceipt({
        hash,
      })
    const confirmations = parseInt(
      (
        await this.publicClient.getTransactionConfirmations({
          transactionReceipt,
        })
      ).toString()
    )
    const nonce = await this.publicClient.getTransactionCount({
      address: (await this.getAddress()) as `0x${string}`,
    })
    const { r, s, v } = hexToSignature(serializedTransaction)

    return {
      accessList: transaction.accessList,
      chainId: await this.publicClient.getChainId(),
      confirmations,
      data: transaction.data,
      from: transaction.from,
      gasLimit: gasEstimate,
      gasPrice: transaction.gasPrice,
      hash,
      maxFeePerGas: transactionReceipt.maxFeePerGas,
      maxPriorityFeePerGas: transactionReceipt.maxPriorityFeePerGas,
      nonce,
      r,
      s,
      v,
      to: transaction.to,
      type: transaction.type,
      value: transaction.value,
      // blockNumber: blockNumber ? blockNumber : null,
      wait: async () => {
        return this.publicClient.waitForTransactionReceipt({ hash })
      },
      blockNumber,
      //@ts-ignore
      status: transactionReceipt.success === 'success' ? 1 : 0,
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
