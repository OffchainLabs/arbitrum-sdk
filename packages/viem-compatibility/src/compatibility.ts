import {
  Log as EthersLog,
  TransactionReceipt as EthersTransactionReceipt,
} from '@ethersproject/abstract-provider'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import {
  Chain,
  Client,
  PublicClient,
  Transport,
  Log as ViemLog,
  TransactionReceipt as ViemTransactionReceipt,
} from 'viem'

// based on https://wagmi.sh/react/ethers-adapters#reference-implementation
export function publicClientToProvider<TChain extends Chain | undefined>(
  publicClient: PublicClient<Transport, TChain>
) {
  const { chain } = publicClient

  if (typeof chain === 'undefined') {
    throw new Error(`[publicClientToProvider] "chain" is undefined`)
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }

  return new StaticJsonRpcProvider(chain.rpcUrls.default.http[0], network)
}

function isPublicClient(object: any): object is PublicClient {
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

export const transformPublicClientToProvider = (
  provider: PublicClient | Client
): StaticJsonRpcProvider => {
  if (isPublicClient(provider)) {
    return publicClientToProvider(provider)
  }
  throw new Error('Invalid provider')
}

function viemLogToEthersLog(log: ViemLog): EthersLog {
  return {
    blockNumber: Number(log.blockNumber),
    blockHash: log.blockHash!,
    transactionIndex: log.transactionIndex!,
    removed: log.removed,
    address: log.address,
    data: log.data,
    topics: log.topics,
    transactionHash: log.transactionHash!,
    logIndex: log.logIndex!,
  }
}

export function viemTransactionReceiptToEthersTransactionReceipt(
  receipt: ViemTransactionReceipt
): EthersTransactionReceipt {
  return {
    to: receipt.to!,
    from: receipt.from!,
    contractAddress: receipt.contractAddress!,
    transactionIndex: receipt.transactionIndex,
    gasUsed: BigNumber.from(receipt.gasUsed),
    logsBloom: receipt.logsBloom,
    blockHash: receipt.blockHash,
    transactionHash: receipt.transactionHash,
    logs: receipt.logs.map(log => viemLogToEthersLog(log)),
    blockNumber: Number(receipt.blockNumber),
    // todo: if we need this we can add it later
    confirmations: -1,
    cumulativeGasUsed: BigNumber.from(receipt.cumulativeGasUsed),
    effectiveGasPrice: BigNumber.from(receipt.effectiveGasPrice),
    // all transactions that we care about are well past byzantium
    byzantium: true,
    type: Number(receipt.type),
    status: receipt.status === 'success' ? 1 : 0,
  }
}
