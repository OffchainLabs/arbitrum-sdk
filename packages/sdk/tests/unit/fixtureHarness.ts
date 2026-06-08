import { BigNumber, ethers, providers } from 'ethers'
import { ArbSys__factory } from '../../src/lib/abi/factories/ArbSys__factory'
import { NodeInterface__factory } from '../../src/lib/abi/factories/NodeInterface__factory'
import {
  ARB_SYS_ADDRESS,
  NODE_INTERFACE_ADDRESS,
} from '../../src/lib/dataEntities/constants'
import fs from 'fs'
import path from 'path'

type HexKeyed<T> = Record<string, T>

export interface ReverseTracingReplayFixture {
  id: string
  source: {
    childChainId: number
    parentChainId: number
  }
  childReceipt?: providers.TransactionReceipt
  ticketReceipt?: providers.TransactionReceipt
  redeemReceipt?: providers.TransactionReceipt
  parentExecutionReceipt?: providers.TransactionReceipt
  childTxByHash?: HexKeyed<Record<string, unknown>>
  childReceiptByHash?: HexKeyed<providers.TransactionReceipt>
  childBlockL1Numbers?: Record<string, number>
  childLogs?: providers.Log[]
  parentLogs?: providers.Log[]
  parentTxByHash?: HexKeyed<providers.TransactionResponse | null>
  expected: Record<string, unknown>
}

export interface ReplayProviderOptions {
  childTxByHash?: HexKeyed<Record<string, unknown> | null>
  childReceiptByHash?: HexKeyed<providers.TransactionReceipt | null>
  childLogs?: providers.Log[]
  childBlockL1Numbers?: Record<string, number>
  parentLogs?: providers.Log[]
  parentTxByHash?: HexKeyed<providers.TransactionResponse | null>
  parentIsArbitrum?: boolean
  parentL2BlockRangeByL1?: Record<
    number,
    { firstBlock: number; lastBlock: number }
  >
  parentL2BlockRangeThrows?: boolean
  parentBlockNumber?: number
  throwOnParentRangeGt?: number
}

const blockL1NumSighash =
  NodeInterface__factory.createInterface().getSighash('blockL1Num')
const arbOSVersionSighash =
  ArbSys__factory.createInterface().getSighash('arbOSVersion')
const l2BlockRangeForL1Sighash =
  NodeInterface__factory.createInterface().getSighash('l2BlockRangeForL1')

const toHexKey = (value: string) => value.toLowerCase()

const toBlockNumber = (
  value: number | string | undefined,
  fallback: number
) => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return fallback
  if (value === 'latest') return fallback
  if (value.startsWith('0x')) return parseInt(value, 16)
  return parseInt(value, 10)
}

const topicMatches = (
  filterTopic: null | string | Array<string | null> | undefined,
  logTopic: string
) => {
  if (filterTopic == null) return true
  if (Array.isArray(filterTopic)) {
    return filterTopic.some(
      t => (t || '').toLowerCase() === logTopic.toLowerCase()
    )
  }
  return filterTopic.toLowerCase() === logTopic.toLowerCase()
}

const matchesFilter = (log: providers.Log, filter: providers.Filter) => {
  if (filter.address) {
    if (log.address.toLowerCase() !== filter.address.toLowerCase()) return false
  }

  const fromBlock = toBlockNumber(filter.fromBlock as number | string, 0)
  const toBlock = toBlockNumber(
    filter.toBlock as number | string,
    Number.MAX_SAFE_INTEGER
  )
  if (log.blockNumber < fromBlock || log.blockNumber > toBlock) return false

  if (!filter.topics) return true
  for (let i = 0; i < filter.topics.length; i++) {
    const filterTopic = filter.topics[i]
    const logTopic = log.topics[i]
    if (!logTopic && filterTopic != null) return false
    if (logTopic && !topicMatches(filterTopic, logTopic)) return false
  }
  return true
}

const filterLogs = (logs: providers.Log[], filter: providers.Filter) =>
  logs
    .filter(log => matchesFilter(log, filter))
    .sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? a.logIndex - b.logIndex
        : a.blockNumber - b.blockNumber
    )

export const loadReverseTracingFixture = (
  fileName: string
): ReverseTracingReplayFixture => {
  const fixturePath = path.join(
    process.cwd(),
    'tests/fixtures/tracing',
    fileName
  )
  const raw = fs.readFileSync(fixturePath, 'utf8')
  return JSON.parse(raw) as ReverseTracingReplayFixture
}

