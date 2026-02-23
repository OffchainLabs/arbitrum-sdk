import { expect } from 'chai'
import { BigNumber } from '@ethersproject/bignumber'
import { ethers } from 'ethers'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { ParentTransactionReceipt } from '../../src/lib/message/ParentTransaction'
import { Bridge__factory } from '../../src/lib/abi/factories/Bridge__factory'
import { ArbRetryableTx__factory } from '../../src/lib/abi/factories/ArbRetryableTx__factory'
import { Outbox__factory } from '../../src/lib/abi/factories/Outbox__factory'
import { ArbSys__factory } from '../../src/lib/abi/factories/ArbSys__factory'
import { NodeInterface__factory } from '../../src/lib/abi/factories/NodeInterface__factory'

const ZERO_ADDR = '0x' + '00'.repeat(20)
const DUMMY_BLOCK_HASH = '0x' + 'ab'.repeat(32)
const PARENT_TX_HASH = '0x' + 'ff'.repeat(32)
const CHILD_TX_HASH = '0x' + 'ee'.repeat(32)
const RECEIPT_TX_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000def'
const NODE_INTERFACE_ADDRESS = '0x00000000000000000000000000000000000000C8'
const ARB_SYS_ADDRESS = '0x0000000000000000000000000000000000000064'
const ARB_RETRYABLE_TX_ADDRESS = '0x000000000000000000000000000000000000006E'
const ARB_ONE_BRIDGE = '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a'

// Function selectors used by provider.call dispatch
const blockL1NumSighash =
  NodeInterface__factory.createInterface().getSighash('blockL1Num')
const arbOSVersionSighash =
  ArbSys__factory.createInterface().getSighash('arbOSVersion')
const l2BlockRangeForL1Sighash =
  NodeInterface__factory.createInterface().getSighash('l2BlockRangeForL1')

/**
 * Build a properly ABI-encoded ethers Log for a given contract factory event.
 */
function encodeLog(
  iface: ethers.utils.Interface,
  eventName: string,
  args: Record<string, unknown>,
  overrides: Partial<ethers.providers.Log> = {}
): ethers.providers.Log {
  const fragment = iface.getEvent(eventName)
  const values = fragment.inputs.map(input => args[input.name])
  const encoded = iface.encodeEventLog(fragment, values)
  return {
    blockNumber: 100,
    blockHash: DUMMY_BLOCK_HASH,
    transactionIndex: 0,
    removed: false,
    address: ZERO_ADDR,
    data: encoded.data,
    topics: encoded.topics,
    transactionHash: PARENT_TX_HASH,
    logIndex: 0,
    ...overrides,
  }
}

function padRequestId(n: number): string {
  return ethers.utils.hexZeroPad(BigNumber.from(n).toHexString(), 32)
}

interface ChildProviderConfig {
  /** Response for eth_getTransactionByHash – keyed by tx hash (lowercase). Fallback to `defaultTxResponse`. */
  txResponses?: Record<string, Record<string, unknown> | null>
  /** Default response for eth_getTransactionByHash when no key matches. */
  defaultTxResponse?: Record<string, unknown> | null
  /** Logs returned by getLogs, keyed by a "topic0" string; defaults to []. */
  logsByTopic?: Record<string, ethers.providers.Log[]>
  /** Flat list of logs returned for ANY getLogs call (if logsByTopic not provided or no match). */
  defaultLogs?: ethers.providers.Log[]
  /** Return value for NodeInterface.blockL1Num (as a number). */
  blockL1Num?: number
  /** Chain ID (default 42161). */
  chainId?: number
}

