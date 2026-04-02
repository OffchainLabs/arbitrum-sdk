/**
 * Ethers v6 adapter — converts ethers v6 Provider into ArbitrumProvider,
 * and ethers v6 TransactionReceipt / Log into core types.
 *
 * INTERNAL: Users never import this directly. The re-export modules
 * (eth.ts, erc20.ts, message.ts, etc.) use it under the hood.
 *
 * Key differences from ethers v5 adapter:
 * - ethers v6 uses native bigint (no BigNumber → much simpler)
 * - provider.getNetwork() returns { chainId: bigint } (bigint, not number)
 * - TransactionReceipt.status is number | null
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

// ---------------------------------------------------------------------------
// Ethers v6 type shapes (structural typing — no import from ethers)
// ---------------------------------------------------------------------------

/** Ethers v6 Provider (structural subset we use) */
export interface Ethers6Provider {
  getNetwork(): Promise<{ chainId: bigint }>
  getBlockNumber(): Promise<number>
  getBlock(blockTag: number | string): Promise<Ethers6Block | null>
  getTransactionReceipt(txHash: string): Promise<Ethers6Receipt | null>
  call(tx: { to: string; data: string }): Promise<string>
  estimateGas(tx: {
    to: string
    data: string
    from?: string
    value?: bigint
  }): Promise<bigint>
  getBalance(address: string, blockTag?: number | string): Promise<bigint>
  getCode(address: string, blockTag?: number | string): Promise<string>
  getStorage(
    address: string,
    slot: string | number,
    blockTag?: number | string
  ): Promise<string>
  getTransactionCount(
    address: string,
    blockTag?: number | string
  ): Promise<number>
  getLogs(filter: {
    address?: string
    topics?: (string | string[] | null)[]
    fromBlock?: number | string
    toBlock?: number | string
  }): Promise<Ethers6Log[]>
  getFeeData(): Promise<{
    gasPrice: bigint | null
    maxFeePerGas: bigint | null
    maxPriorityFeePerGas: bigint | null
  }>
}

export interface Ethers6Block {
  hash: string | null
  parentHash: string
  number: number
  timestamp: number
  nonce: string
  difficulty: bigint
  gasLimit: bigint
  gasUsed: bigint
  miner: string
  baseFeePerGas: bigint | null
  transactions: string[]
}

export interface Ethers6Receipt {
  to: string | null
  from: string
  contractAddress: string | null
  index: number // ethers v6 uses 'index' instead of 'transactionIndex'
  gasUsed: bigint
  blockHash: string
  hash: string // ethers v6 uses 'hash' instead of 'transactionHash'
  logs: Ethers6Log[]
  blockNumber: number
  cumulativeGasUsed: bigint
  gasPrice: bigint // ethers v6 uses 'gasPrice' instead of 'effectiveGasPrice'
  status: number | null
  type: number
}

