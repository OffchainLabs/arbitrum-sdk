import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)

import { Log } from '@ethersproject/abstract-provider'
import { expect } from 'chai'
import { providers } from 'ethers'
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito'
import { EventFetcher } from '../../src/lib/utils/eventFetcher'

const TEST_TOPIC =
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
const TEST_ADDRESS = '0x0000000000000000000000000000000000000001'

function makeFakeLog(blockNumber: number, data = '0x'): Log {
  return {
    blockNumber,
    blockHash: `0x${'00'.repeat(31)}${blockNumber
      .toString(16)
      .padStart(2, '0')}`,
    transactionIndex: 0,
    removed: false,
    address: TEST_ADDRESS,
    data,
    topics: [TEST_TOPIC],
    transactionHash: `0x${'aa'.repeat(32)}`,
    logIndex: 0,
  }
}

function createMockContractFactory() {
  const contractFactory = {
    connect: (_address: string, _provider: unknown) => ({
      interface: {
        parseLog: (log: Log) => ({
          args: { data: log.data },
          topic: log.topics[0],
          name: 'TestEvent',
        }),
      },
      filters: {},
    }),
    createInterface: () => ({}),
  }

  const topicGenerator = (_contract: unknown) => ({
    topics: [TEST_TOPIC],
  })

  return { contractFactory, topicGenerator }
}

describe('EventFetcher chunking', () => {
  const { contractFactory, topicGenerator } = createMockContractFactory()

  function createProvider(latestBlockNumber = 10000) {
    const providerMock = mock(providers.JsonRpcProvider)
    when(providerMock._isProvider).thenReturn(true)
    when(providerMock.getLogs(anything())).thenResolve([])
    when(providerMock.getBlockNumber()).thenResolve(latestBlockNumber)
    when(providerMock.getBlock(anything())).thenResolve({
      number: latestBlockNumber,
    } as any)
    return { providerMock, provider: instance(providerMock) }
  }

  it('falls back to chunking with the default maxBlockRange after an initial failure', async () => {
    const { providerMock, provider } = createProvider()
    const fetcher = new EventFetcher(provider)

    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 10000,
        })
      )
    ).thenReject(new Error('rate limited'))

    await fetcher.getEvents(contractFactory as any, topicGenerator as any, {
      fromBlock: 0,
      toBlock: 10000,
    })

    verify(providerMock.getLogs(anything())).thrice()
    verify(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 9999,
        })
      )
    ).once()
    verify(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 10000,
          toBlock: 10000,
        })
      )
    ).once()
  })

  it('resolves negative fromBlock values before stepping off', async () => {
    const { providerMock, provider } = createProvider(25000)
    const fetcher = new EventFetcher(provider)

    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: -20000,
          toBlock: 'latest',
        })
      )
    ).thenReject(new Error('rate limited'))

    await fetcher.getEvents(contractFactory as any, topicGenerator as any, {
      fromBlock: -20000,
      toBlock: 'latest',
    })

    verify(providerMock.getBlockNumber()).once()
    verify(providerMock.getBlock(anything())).once()
    verify(providerMock.getLogs(anything())).times(4)
    verify(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 5000,
          toBlock: 14999,
        })
      )
    ).once()
    verify(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 15000,
          toBlock: 24999,
        })
      )
    ).once()
    verify(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 25000,
          toBlock: 25000,
        })
      )
    ).once()
  })

  it('naively retries smaller chunks and preserves log order', async () => {
    const { providerMock, provider } = createProvider()
    const log0 = makeFakeLog(500, '0x01')
    const log1 = makeFakeLog(1200, '0x02')
    const log2 = makeFakeLog(1800, '0x03')
    const log3 = makeFakeLog(2300, '0x04')

    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 25000,
        })
      )
    ).thenReject(new Error('rate limited'))
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 9999,
        })
      )
    ).thenResolve([log0])
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 10000,
          toBlock: 19999,
        })
      )
    ).thenReject(new Error('rate limited'))
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 10000,
          toBlock: 14999,
        })
      )
    ).thenResolve([log1])
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 15000,
          toBlock: 19999,
        })
      )
    ).thenResolve([log2])
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 20000,
          toBlock: 25000,
        })
      )
    ).thenResolve([log3])

    const fetcher = new EventFetcher(provider)
    const events = await fetcher.getEvents(
      contractFactory as any,
      topicGenerator as any,
      {
        fromBlock: 0,
        toBlock: 25000,
      }
    )

    expect(events.map(event => event.blockNumber)).to.deep.equal([
      500, 1200, 1800, 2300,
    ])
    expect(events.map(event => event.data)).to.deep.equal([
      '0x01',
      '0x02',
      '0x03',
      '0x04',
    ])
  })

  it('uses custom maxBlockRange set via static setter', async () => {
    EventFetcher.setMaxBlockRange(2000)
    try {
      const { providerMock, provider } = createProvider(5000)
      const fetcher = new EventFetcher(provider)

      when(
        providerMock.getLogs(
          deepEqual({
            topics: [TEST_TOPIC],
            address: undefined,
            fromBlock: 0,
            toBlock: 5000,
          })
        )
      ).thenReject(new Error('rate limited'))

      await fetcher.getEvents(contractFactory as any, topicGenerator as any, {
        fromBlock: 0,
        toBlock: 5000,
      })

      // With maxBlockRange=2000, chunks should be [0-1999], [2000-3999], [4000-5000]
      verify(providerMock.getLogs(anything())).times(4) // 1 initial + 3 chunks
      verify(
        providerMock.getLogs(
          deepEqual({
            topics: [TEST_TOPIC],
            address: undefined,
            fromBlock: 0,
            toBlock: 1999,
          })
        )
      ).once()
      verify(
        providerMock.getLogs(
          deepEqual({
            topics: [TEST_TOPIC],
            address: undefined,
            fromBlock: 2000,
            toBlock: 3999,
          })
        )
      ).once()
      verify(
        providerMock.getLogs(
          deepEqual({
            topics: [TEST_TOPIC],
            address: undefined,
            fromBlock: 4000,
            toBlock: 5000,
          })
        )
      ).once()
    } finally {
      EventFetcher.setMaxBlockRange(10_000)
    }
  })

  it('rethrows once naive retries reach MIN_CHUNK_SIZE', async () => {
    const { providerMock, provider } = createProvider()

    when(providerMock.getLogs(anything())).thenReject(new Error('rate limited'))
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 25000,
        })
      )
    ).thenReject(new Error('rate limited'))
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 0,
          toBlock: 9999,
        })
      )
    ).thenResolve([makeFakeLog(500)])

    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 10000,
          toBlock: 19999,
        })
      )
    ).thenReject(new Error('rate limited'))
    when(
      providerMock.getLogs(
        deepEqual({
          topics: [TEST_TOPIC],
          address: undefined,
          fromBlock: 10000,
          toBlock: 14999,
        })
      )
    ).thenReject(new Error('rate limited'))

    const fetcher = new EventFetcher(provider)

    try {
      await fetcher.getEvents(contractFactory as any, topicGenerator as any, {
        fromBlock: 0,
        toBlock: 25000,
      })
      expect.fail('Should have thrown')
    } catch (error: any) {
      expect(error.message).to.equal('rate limited')
    }
  })
})