interface ParentProviderConfig {
  /** Logs returned by getLogs. Default []. */
  logs?: ethers.providers.Log[]
  /** Whether arbOSVersion should succeed (true = Arbitrum parent / L3 scenario). */
  isArbitrumChain?: boolean
  /** l2BlockRangeForL1 responses keyed by l1Block number. */
  l2BlockRangeForL1?: Record<number, { firstBlock: number; lastBlock: number }>
  /** If l2BlockRangeForL1 should throw. */
  l2BlockRangeForL1Throws?: boolean
  /** getBlockNumber return. */
  blockNumber?: number
  /** getTransaction return. */
  transaction?: ethers.providers.TransactionResponse | null
  /** Filter spy: captures the latest getLogs filter. */
  getLogsSpy?: { lastFilter?: ethers.providers.Filter }
}

function mockChildProvider(
  cfg: ChildProviderConfig = {}
): ethers.providers.JsonRpcProvider {
  const chainId = cfg.chainId ?? 42161
  return {
    _isProvider: true,
    send: async (method: string, params: unknown[]) => {
      if (method === 'eth_getTransactionByHash') {
        const hash = (params[0] as string).toLowerCase()
        if (cfg.txResponses && hash in cfg.txResponses) {
          return cfg.txResponses[hash]
        }
        return cfg.defaultTxResponse ?? null
      }
      throw new Error(`Unexpected RPC method: ${method}`)
    },
    getLogs: async (filter: ethers.providers.Filter) => {
      // Match by first topic if logsByTopic provided
      if (cfg.logsByTopic && filter.topics && filter.topics[0]) {
        const topic0 = filter.topics[0] as string
        if (topic0 in cfg.logsByTopic) {
          return cfg.logsByTopic[topic0]
        }
      }
      return cfg.defaultLogs ?? []
    },
    getNetwork: async () => ({ chainId, name: 'arbitrum' }),
    call: async (tx: { to?: string; data?: string }) => {
      const data = tx.data ?? ''
      const selector = data.slice(0, 10)

      // NodeInterface.blockL1Num
      if (
        selector === blockL1NumSighash &&
        tx.to?.toLowerCase() === NODE_INTERFACE_ADDRESS.toLowerCase()
      ) {
        const num = cfg.blockL1Num ?? 50000
        return ethers.utils.defaultAbiCoder.encode(['uint64'], [num])
      }

      // ArbSys.arbOSVersion – on child this would succeed
      if (
        selector === arbOSVersionSighash &&
        tx.to?.toLowerCase() === ARB_SYS_ADDRESS.toLowerCase()
      ) {
        return ethers.utils.defaultAbiCoder.encode(['uint256'], [56])
      }

      return '0x'
    },
    estimateGas: async () => BigNumber.from(0),
    getBlockNumber: async () => 1000000,
    getBlock: async () => null,
    getTransaction: async () => null,
    getTransactionReceipt: async () => null,
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
  } as unknown as ethers.providers.JsonRpcProvider
}

function mockParentProvider(
  cfg: ParentProviderConfig = {}
): ethers.providers.Provider {
  return {
    _isProvider: true,
    getLogs: async (filter: ethers.providers.Filter) => {
      if (cfg.getLogsSpy) {
        cfg.getLogsSpy.lastFilter = filter
      }
      return cfg.logs ?? []
    },
    getNetwork: async () => ({ chainId: 1, name: 'mainnet' }),
    call: async (tx: { to?: string; data?: string }) => {
      const data = tx.data ?? ''
      const selector = data.slice(0, 10)

      // ArbSys.arbOSVersion – parent chain check
      if (
        selector === arbOSVersionSighash &&
        tx.to?.toLowerCase() === ARB_SYS_ADDRESS.toLowerCase()
      ) {
        if (cfg.isArbitrumChain) {
          return ethers.utils.defaultAbiCoder.encode(['uint256'], [56])
        }
        throw new Error('not an Arbitrum chain')
      }

      // NodeInterface.l2BlockRangeForL1 – for L3 parent queries
      if (
        selector === l2BlockRangeForL1Sighash &&
        tx.to?.toLowerCase() === NODE_INTERFACE_ADDRESS.toLowerCase()
      ) {
        if (cfg.l2BlockRangeForL1Throws) {
          throw new Error('l2BlockRangeForL1 failed')
        }
        if (cfg.l2BlockRangeForL1) {
          // Decode the l1Block argument from calldata
          const decoded = ethers.utils.defaultAbiCoder.decode(
            ['uint64'],
            ethers.utils.hexDataSlice(data, 4)
          )
          const l1Block = decoded[0].toNumber()
          const range = cfg.l2BlockRangeForL1[l1Block]
          if (range) {
            return ethers.utils.defaultAbiCoder.encode(
              ['uint64', 'uint64'],
              [range.firstBlock, range.lastBlock]
            )
          }
        }
        throw new Error('no l2BlockRangeForL1 data')
      }

      // NodeInterface.blockL1Num on parent (for L3 scenarios)
      if (
        selector === blockL1NumSighash &&
        tx.to?.toLowerCase() === NODE_INTERFACE_ADDRESS.toLowerCase()
      ) {
        return ethers.utils.defaultAbiCoder.encode(['uint64'], [50000])
      }

      return '0x'
    },
    estimateGas: async () => BigNumber.from(0),
    getBlockNumber: async () => cfg.blockNumber ?? 1000000,
    getBlock: async () => null,
    getTransaction: async () => cfg.transaction ?? null,
    getTransactionReceipt: async () => null,
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
  } as unknown as ethers.providers.Provider
}

