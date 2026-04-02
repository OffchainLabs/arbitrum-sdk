/**
 * Viem adapter — converts viem PublicClient to ArbitrumProvider.
 *
 * INTERNAL: Users of @arbitrum/viem never import this directly.
 * The wrapper functions in eth.ts, erc20.ts, etc. call wrapPublicClient
 * internally before delegating to core functions.
 */
import type {
  ArbitrumProvider,
  ArbitrumBlock,
  ArbitrumTransactionReceipt,
  ArbitrumLog,
  FeeData,
  BlockTag,
  LogFilter,
} from '@arbitrum/core'

/**
 * Minimal viem PublicClient shape — only the methods we actually use.
 * This avoids importing viem in the runtime, keeping it as a peer dep.
 */
export interface ViemPublicClient {
  getChainId(): Promise<number>
  getBlockNumber(): Promise<bigint>
  getBlock(params: {
    blockNumber?: bigint
    blockTag?: string
    blockHash?: string
  }): Promise<ViemBlock | null>
  getTransactionReceipt(params: {
    hash: string
  }): Promise<ViemTransactionReceipt>
  getLogs(params: {
    address?: string
    topics?: (string | string[] | null)[]
    fromBlock?: bigint | string
    toBlock?: bigint | string
  }): Promise<ViemLog[]>
  call(params: {
    to?: string
    data?: string
    blockNumber?: bigint
    blockTag?: string
    account?: string
    value?: bigint
  }): Promise<{ data?: string }>
  estimateGas(params: {
    to?: string
    data?: string
    account?: string
    value?: bigint
  }): Promise<bigint>
  getCode(params: { address: string }): Promise<string | undefined>
  getBalance(params: {
    address: string
    blockNumber?: bigint
    blockTag?: string
  }): Promise<bigint>
  getGasPrice(): Promise<bigint>
  estimateFeesPerGas(): Promise<{
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
  }>
  getStorageAt(params: {
    address: string
    slot: string
  }): Promise<string | undefined>
  getTransactionCount(params: { address: string }): Promise<number>
}

/** Minimal viem Block shape. */
interface ViemBlock {
  hash: string | null
  parentHash: string
  number: bigint | null
  timestamp: bigint
  nonce: string | null
  difficulty: bigint
  gasLimit: bigint
  gasUsed: bigint
  miner: string
  baseFeePerGas: bigint | null
  transactions: string[]
}

/** Minimal viem TransactionReceipt shape. */
interface ViemTransactionReceipt {
  to: string | null
  from: string
  contractAddress: string | null
  transactionHash: string
  transactionIndex: number
  blockHash: string
  blockNumber: bigint
  status: 'success' | 'reverted'
  logs: ViemLog[]
  gasUsed: bigint
  effectiveGasPrice: bigint
  cumulativeGasUsed: bigint
}

/** Minimal viem Log shape. */
interface ViemLog {
  address: string
  topics: string[]
  data: string
  blockNumber: bigint
  blockHash: string
  transactionHash: string
  transactionIndex: number
  logIndex: number
  removed: boolean
}

/**
 * Convert a BlockTag (number | string) to viem's block parameter shape.
 */
function blockTagToViemParam(
  blockTag: BlockTag
): { blockNumber: bigint } | { blockTag: string } {
  if (typeof blockTag === 'number') {
    return { blockNumber: BigInt(blockTag) }
  }
  return { blockTag: blockTag }
}

/**
 * Convert a viem Log to ArbitrumLog.
 */
export function fromViemLog(log: ViemLog): ArbitrumLog {
  return {
    address: log.address,
    topics: log.topics as string[],
    data: log.data,
    blockNumber: Number(log.blockNumber),
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    removed: log.removed,
  }
}

/**
 * Convert a viem TransactionReceipt to ArbitrumTransactionReceipt.
 */
export function fromViemReceipt(
  receipt: ViemTransactionReceipt
): ArbitrumTransactionReceipt {
  return {
    to: receipt.to,
    from: receipt.from,
    contractAddress: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: Number(receipt.blockNumber),
    status: receipt.status === 'success' ? 1 : 0,
    logs: receipt.logs.map(fromViemLog),
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    cumulativeGasUsed: receipt.cumulativeGasUsed,
  }
}

/**
 * Convert a viem Block to ArbitrumBlock.
 */
