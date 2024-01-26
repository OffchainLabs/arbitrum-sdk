import {
  Log,
  TransactionReceipt,
  TransactionRequest,
  TransactionResponse,
} from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import {
  Log as ViemLog,
  createPublicClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { publicClientToProvider } from './providerTransforms'

import { BigNumber } from 'ethers'
import { Deferrable } from 'ethers/lib/utils'

export class ViemSigner extends Signer {
  private walletClient: WalletClient
  private publicClient: PublicClient
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

  async signMessage(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  async signTransaction(): Promise<any> {
    throw new Error('Method not implemented.')
  }

  connect(): any {
    throw new Error('Method not implemented.')
  }

  async sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse> {
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
      // @ts-expect-error - missing account value should be hoisted
      // https://viem.sh/docs/actions/wallet/prepareTransactionRequest.html#account-hoisting
      requestData
    )
    const hash = await this.walletClient.sendTransaction({
      ...request,
    })
    const serializedTransaction = await this.publicClient.getTransaction({
      hash,
    })
    const accessList = request.accessList ?? []
    const chainId = await this.publicClient.getChainId()
    const data = (await transaction.data?.toString()) as string
    const from = (await requestData.from) as string
    const gasLimit = BigNumber.from(transaction.gasLimit ?? 0)
    const gasPrice = BigNumber.from((await request.gasPrice) ?? 0)

    const { r, s, v: rawV } = serializedTransaction
    const v = parseInt(rawV.toString())
    const to = (await transaction.to) as string
    const type = getType((await transaction.type) ?? 2)
    const value = BigNumber.from(valueInBigInt ?? 0)
    const wait = async (): Promise<TransactionReceipt> => {
      const rec = await this.publicClient.waitForTransactionReceipt({
        hash,
      })

      return {
        ...rec,
        gasUsed: BigNumber.from(rec.gasUsed),
        blockNumber: Number(rec.blockNumber),
        cumulativeGasUsed: BigNumber.from(rec.cumulativeGasUsed),
        effectiveGasPrice: BigNumber.from(rec.effectiveGasPrice),
        type,
        status: 'success' === rec.status ? 1 : 0,
        confirmations: Number(confirmations),
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
    const confirmations = await this.publicClient.getTransactionConfirmations({
      hash,
    })

    const tx = {
      accessList,
      chainId,
      confirmations: Number(confirmations),
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

export const createViemSigner = (walletClient: WalletClient) => {
  if (isWalletClient(walletClient)) {
    return new ViemSigner(walletClient)
  }
  throw new Error('Invalid wallet client')
}

export function isWalletClient(object: any): object is WalletClient {
  return (
    object !== undefined &&
    object !== null &&
    typeof object === 'object' &&
    'transport' in object &&
    object.transport !== null &&
    typeof object.transport === 'object' &&
    object.type === 'walletClient'
  )
}

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