function makeChildReceipt(
  overrides: Partial<ethers.providers.TransactionReceipt> = {}
): ChildTransactionReceipt {
  return new ChildTransactionReceipt({
    to: '0x0000000000000000000000000000000000000001',
    from: '0x0000000000000000000000000000000000000002',
    contractAddress: '',
    transactionIndex: 0,
    gasUsed: BigNumber.from(0),
    logsBloom: '0x',
    blockHash: DUMMY_BLOCK_HASH,
    transactionHash: RECEIPT_TX_HASH,
    logs: [],
    blockNumber: 100,
    confirmations: 1,
    cumulativeGasUsed: BigNumber.from(0),
    effectiveGasPrice: BigNumber.from(0),
    byzantium: true,
    type: 2,
    status: 1,
    ...overrides,
  })
}

function makeParentReceipt(
  overrides: Partial<ethers.providers.TransactionReceipt> = {}
): ParentTransactionReceipt {
  return new ParentTransactionReceipt({
    to: '0x0000000000000000000000000000000000000001',
    from: '0x0000000000000000000000000000000000000002',
    contractAddress: '',
    transactionIndex: 0,
    gasUsed: BigNumber.from(0),
    logsBloom: '0x',
    blockHash: DUMMY_BLOCK_HASH,
    transactionHash: '0x' + 'de'.repeat(32),
    logs: [],
    blockNumber: 100,
    confirmations: 1,
    cumulativeGasUsed: BigNumber.from(0),
    effectiveGasPrice: BigNumber.from(0),
    byzantium: true,
    type: 2,
    status: 1,
    ...overrides,
  })
}

function makeMessageDeliveredLog(
  messageIndex: number,
  txHash: string = PARENT_TX_HASH
): ethers.providers.Log {
  const iface = Bridge__factory.createInterface()
  return encodeLog(
    iface,
    'MessageDelivered',
    {
      messageIndex: BigNumber.from(messageIndex),
      beforeInboxAcc: ethers.utils.hexZeroPad('0x01', 32),
      inbox: ZERO_ADDR,
      kind: 9,
      sender: ZERO_ADDR,
      messageDataHash: ethers.utils.hexZeroPad('0x02', 32),
      baseFeeL1: BigNumber.from(1000000000),
      timestamp: BigNumber.from(1700000000),
    },
    { transactionHash: txHash, address: ARB_ONE_BRIDGE }
  )
}