export const buildReplayProviders = (
  fixture: ReverseTracingReplayFixture,
  options: ReplayProviderOptions = {}
): {
  childProvider: providers.JsonRpcProvider
  parentProvider: providers.Provider
} => {
  const childTxByHash = {
    ...(fixture.childTxByHash || {}),
    ...(options.childTxByHash || {}),
  }

  const childReceiptByHash: HexKeyed<providers.TransactionReceipt | null> = {
    ...(fixture.childReceiptByHash || {}),
    ...(options.childReceiptByHash || {}),
  }

  if (fixture.childReceipt) {
    childReceiptByHash[toHexKey(fixture.childReceipt.transactionHash)] =
      fixture.childReceipt
  }
  if (fixture.ticketReceipt) {
    childReceiptByHash[toHexKey(fixture.ticketReceipt.transactionHash)] =
      fixture.ticketReceipt
  }
  if (fixture.redeemReceipt) {
    childReceiptByHash[toHexKey(fixture.redeemReceipt.transactionHash)] =
      fixture.redeemReceipt
  }

  const childLogs = options.childLogs || fixture.childLogs || []
  const parentLogs = options.parentLogs || fixture.parentLogs || []

  const childBlockL1Numbers = {
    ...(fixture.childBlockL1Numbers || {}),
    ...(options.childBlockL1Numbers || {}),
  }

  const parentTxByHash = {
    ...(fixture.parentTxByHash || {}),
    ...(options.parentTxByHash || {}),
  }

  const childProvider = {
    _isProvider: true,
    send: async (method: string, params: unknown[]) => {
      if (method === 'eth_getTransactionByHash') {
        const txHash = toHexKey((params[0] as string) || '')
        return childTxByHash[txHash] ?? null
      }
      throw new Error(`Unexpected RPC method: ${method}`)
    },
    getLogs: async (filter: providers.Filter) => filterLogs(childLogs, filter),
    getTransactionReceipt: async (
      txHashOrPromise: string | Promise<string>
    ): Promise<providers.TransactionReceipt | null> => {
      const txHash = toHexKey(await txHashOrPromise)
      return childReceiptByHash[txHash] ?? null
    },
    getNetwork: async () => ({ chainId: fixture.source.childChainId }),
    call: async (tx: { to?: string; data?: string }) => {
      const data = tx.data ?? ''
      const selector = data.slice(0, 10)

      if (
        selector === blockL1NumSighash &&
        tx.to?.toLowerCase() === NODE_INTERFACE_ADDRESS.toLowerCase()
      ) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['uint64'],
          ethers.utils.hexDataSlice(data, 4)
        )
        const childBlock = decoded[0].toString()
        const l1Block = childBlockL1Numbers[childBlock]
        if (typeof l1Block === 'undefined') {
          throw new Error(`No blockL1Num mapping for child block ${childBlock}`)
        }
        return ethers.utils.defaultAbiCoder.encode(['uint64'], [l1Block])
      }

      if (
        selector === arbOSVersionSighash &&
        tx.to?.toLowerCase() === ARB_SYS_ADDRESS.toLowerCase()
      ) {
        return ethers.utils.defaultAbiCoder.encode(['uint256'], [56])
      }

      return '0x'
    },
    estimateGas: async () => BigNumber.from(0),
    getBlockNumber: async () => 0,
    getBlock: async () => null,
    getTransaction: async () => null,
    resolveName: async () => null,
    lookupAddress: async () => null,
    on: () => undefined,
    once: () => undefined,
    emit: () => false,
    listenerCount: () => 0,
    listeners: () => [],
    off: () => undefined,
    removeAllListeners: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  } as unknown as providers.JsonRpcProvider

  const parentProvider = {
    _isProvider: true,
    getLogs: async (filter: providers.Filter) => {
      const fromBlock = toBlockNumber(filter.fromBlock as number | string, 0)
      const toBlock = toBlockNumber(
        filter.toBlock as number | string,
        Number.MAX_SAFE_INTEGER
      )
      if (
        options.throwOnParentRangeGt &&
        toBlock - fromBlock + 1 > options.throwOnParentRangeGt
      ) {
        throw new Error('requested too many blocks in one getLogs call')
      }
      return filterLogs(parentLogs, filter)
    },
    getNetwork: async () => ({ chainId: fixture.source.parentChainId }),
    call: async (tx: { to?: string; data?: string }) => {
      const data = tx.data ?? ''
      const selector = data.slice(0, 10)

      if (
        selector === arbOSVersionSighash &&
        tx.to?.toLowerCase() === ARB_SYS_ADDRESS.toLowerCase()
      ) {
        if (options.parentIsArbitrum) {
          return ethers.utils.defaultAbiCoder.encode(['uint256'], [56])
        }
        throw new Error('not an Arbitrum chain')
      }

      if (
        selector === l2BlockRangeForL1Sighash &&
        tx.to?.toLowerCase() === NODE_INTERFACE_ADDRESS.toLowerCase()
      ) {
        if (options.parentL2BlockRangeThrows) {
          throw new Error('l2BlockRangeForL1 failed')
        }

        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['uint64'],
          ethers.utils.hexDataSlice(data, 4)
        )
        const l1Block = decoded[0].toNumber()
        const range = options.parentL2BlockRangeByL1?.[l1Block]
        if (!range)
          throw new Error(`No l2BlockRangeForL1 mapping for ${l1Block}`)

        return ethers.utils.defaultAbiCoder.encode(
          ['uint64', 'uint64'],
          [range.firstBlock, range.lastBlock]
        )
      }

      return '0x'
    },
    getBlockNumber: async () => {
      if (typeof options.parentBlockNumber !== 'undefined') {
        return options.parentBlockNumber
      }
      const maxBlock = parentLogs.reduce(
        (acc, log) => Math.max(acc, log.blockNumber),
        0
      )
      return maxBlock
    },
    getBlock: async () => null,
    getTransaction: async (txHashOrPromise: string | Promise<string>) => {
      const txHash = toHexKey(await txHashOrPromise)
      return parentTxByHash[txHash] ?? null
    },
    getTransactionReceipt: async () => null,
    resolveName: async () => null,
    lookupAddress: async () => null,
    estimateGas: async () => BigNumber.from(0),
    on: () => undefined,
    once: () => undefined,
    emit: () => false,
    listenerCount: () => 0,
    listeners: () => [],
    off: () => undefined,
    removeAllListeners: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  } as unknown as providers.Provider

  return { childProvider, parentProvider }
}
