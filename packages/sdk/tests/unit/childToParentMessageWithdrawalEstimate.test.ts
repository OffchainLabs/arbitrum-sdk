import { expect } from 'chai'
import { BigNumber, providers } from 'ethers'
import { ChildToParentMessageReaderClassic } from '../../src/lib/message/ChildToParentMessageClassic'
import { ChildToParentMessageReaderNitro } from '../../src/lib/message/ChildToParentMessageNitro'
import { WithdrawalTimeEstimateOptions } from '../../src/lib/dataEntities/message'

const childProvider = {
  getNetwork: async () => ({ chainId: 42161 }),
  getBlock: async () => ({ hash: '0xabc' }),
} as unknown as providers.Provider

const nitroEvent = {
  position: BigNumber.from(47349),
  arbBlockNum: BigNumber.from(1000),
  ethBlockNum: BigNumber.from(50),
} as any

const confirmPeriodBlocks = BigNumber.from(100)
const defaultOptions: WithdrawalTimeEstimateOptions = {
  parentBlockNumber: 100,
  parentBlockTimeSeconds: 12,
  assertionIntervalSampleSize: 3,
}

class TestNitroReader extends ChildToParentMessageReaderNitro {
  private readonly config: {
    claimed?: boolean
    batchConfirmations?: BigNumber
    batchNumber?: number
    coveringAssertion?: any
    latestConfirmedAssertion?: any
    historicalAssertionInfo?: {
      intervals: number[]
      latestCreatedAtBlock?: number
    }
  }

  constructor(config: TestNitroReader['config']) {
    super({} as providers.Provider, nitroEvent)
    this.config = config
  }

  protected override async hasExecuted(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider
  ) {
    return this.config.claimed ?? false
  }

  protected override async getBatchConfirmations(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider
  ) {
    return this.config.batchConfirmations ?? BigNumber.from(1)
  }

  protected override async getBatchNumber(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider
  ) {
    return this.config.batchNumber
  }

  protected override async getRollupAndUpdateNetwork(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _arbitrumNetwork: any
  ) {
    return {
      callStatic: {
        confirmPeriodBlocks: async () => confirmPeriodBlocks,
      },
    } as any
  }

  protected override async getCoveringAssertion(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _confirmPeriodBlocks: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _withdrawalBatch: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber
  ) {
    return this.config.coveringAssertion
  }

  protected override async getLatestConfirmedAssertion(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _confirmPeriodBlocks: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _useHistoricalBlock: boolean
  ) {
    return this.config.latestConfirmedAssertion
  }

  protected override async getHistoricalAssertionInfo(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _confirmPeriodBlocks: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sampleSize: number
  ) {
    return (
      this.config.historicalAssertionInfo ?? {
        intervals: [],
      }
    )
  }
}

class TestClassicReader extends ChildToParentMessageReaderClassic {
  private readonly config: {
    claimed?: boolean
    coveringNode?: any
    latestConfirmedNode?: any
    historicalNodeInfo?: {
      intervals: number[]
      latestCreatedAtBlock?: number
    }
  }

  constructor(config: TestClassicReader['config']) {
    super({} as providers.Provider, BigNumber.from(10), BigNumber.from(2))
    this.config = config
  }

  public override async hasExecuted(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider
  ) {
    return this.config.claimed ?? false
  }

  protected override async getRollup(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _childProvider: providers.Provider
  ) {
    return {
      confirmPeriodBlocks: async () => confirmPeriodBlocks,
    } as any
  }

  protected override async getCoveringNode(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _confirmPeriodBlocks: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber
  ) {
    return this.config.coveringNode
  }

  protected override async getLatestConfirmedNode(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _confirmPeriodBlocks: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _useHistoricalBlock: boolean
  ) {
    return this.config.latestConfirmedNode
  }

  protected override async getHistoricalNodeInfo(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rollup: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentParentBlock: BigNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sampleSize: number
  ) {
    return (
      this.config.historicalNodeInfo ?? {
        intervals: [],
      }
    )
  }
}

describe('ChildToParentMessage withdrawal estimates', () => {
  it('returns CLAIMED for executed nitro withdrawals', async () => {
    const reader = new TestNitroReader({ claimed: true })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate).to.deep.equal({
      phase: 'CLAIMED',
      isEstimate: false,
      position: 47349,
    })
  })

  it('returns UNCONFIRMED when nitro batch confirmations are zero', async () => {
    const reader = new TestNitroReader({
      batchConfirmations: BigNumber.from(0),
    })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate.phase).to.equal('UNCONFIRMED')
    expect(estimate.isEstimate).to.equal(false)
    expect(estimate.position).to.equal(47349)
  })

  it('returns BATCHED with an assertion-aware estimate for nitro withdrawals', async () => {
    const reader = new TestNitroReader({
      batchNumber: 10,
      historicalAssertionInfo: {
        intervals: [30, 50, 40],
        latestCreatedAtBlock: 90,
      },
    })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate).to.deep.equal({
      phase: 'BATCHED',
      estimatedRemainingSeconds: 1560,
      isEstimate: true,
      position: 47349,
      withdrawalBatch: 10,
    })
  })

  it('returns ASSERTION_PENDING with exact remaining time for nitro withdrawals', async () => {
    const reader = new TestNitroReader({
      batchNumber: 10,
      coveringAssertion: {
        hash: '0xcover',
        createdAtBlock: BigNumber.from(80),
        deadlineBlock: BigNumber.from(180),
        afterBatch: BigNumber.from(10),
      },
      latestConfirmedAssertion: {
        afterBatch: BigNumber.from(9),
      },
    })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate).to.deep.equal({
      phase: 'ASSERTION_PENDING',
      remainingBlocks: 80,
      remainingSeconds: 960,
      isEstimate: false,
      coveringAssertionHash: '0xcover',
      assertionCreatedAtBlock: 80,
      assertionDeadlineBlock: 180,
      position: 47349,
      withdrawalBatch: 10,
    })
  })

  it('returns CLAIMABLE when the latest confirmed nitro assertion covers the withdrawal', async () => {
    const reader = new TestNitroReader({
      batchNumber: 10,
      coveringAssertion: {
        hash: '0xcover',
        createdAtBlock: BigNumber.from(80),
        deadlineBlock: BigNumber.from(180),
        afterBatch: BigNumber.from(10),
      },
      latestConfirmedAssertion: {
        afterBatch: BigNumber.from(10),
      },
    })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate.phase).to.equal('CLAIMABLE')
    expect(estimate.coveringAssertionHash).to.equal('0xcover')
    expect(estimate.isEstimate).to.equal(false)
  })

  it('returns CLAIMABLE for classic withdrawals once the covering node is confirmed', async () => {
    const reader = new TestClassicReader({
      coveringNode: {
        hash: '0xnode',
        createdAtBlock: BigNumber.from(40),
        deadlineBlock: BigNumber.from(140),
        afterBatch: BigNumber.from(10),
      },
      latestConfirmedNode: {
        afterBatch: BigNumber.from(10),
      },
    })

    const estimate = await reader.getWithdrawalTimeEstimate(
      childProvider,
      defaultOptions
    )

    expect(estimate).to.deep.equal({
      phase: 'CLAIMABLE',
      isEstimate: false,
      position: 2,
      withdrawalBatch: 10,
      coveringAssertionHash: '0xnode',
      assertionCreatedAtBlock: 40,
      assertionDeadlineBlock: 140,
    })
  })
})