function makeRedeemScheduledLog(
  ticketId: string,
  retryTxHash: string
): ethers.providers.Log {
  const iface = ArbRetryableTx__factory.createInterface()
  return encodeLog(
    iface,
    'RedeemScheduled',
    {
      ticketId,
      retryTxHash,
      sequenceNum: BigNumber.from(0),
      donatedGas: BigNumber.from(0),
      gasDonor: ZERO_ADDR,
      maxRefund: BigNumber.from(0),
      submissionFeeRefund: BigNumber.from(0),
    },
    { address: ARB_RETRYABLE_TX_ADDRESS }
  )
}

function makeOutboxExecutedLog(transactionIndex: number): ethers.providers.Log {
  const iface = Outbox__factory.createInterface()
  return encodeLog(iface, 'OutBoxTransactionExecuted', {
    to: ZERO_ADDR,
    l2Sender: ZERO_ADDR,
    zero: BigNumber.from(0),
    transactionIndex: BigNumber.from(transactionIndex),
  })
}

function makeL2ToL1TxLog(
  position: number,
  txHash: string = CHILD_TX_HASH
): ethers.providers.Log {
  const iface = ArbSys__factory.createInterface()
  return encodeLog(
    iface,
    'L2ToL1Tx',
    {
      caller: ZERO_ADDR,
      destination: ZERO_ADDR,
      hash: BigNumber.from(42),
      position: BigNumber.from(position),
      arbBlockNum: BigNumber.from(5000),
      ethBlockNum: BigNumber.from(1000),
      timestamp: BigNumber.from(1700000000),
      callvalue: BigNumber.from(0),
      data: '0x',
    },
    { transactionHash: txHash, address: ARB_SYS_ADDRESS }
  )
}

function makeExecuteTransactionCalldata(l2Block: number): string {
  const iface = Outbox__factory.createInterface()
  return iface.encodeFunctionData('executeTransaction', [
    [ethers.utils.hexZeroPad('0x01', 32)], // proof
    0, // index
    ZERO_ADDR, // l2Sender
    ZERO_ADDR, // to
    l2Block, // l2Block
    100, // l1Block
    1700000000, // l2Timestamp
    0, // value
    '0x', // data
  ])
}

