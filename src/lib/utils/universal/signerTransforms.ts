import {
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt,
  Log,
} from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import {
  JsonRpcSigner,
  StaticJsonRpcProvider,
  Web3Provider,
} from '@ethersproject/providers'
import {
  PublicClient,
  type WalletClient,
  createPublicClient,
  hexToSignature,
  http,
  Log as ViemLog,
} from 'viem'
import { Signerish } from '../../assetBridger/ethBridger'
import { publicClientToProvider } from './providerTransforms'

import { Deferrable } from 'ethers/lib/utils'
import { BigNumber, Wallet } from 'ethers'

const getType = (value: number | string | null) => {
  switch (value) {
    case 0:
    case 'legacy':
      return 0
    case 1:
    case 'berlin':
    case 'eip-2930':
      return 1
    case 2:
    case 'london':
    case 'eip-1559':
    case 'eip1559':
      return 2
  }
  return 2
}

const convertViemLogToEthersLog = (log: ViemLog): Log => {
  return {
    address: log.address,
    blockHash: log.blockHash as string,
    blockNumber: Number(log.blockNumber),
    data: log.data,
    logIndex: Number(log.logIndex),
    removed: log.removed,
    topics: log.topics,
    transactionHash: log.transactionHash as string,
    transactionIndex: Number(log.transactionIndex),
  }
}

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

  async sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse> {
    // const gasEstimate = await this.publicClient.estimateGas({
    //   ...(this.walletClient as any),
    //   ...transaction,
    // })
    const { maxFeePerGas, maxPriorityFeePerGas } =
      await this.publicClient.estimateFeesPerGas()
    const valueInBigInt = BigInt(transaction?.value?.toString() || 0)
    const nonce = await this.publicClient.getTransactionCount({
      address: (await this.getAddress()) as `0x${string}`,
    })
    const requestData = {
      ...transaction,
      value: valueInBigInt,
      to: transaction.to as `0x${string}`,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas,
      from: (await this.getAddress()) as `0x${string}`,
      chain: this.walletClient.chain,
      data: transaction.data as `0x${string}`,
    }
    const request = await this.walletClient.prepareTransactionRequest(
      requestData
    )
    const serializedTransaction = await this.walletClient.signTransaction(
      request
    )
    const hash = await this.publicClient.sendRawTransaction({
      serializedTransaction,
    })

    const accessList = request.accessList ?? []
    const chainId = await this.publicClient.getChainId()
    const confirmations = 8
    const data = (await transaction.data?.toString()) as string
    const from = (await requestData.from) as string
    const gasLimit = BigNumber.from(transaction.gasLimit ?? 0)
    const gasPrice = BigNumber.from((await request.gasPrice) ?? 0)

    const { r, s, v: rawV } = hexToSignature(serializedTransaction)
    const v = parseInt(rawV.toString())
    const to = (await transaction.to) as string
    const type = getType((await transaction.type) ?? 2)
    const value = BigNumber.from(valueInBigInt ?? 0)
    const wait = async (): Promise<TransactionReceipt> => {
      const rec = await this.publicClient.waitForTransactionReceipt({ hash })
      return {
        ...rec,
        gasUsed: BigNumber.from(rec.gasUsed),
        blockNumber: Number(rec.blockNumber),
        cumulativeGasUsed: BigNumber.from(rec.cumulativeGasUsed),
        effectiveGasPrice: BigNumber.from(rec.effectiveGasPrice),
        type,
        status: 'success' === rec.status ? 1 : 0,
        confirmations,
        byzantium: false,
        to: (rec.to as string) ?? '',
        contractAddress: (rec.contractAddress as string) ?? '',
        logs: rec.logs.map(convertViemLogToEthersLog),
        logsBloom: rec.logsBloom ?? '',
        transactionHash: rec.transactionHash ?? '',
      }
    }
    const blockNumber = ((await this.publicClient.getBlockNumber()) ??
      null) as any

    const tx = {
      accessList,
      chainId,
      confirmations,
      data,
      from,
      gasLimit,
      gasPrice,
      hash,
      maxFeePerGas: BigNumber.from(maxFeePerGas),
      maxPriorityFeePerGas: BigNumber.from(maxPriorityFeePerGas),
      nonce,
      r,
      s,
      v,
      to,
      type,
      value,
      wait,
      blockNumber,
    }
    return tx
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