function fromViemBlock(block: ViemBlock): ArbitrumBlock {
  return {
    hash: block.hash ?? '',
    parentHash: block.parentHash,
    number: Number(block.number ?? 0),
    timestamp: Number(block.timestamp),
    nonce: block.nonce ?? '0x0000000000000000',
    difficulty: block.difficulty,
    gasLimit: block.gasLimit,
    gasUsed: block.gasUsed,
    miner: block.miner,
    baseFeePerGas: block.baseFeePerGas,
    transactions: block.transactions,
  }
}

/**
 * Wrap a viem PublicClient as an ArbitrumProvider.
 *
 * This is the bridge between viem and @arbitrum/core. All 12 ArbitrumProvider
 * methods delegate to the corresponding viem PublicClient method, converting
 * types as needed (bigint block numbers -> number, status strings -> numbers, etc).
 */
export function wrapPublicClient(client: ViemPublicClient): ArbitrumProvider {
  return {
    async getChainId(): Promise<number> {
      return client.getChainId()
    },

    async getBlockNumber(): Promise<number> {
      const blockNumber = await client.getBlockNumber()
      return Number(blockNumber)
    },

    async getBlock(blockTag: BlockTag): Promise<ArbitrumBlock | null> {
      const params = blockTagToViemParam(blockTag)
      const block = await client.getBlock(params)
      if (!block) return null
      return fromViemBlock(block)
    },

    async getTransactionReceipt(
      txHash: string
    ): Promise<ArbitrumTransactionReceipt | null> {
      try {
        const receipt = await client.getTransactionReceipt({ hash: txHash })
        return fromViemReceipt(receipt)
      } catch {
        // viem throws when receipt is not found
        return null
      }
    },

    async call(request: {
      to: string
      data: string
      blockTag?: BlockTag
    }): Promise<string> {
      const params: {
        to: string
        data: string
        blockNumber?: bigint
        blockTag?: string
      } = {
        to: request.to,
        data: request.data,
      }
      if (request.blockTag !== undefined) {
        const viemBlockParam = blockTagToViemParam(request.blockTag)
        Object.assign(params, viemBlockParam)
      }
      const result = await client.call(params)
      return result.data ?? '0x'
    },

    async estimateGas(request: {
      to: string
      data: string
      from?: string
      value?: bigint
    }): Promise<bigint> {
      return client.estimateGas({
        to: request.to,
        data: request.data,
        account: request.from,
        value: request.value,
      })
    },

    async getBalance(address: string, blockTag?: BlockTag): Promise<bigint> {
      const params: {
        address: string
        blockNumber?: bigint
        blockTag?: string
      } = { address }
      if (blockTag !== undefined) {
        const viemBlockParam = blockTagToViemParam(blockTag)
        Object.assign(params, viemBlockParam)
      }
      return client.getBalance(params)
    },

    async getCode(address: string, _blockTag?: BlockTag): Promise<string> {
      const code = await client.getCode({ address })
      return code ?? '0x'
    },

    async getStorageAt(
      address: string,
      slot: string,
      _blockTag?: BlockTag
    ): Promise<string> {
      const value = await client.getStorageAt({ address, slot })
      return value ?? '0x'
    },

    async getTransactionCount(
      address: string,
      _blockTag?: BlockTag
    ): Promise<number> {
      return client.getTransactionCount({ address })
    },

    async getLogs(filter: LogFilter): Promise<ArbitrumLog[]> {
      const params: {
        address?: string
        topics?: (string | string[] | null)[]
        fromBlock?: bigint | string
        toBlock?: bigint | string
      } = {}

      if (filter.address) params.address = filter.address
      if (filter.topics) params.topics = filter.topics

      if (filter.fromBlock !== undefined) {
        params.fromBlock =
          typeof filter.fromBlock === 'number'
            ? BigInt(filter.fromBlock)
            : filter.fromBlock
      }
      if (filter.toBlock !== undefined) {
        params.toBlock =
          typeof filter.toBlock === 'number'
            ? BigInt(filter.toBlock)
            : filter.toBlock
      }

      const logs = await client.getLogs(params)
      return logs.map(fromViemLog)
    },

    async getFeeData(): Promise<FeeData> {
      let maxFeePerGas: bigint | null = null
      let maxPriorityFeePerGas: bigint | null = null

      try {
        const fees = await client.estimateFeesPerGas()
        maxFeePerGas = fees.maxFeePerGas ?? null
        maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? null
      } catch {
        // Chain doesn't support EIP-1559
      }

      const gasPrice = await client.getGasPrice()

      return {
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
      }
    },
  }
}
