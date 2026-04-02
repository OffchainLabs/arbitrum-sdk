/**
 * Ethers v5 adapter — converts ethers v5 Provider into ArbitrumProvider,
 * and ethers v5 TransactionReceipt / Log into core types.
 *
 * INTERNAL: Users never import this directly. The re-export modules
 * (eth.ts, erc20.ts, message.ts, etc.) use it under the hood.
 *
 * Key conversion: ethers v5 returns BigNumber for numeric fields.
 * ArbitrumProvider uses bigint for all amounts. We call .toBigInt()
 * on every BigNumber.
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
// Ethers v5 type shapes (we use structural typing — no import from ethers)
// ---------------------------------------------------------------------------

/** BigNumber-like: any object with a toBigInt() method */
interface BigNumberish {
  toBigInt(): bigint
}

/** Ethers v5 Provider (structural subset we use) */
export interface Ethers5Provider {
  getNetwork(): Promise<{ chainId: number }>
  getBlockNumber(): Promise<number>
  getBlock(blockTag: number | string): Promise<Ethers5Block | null>
  getTransactionReceipt(txHash: string): Promise<Ethers5Receipt | null>
  call(tx: { to: string; data: string }, blockTag?: number | string): Promise<string>
  estimateGas(tx: {
    to: string
    data: string
    from?: string
    value?: bigint | BigNumberish
  }): Promise<BigNumberish>
  getBalance(address: string, blockTag?: number | string): Promise<BigNumberish>
  getCode(address: string, blockTag?: number | string): Promise<string>
  getStorageAt(
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
  }): Promise<Ethers5Log[]>
  getFeeData(): Promise<{
    gasPrice: BigNumberish | null
    maxFeePerGas: BigNumberish | null
    maxPriorityFeePerGas: BigNumberish | null
  }>
}

export interface Ethers5Block {
  hash: string
  parentHash: string
  number: number
  timestamp: number
  nonce: string
  difficulty: BigNumberish
  gasLimit: BigNumberish
  gasUsed: BigNumberish
  miner: string
  baseFeePerGas: BigNumberish | null
  transactions: string[]
}

export interface Ethers5Receipt {
  to: string | null
  from: string
  contractAddress: string | null
  transactionIndex: number
  gasUsed: BigNumberish
  blockHash: string
  transactionHash: string
  logs: Ethers5Log[]
  blockNumber: number
  cumulativeGasUsed: BigNumberish
  effectiveGasPrice: BigNumberish
  status?: number
  type: number
}

export interface Ethers5Log {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  blockHash: string
  transactionHash: string
  transactionIndex: number
  logIndex: number
  removed: boolean
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toBigInt(value: BigNumberish | null): bigint | null {
  if (value === null || value === undefined) return null
  return value.toBigInt()
}

function toBlockTag(tag: BlockTag): number | string {
  return tag as number | string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an ethers v5 Log to an ArbitrumLog.
 */
export function fromEthersLog(log: Ethers5Log): ArbitrumLog {
  return {
    address: log.address,
    topics: [...log.topics],
    data: log.data,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    removed: log.removed,
  }
}

/**
 * Convert an ethers v5 TransactionReceipt to an ArbitrumTransactionReceipt.
 * BigNumber fields (gasUsed, cumulativeGasUsed, effectiveGasPrice) become bigint.
 */
export function fromEthersReceipt(
  receipt: Ethers5Receipt
): ArbitrumTransactionReceipt {
  return {
    to: receipt.to,
    from: receipt.from,
    contractAddress: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    status: receipt.status ?? 1,
    logs: receipt.logs.map(fromEthersLog),
    gasUsed: receipt.gasUsed.toBigInt(),
    cumulativeGasUsed: receipt.cumulativeGasUsed.toBigInt(),
    effectiveGasPrice: receipt.effectiveGasPrice.toBigInt(),
  }
}

/**
 * Wrap an ethers v5 Provider as an ArbitrumProvider.
 *
 * All BigNumber return values are converted to bigint.
 * Users never see ArbitrumProvider — the re-export modules call this internally.
 */
export function wrapProvider(provider: Ethers5Provider): ArbitrumProvider {
  return {
    async getChainId(): Promise<number> {
      const network = await provider.getNetwork()
      return network.chainId
    },

    async getBlockNumber(): Promise<number> {
      return provider.getBlockNumber()
    },

    async getBlock(blockTag: BlockTag): Promise<ArbitrumBlock | null> {
      const block = await provider.getBlock(toBlockTag(blockTag))
      if (!block) return null
      return {
        hash: block.hash,
        parentHash: block.parentHash,
        number: block.number,
        timestamp: block.timestamp,
        nonce: block.nonce,
        difficulty: block.difficulty.toBigInt(),
        gasLimit: block.gasLimit.toBigInt(),
        gasUsed: block.gasUsed.toBigInt(),
        miner: block.miner,
        baseFeePerGas: toBigInt(block.baseFeePerGas),
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
      const blockTag = request.blockTag
        ? toBlockTag(request.blockTag)
        : undefined
      return provider.call(
        { to: request.to, data: request.data },
        blockTag
      )
    },

    async estimateGas(request: {
      to: string
      data: string
      from?: string
      value?: bigint
    }): Promise<bigint> {
      const result = await provider.estimateGas({
        to: request.to,
        data: request.data,
        from: request.from,
        value: request.value,
      })
      return result.toBigInt()
    },

    async getBalance(address: string, blockTag?: BlockTag): Promise<bigint> {
      const bt = blockTag !== undefined ? toBlockTag(blockTag) : undefined
      const result = await provider.getBalance(address, bt)
      return result.toBigInt()
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
      return provider.getStorageAt(address, slot, bt)
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
        gasPrice: toBigInt(fd.gasPrice),
        maxFeePerGas: toBigInt(fd.maxFeePerGas),
        maxPriorityFeePerGas: toBigInt(fd.maxPriorityFeePerGas),
      }
    },
  }
}