export interface Ethers6Log {
  address: string
  topics: readonly string[]
  data: string
  blockNumber: number
  blockHash: string
  transactionHash: string
  transactionIndex: number
  index: number // ethers v6 uses 'index' instead of 'logIndex'
  removed: boolean
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toBlockTag(tag: BlockTag): number | string {
  return tag as number | string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an ethers v6 Log to an ArbitrumLog.
 */
export function fromEthersLog(log: Ethers6Log): ArbitrumLog {
  return {
    address: log.address,
    topics: [...log.topics],
    data: log.data,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.index, // v6 uses 'index'
    removed: log.removed,
  }
}

/**
 * Convert an ethers v6 TransactionReceipt to an ArbitrumTransactionReceipt.
 * ethers v6 already uses native bigint, so no BigNumber conversion needed.
 */
export function fromEthersReceipt(
  receipt: Ethers6Receipt
): ArbitrumTransactionReceipt {
  return {
    to: receipt.to,
    from: receipt.from,
    contractAddress: receipt.contractAddress,
    transactionHash: receipt.hash, // v6 uses 'hash'
    transactionIndex: receipt.index, // v6 uses 'index'
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status ?? 1,
    logs: receipt.logs.map(fromEthersLog),
    gasUsed: receipt.gasUsed,
    cumulativeGasUsed: receipt.cumulativeGasUsed,
    effectiveGasPrice: receipt.gasPrice, // v6 uses 'gasPrice'
  }
}

/**
 * Wrap an ethers v6 Provider as an ArbitrumProvider.
 *
 * ethers v6 already returns bigint for most numeric fields, so the wrapping
 * is much simpler than ethers v5. The main conversion is:
 * - getNetwork() returns { chainId: bigint } → we convert to number
 * - getStorage() instead of getStorageAt()
 */
export function wrapProvider(provider: Ethers6Provider): ArbitrumProvider {
  return {
    async getChainId(): Promise<number> {
      const network = await provider.getNetwork()
      return Number(network.chainId)
    },

    async getBlockNumber(): Promise<number> {
      return provider.getBlockNumber()
    },

    async getBlock(blockTag: BlockTag): Promise<ArbitrumBlock | null> {
      const block = await provider.getBlock(toBlockTag(blockTag))
      if (!block) return null
      return {
        hash: block.hash ?? '',
        parentHash: block.parentHash,
        number: block.number,
        timestamp: block.timestamp,
        nonce: block.nonce,
        difficulty: block.difficulty,
        gasLimit: block.gasLimit,
        gasUsed: block.gasUsed,
        miner: block.miner,
        baseFeePerGas: block.baseFeePerGas,
        transactions: [...block.transactions],
      }
    },

    async getTransactionReceipt(
      txHash: string
    ): Promise<ArbitrumTransactionReceipt | null> {
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) return null
      return fromEthersReceipt(receipt)
    },

    async call(request: {
      to: string
      data: string
      blockTag?: BlockTag
    }): Promise<string> {
      const tx: Record<string, unknown> = { to: request.to, data: request.data }
      if (request.blockTag !== undefined) {
        tx.blockTag = request.blockTag
      }
      return provider.call(tx)
    },

    async estimateGas(request: {
      to: string
      data: string
      from?: string
      value?: bigint
    }): Promise<bigint> {
      return provider.estimateGas({
        to: request.to,
        data: request.data,
        from: request.from,
        value: request.value,
      })
    },

    async getBalance(address: string, blockTag?: BlockTag): Promise<bigint> {
      const bt = blockTag !== undefined ? toBlockTag(blockTag) : undefined
      return provider.getBalance(address, bt)
    },

    async getCode(address: string, blockTag?: BlockTag): Promise<string> {
      const bt = blockTag !== undefined ? toBlockTag(blockTag) : undefined
      return provider.getCode(address, bt)
    },

    async getStorageAt(
      address: string,
      slot: string,
      blockTag?: BlockTag
    ): Promise<string> {
      const bt = blockTag !== undefined ? toBlockTag(blockTag) : undefined
      // ethers v6 renames getStorageAt → getStorage
      return provider.getStorage(address, slot, bt)
    },

    async getTransactionCount(
      address: string,
      blockTag?: BlockTag
    ): Promise<number> {
      const bt = blockTag !== undefined ? toBlockTag(blockTag) : undefined
      return provider.getTransactionCount(address, bt)
    },

    async getLogs(filter: LogFilter): Promise<ArbitrumLog[]> {
      const ethersFilter: {
        address?: string
        topics?: (string | string[] | null)[]
        fromBlock?: number | string
        toBlock?: number | string
      } = {}
      if (filter.address) ethersFilter.address = filter.address
      if (filter.topics) ethersFilter.topics = filter.topics
      if (filter.fromBlock !== undefined)
        ethersFilter.fromBlock = toBlockTag(filter.fromBlock)
      if (filter.toBlock !== undefined)
        ethersFilter.toBlock = toBlockTag(filter.toBlock)

      const logs = await provider.getLogs(ethersFilter)
      return logs.map(fromEthersLog)
    },

    async getFeeData(): Promise<FeeData> {
      const fd = await provider.getFeeData()
      return {
        gasPrice: fd.gasPrice,
        maxFeePerGas: fd.maxFeePerGas,
        maxPriorityFeePerGas: fd.maxPriorityFeePerGas,
      }
    },
  }
}
