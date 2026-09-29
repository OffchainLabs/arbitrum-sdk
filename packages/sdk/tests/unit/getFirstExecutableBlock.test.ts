import { expect } from 'chai'
import { BigNumber } from '@ethersproject/bignumber'
import { Provider } from '@ethersproject/abstract-provider'
import { vi } from 'vitest'
import { ChildToParentMessageReaderNitro } from '../../src/lib/message/ChildToParentMessageNitro'
import { ChildToParentMessageStatus } from '../../src/lib/dataEntities/message'
import { getArbitrumNetwork } from '../../src/lib/dataEntities/networks'
import { EventArgs } from '../../src/lib/dataEntities/event'
import { L2ToL1TxEvent } from '../../src/lib/abi/ArbSys'

const ZERO_ADDR = '0x' + '00'.repeat(20)
const ASSERTION_CONFIRMED_PADDING = 20
const ASSERTION_CREATED_PADDING = 50
const PROVIDER_MAX_LOG_RANGE = 10_000

function nitroEvent(): EventArgs<L2ToL1TxEvent> {
  return {
    caller: ZERO_ADDR,
    destination: ZERO_ADDR,
    hash: BigNumber.from(1),
    position: BigNumber.from(0),
    arbBlockNum: BigNumber.from(1),
    ethBlockNum: BigNumber.from(1),
    timestamp: BigNumber.from(1),
    callvalue: BigNumber.from(0),
    data: '0x',
  }
}

function resolveBlockTag(tag: unknown, latestBlock: number): number {
  if (tag === 'latest' || tag === 'pending' || tag == null) return latestBlock
  if (tag === 'earliest') return 0
  if (typeof tag === 'number') return tag
  if (typeof tag === 'string') {
    return parseInt(tag, tag.startsWith('0x') ? 16 : 10)
  }
  throw new Error(`unexpected block tag ${String(tag)}`)
}

function createRangeLimitedProvider(latestBlock: number, maxRange: number) {
  const getLogs = vi.fn(
    async (filter: { fromBlock?: unknown; toBlock?: unknown }) => {
      const from = resolveBlockTag(filter.fromBlock, latestBlock)
      const to = resolveBlockTag(filter.toBlock, latestBlock)
      if (to - from + 1 > maxRange) {
        throw Object.assign(
          new Error('eth_getLogs is limited to a 10,000 range'),
          { code: -32614, status: 413 }
        )
      }
      return []
    }
  )

  const parentProvider = {
    _isProvider: true,
    getBlockNumber: async () => latestBlock,
    getLogs,
  } as unknown as Provider

  const childProvider = {
    _isProvider: true,
    getNetwork: async () => ({ chainId: 42161, name: 'arbitrum' }),
  } as unknown as Provider

  return { parentProvider, childProvider, getLogs }
}

describe('ChildToParentMessageNitro.getFirstExecutableBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pages eth_getLogs when confirmPeriodBlocks exceeds the provider range cap', async () => {
    const network = getArbitrumNetwork(42161)
    const latestBlock = 24_000_000
    const { parentProvider, childProvider, getLogs } =
      createRangeLimitedProvider(latestBlock, PROVIDER_MAX_LOG_RANGE)

    const reader = new ChildToParentMessageReaderNitro(
      parentProvider,
      nitroEvent()
    )
    vi.spyOn(reader, 'status').mockResolvedValue(
      ChildToParentMessageStatus.UNCONFIRMED
    )

    const result = await reader.getFirstExecutableBlock(childProvider)

    const fromBlock = Math.max(
      latestBlock - (network.confirmPeriodBlocks + ASSERTION_CONFIRMED_PADDING),
      0
    )
    expect(latestBlock - fromBlock + 1).to.be.greaterThan(
      PROVIDER_MAX_LOG_RANGE
    )

    expect(BigNumber.isBigNumber(result)).to.equal(true)
    expect(
      (result as BigNumber).eq(
        BigNumber.from(latestBlock)
          .add(network.confirmPeriodBlocks)
          .add(ASSERTION_CREATED_PADDING)
          .add(ASSERTION_CONFIRMED_PADDING)
      )
    ).to.equal(true)

    expect(getLogs.mock.calls.length).to.be.greaterThan(1)

    const ranges = getLogs.mock.calls.map(([filter]) => {
      const from = resolveBlockTag(filter.fromBlock, latestBlock)
      const to = resolveBlockTag(filter.toBlock, latestBlock)
      return { from, to, size: to - from + 1 }
    })

    for (const range of ranges) {
      expect(range.size).to.be.at.most(PROVIDER_MAX_LOG_RANGE)
      expect(range.to).to.be.at.least(range.from)
    }

    expect(ranges[0].from).to.equal(fromBlock)
    expect(ranges[ranges.length - 1].to).to.equal(latestBlock)

    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].from).to.equal(ranges[i - 1].to + 1)
    }
  })
})