describe('Reverse Tracing Unit Tests', () => {
  describe('getParentTransactionHash', () => {
    it('returns null for a non-retryable child tx (type mismatch)', async () => {
      const provider = mockChildProvider({
        defaultTxResponse: { type: '0x2', hash: '0xdef' },
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(provider, provider)
      expect(result).to.be.null
    })

    it('returns null when eth_getTransactionByHash returns null', async () => {
      const provider = mockChildProvider({ defaultTxResponse: null })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(provider, provider)
      expect(result).to.be.null
    })

    it('returns null for a type 0x69 tx without requestId', async () => {
      const provider = mockChildProvider({
        defaultTxResponse: { type: '0x69', hash: '0xdef' },
      })

      const receipt = makeChildReceipt({ type: 0x69 })
      const result = await receipt.getParentTransactionHash(provider, provider)
      expect(result).to.be.null
    })
  })

  describe('getParentDepositTransactionHash', () => {
    it('returns null for a non-deposit tx (type mismatch)', async () => {
      const provider = mockChildProvider({
        defaultTxResponse: { type: '0x2', hash: '0xdef' },
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentDepositTransactionHash(
        provider,
        provider
      )
      expect(result).to.be.null
    })

    it('returns null when eth_getTransactionByHash returns null', async () => {
      const provider = mockChildProvider({ defaultTxResponse: null })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentDepositTransactionHash(
        provider,
        provider
      )
      expect(result).to.be.null
    })

    it('returns null for a type 0x64 tx without requestId', async () => {
      const provider = mockChildProvider({
        defaultTxResponse: { type: '0x64', hash: '0xdef' },
      })

      const receipt = makeChildReceipt({ type: 0x64 })
      const result = await receipt.getParentDepositTransactionHash(
        provider,
        provider
      )
      expect(result).to.be.null
    })
  })

  describe('requestId parsing', () => {
    it('correctly parses requestId as messageNumber (real Arb One value)', () => {
      // Real Arbitrum One requestId: 0x...0023bea7 = 2342567
      const requestId =
        '0x000000000000000000000000000000000000000000000000000000000023bea7'
      const messageNumber = BigNumber.from(requestId)
      expect(messageNumber.toNumber()).to.equal(2342567)
    })

    it('correctly parses requestId zero', () => {
      const requestId =
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      const messageNumber = BigNumber.from(requestId)
      expect(messageNumber.toNumber()).to.equal(0)
    })

    it('correctly parses requestId one', () => {
      const requestId =
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      const messageNumber = BigNumber.from(requestId)
      expect(messageNumber.toNumber()).to.equal(1)
    })

    it('correctly parses large requestId (messageNumber 1866423)', () => {
      // 1866423 = 0x1c7ab7
      const requestId =
        '0x00000000000000000000000000000000000000000000000000000000001c7ab7'
      const messageNumber = BigNumber.from(requestId)
      expect(messageNumber.toNumber()).to.equal(1866423)
    })
  })

  describe('getParentDepositTransactionHash (full flow)', () => {
    it('traces deposit to parent tx when MessageDelivered is found', async () => {
      const messageNumber = 5
      const expectedParentHash = '0x' + 'aa'.repeat(32)

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber, expectedParentHash)],
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.equal(expectedParentHash)
    })

    it('returns null when messageNumber found but no MessageDelivered event', async () => {
      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(5),
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({ logs: [] })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })

    it('works when messageNumber is zero', async () => {
      const expectedParentHash = '0x' + 'bb'.repeat(32)

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(0),
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(0, expectedParentHash)],
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.equal(expectedParentHash)
    })
  })

  describe('getParentTransactionHash (full flow)', () => {
    it('ticket creation tx (no RedeemScheduled) traces to parent', async () => {
      const messageNumber = 5
      const expectedParentHash = '0x' + 'cc'.repeat(32)

      // No RedeemScheduled events → ticketId = this.transactionHash
      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x69',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 50000,
        defaultLogs: [], // no RedeemScheduled
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber, expectedParentHash)],
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.equal(expectedParentHash)
    })

    it('redeem tx resolves ticketId via RedeemScheduled and traces to parent', async () => {
      const ticketId = '0x' + 'ab'.repeat(32)
      const messageNumber = 10
      const expectedParentHash = '0x' + 'dd'.repeat(32)

      // The receipt's transactionHash is the redeem tx.
      // RedeemScheduled event has ticketId and retryTxHash.
      const redeemScheduledLog = makeRedeemScheduledLog(
        ticketId,
        RECEIPT_TX_HASH
      )

      // The RedeemScheduled topic
      const redeemTopic =
        ArbRetryableTx__factory.createInterface().getEventTopic(
          'RedeemScheduled'
        )

      // Child provider: getLogs for RedeemScheduled returns our event,
      // send(ticketId) returns the ticket creation tx (type 0x69).
      const childProvider = mockChildProvider({
        txResponses: {
          [ticketId.toLowerCase()]: {
            type: '0x69',
            hash: ticketId,
            requestId: padRequestId(messageNumber),
          },
        },
        defaultTxResponse: null,
        logsByTopic: {
          [redeemTopic]: [redeemScheduledLog],
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber, expectedParentHash)],
      })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.equal(expectedParentHash)
    })

    it('redeem tx returns null when ticket is wrong type (not 0x69)', async () => {
      const ticketId = '0x' + 'ab'.repeat(32)

      const redeemScheduledLog = makeRedeemScheduledLog(
        ticketId,
        RECEIPT_TX_HASH
      )

      const redeemTopic =
        ArbRetryableTx__factory.createInterface().getEventTopic(
          'RedeemScheduled'
        )

      const childProvider = mockChildProvider({
        txResponses: {
          [ticketId.toLowerCase()]: {
            type: '0x02', // not a retryable
            hash: ticketId,
          },
        },
        logsByTopic: {
          [redeemTopic]: [redeemScheduledLog],
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({ logs: [] })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })

    it('ticket creation tx returns null when no MessageDelivered found', async () => {
      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x69',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(5),
        },
        blockL1Num: 50000,
        defaultLogs: [],
      })

      const parentProvider = mockParentProvider({ logs: [] })

      const receipt = makeChildReceipt()
      const result = await receipt.getParentTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })
  })

  describe('getParentEventBlockRange (indirect)', () => {
    it('Ethereum parent uses fromBlock=max(0, l1Block-1000), toBlock=l1Block', async () => {
      const messageNumber = 1
      const spy: ParentProviderConfig['getLogsSpy'] = {}

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 50000,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber)],
        getLogsSpy: spy,
      })

      const receipt = makeChildReceipt()
      await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )

      expect(spy.lastFilter).to.exist
      // findMessageDeliveredTransactionHash chunks the query in PARENT_EVENT_QUERY_CHUNK_SIZE=1000 blocks.
      // First chunk: fromBlock = max(49000, 50000 - 1000 + 1) = 49001, toBlock = 50000.
      // The event is found in this first chunk so no further chunks are queried.
      expect(spy.lastFilter!.fromBlock).to.equal(49001)
      expect(spy.lastFilter!.toBlock).to.equal(50000)
    })

    it('Ethereum parent clamps fromBlock to 0 for small block numbers', async () => {
      const messageNumber = 1
      const spy: ParentProviderConfig['getLogsSpy'] = {}

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 500,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber)],
        getLogsSpy: spy,
      })

      const receipt = makeChildReceipt()
      await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )

      expect(spy.lastFilter).to.exist
      expect(spy.lastFilter!.fromBlock).to.equal(0)
      expect(spy.lastFilter!.toBlock).to.equal(500)
    })

    it('Arbitrum parent (L3) converts l1 blocks to l2 block ranges', async () => {
      const messageNumber = 1
      const spy: ParentProviderConfig['getLogsSpy'] = {}

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 1000,
      })

      // l2BlockRangeForL1(1000) → {5000, 6000}
      // l2BlockRangeForL1(max(0, 1000-1000)) = l2BlockRangeForL1(0) → {0, 100}
      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber)],
        isArbitrumChain: true,
        l2BlockRangeForL1: {
          1000: { firstBlock: 5000, lastBlock: 6000 },
          0: { firstBlock: 0, lastBlock: 100 },
        },
        getLogsSpy: spy,
      })

      const receipt = makeChildReceipt()
      await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )

      expect(spy.lastFilter).to.exist
      // Chunked query: first chunk is [max(0, 6000-1000+1), 6000] = [5001, 6000]
      expect(spy.lastFilter!.fromBlock).to.equal(5001)
      expect(spy.lastFilter!.toBlock).to.equal(6000)
    })

    it('L3 falls back to latestBlock range when l2BlockRangeForL1 throws', async () => {
      const messageNumber = 1
      const spy: ParentProviderConfig['getLogsSpy'] = {}

      const childProvider = mockChildProvider({
        defaultTxResponse: {
          type: '0x64',
          hash: RECEIPT_TX_HASH,
          requestId: padRequestId(messageNumber),
        },
        blockL1Num: 1000,
      })

      const parentProvider = mockParentProvider({
        logs: [makeMessageDeliveredLog(messageNumber)],
        isArbitrumChain: true,
        l2BlockRangeForL1Throws: true,
        blockNumber: 500000,
        getLogsSpy: spy,
      })

      const receipt = makeChildReceipt()
      await receipt.getParentDepositTransactionHash(
        childProvider,
        parentProvider
      )

      expect(spy.lastFilter).to.exist
      // Chunked query: first chunk is [max(400000, 500000-1000+1), 500000] = [499001, 500000]
      expect(spy.lastFilter!.fromBlock).to.equal(499001)
      expect(spy.lastFilter!.toBlock).to.equal(500000)
    })
  })

  describe('getChildWithdrawTransactionHash', () => {
    it('returns null when no OutBoxTransactionExecuted in logs', async () => {
      const childProvider = mockChildProvider()
      const parentProvider = mockParentProvider()

      const receipt = makeParentReceipt({ logs: [] })
      const result = await receipt.getChildWithdrawTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })

    it('returns null when getTransaction returns null', async () => {
      const outboxLog = makeOutboxExecutedLog(7)

      const childProvider = mockChildProvider()
      const parentProvider = mockParentProvider({ transaction: null })

      const receipt = makeParentReceipt({ logs: [outboxLog] })
      const result = await receipt.getChildWithdrawTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })

    it('returns null when tx data is not an executeTransaction call', async () => {
      const outboxLog = makeOutboxExecutedLog(7)

      const childProvider = mockChildProvider()
      const parentProvider = mockParentProvider({
        transaction: {
          hash: '0x' + 'de'.repeat(32),
          data: '0xdeadbeef', // not valid executeTransaction calldata
          value: BigNumber.from(0),
          to: ZERO_ADDR,
          from: ZERO_ADDR,
          nonce: 0,
          gasLimit: BigNumber.from(0),
          gasPrice: BigNumber.from(0),
          chainId: 1,
          confirmations: 1,
          wait: async () => null as any,
        } as ethers.providers.TransactionResponse,
      })

      const receipt = makeParentReceipt({ logs: [outboxLog] })
      const result = await receipt.getChildWithdrawTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })

    it('traces to child tx when all steps succeed', async () => {
      const transactionIndex = 7
      const l2Block = 5000
      const expectedChildHash = '0x' + 'cc'.repeat(32)

      const outboxLog = makeOutboxExecutedLog(transactionIndex)

      // Build the L2ToL1Tx log that will be returned by child getLogs
      const l2ToL1Log = makeL2ToL1TxLog(transactionIndex, expectedChildHash)

      // The L2ToL1Tx event topic for matching in logsByTopic
      const l2ToL1Topic =
        ArbSys__factory.createInterface().getEventTopic('L2ToL1Tx')

      const childProvider = mockChildProvider({
        logsByTopic: {
          [l2ToL1Topic]: [l2ToL1Log],
        },
      })

      const parentProvider = mockParentProvider({
        transaction: {
          hash: '0x' + 'de'.repeat(32),
          data: makeExecuteTransactionCalldata(l2Block),
          value: BigNumber.from(0),
          to: ZERO_ADDR,
          from: ZERO_ADDR,
          nonce: 0,
          gasLimit: BigNumber.from(0),
          gasPrice: BigNumber.from(0),
          chainId: 1,
          confirmations: 1,
          wait: async () => null as any,
        } as ethers.providers.TransactionResponse,
      })

      const receipt = makeParentReceipt({ logs: [outboxLog] })
      const result = await receipt.getChildWithdrawTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.equal(expectedChildHash)
    })

    it('returns null when no L2ToL1Tx events found at block', async () => {
      const transactionIndex = 7
      const l2Block = 5000

      const outboxLog = makeOutboxExecutedLog(transactionIndex)

      const childProvider = mockChildProvider({ defaultLogs: [] })

      const parentProvider = mockParentProvider({
        transaction: {
          hash: '0x' + 'de'.repeat(32),
          data: makeExecuteTransactionCalldata(l2Block),
          value: BigNumber.from(0),
          to: ZERO_ADDR,
          from: ZERO_ADDR,
          nonce: 0,
          gasLimit: BigNumber.from(0),
          gasPrice: BigNumber.from(0),
          chainId: 1,
          confirmations: 1,
          wait: async () => null as any,
        } as ethers.providers.TransactionResponse,
      })

      const receipt = makeParentReceipt({ logs: [outboxLog] })
      const result = await receipt.getChildWithdrawTransactionHash(
        childProvider,
        parentProvider
      )
      expect(result).to.be.null
    })
  })
})
