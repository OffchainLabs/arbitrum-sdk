import { expect } from 'chai'
import { providers } from 'ethers'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { buildReplayProviders } from './fixtureHarness'
import { getChildTx, getExpectedHash, loadFixture } from './testHelpers'

describe('Reverse Tracing Real Data: getParentDepositTransactionHash', () => {
  it('traces real type 0x64 deposit tx to parent MessageDelivered tx', async () => {
    const fixture = loadFixture('deposit.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)

    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('returns null for deposit when tx type is not 0x64', async () => {
    const fixture = loadFixture('deposit.json')
    const childTxHash = fixture.childReceipt!.transactionHash.toLowerCase()
    getChildTx(fixture, childTxHash).type = '0x2'

    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.be.null
  })

  it('returns null for deposit when requestId is missing', async () => {
    const fixture = loadFixture('deposit.json')
    const childTxHash = fixture.childReceipt!.transactionHash.toLowerCase()
    delete getChildTx(fixture, childTxHash).requestId

    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.be.null
  })

  it('returns null for deposit when MessageDelivered is missing', async () => {
    const fixture = loadFixture('deposit.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )

    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      parentLogs: [],
    })
    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.be.null
  })

  it('handles parent getLogs range caps by shrinking chunks and still tracing', async () => {
    const fixture = loadFixture('deposit.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      throwOnParentRangeGt: 100,
    })

    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('traces when parent is Arbitrum and l2BlockRangeForL1 mapping is available', async () => {
    const fixture = loadFixture('deposit.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const l1Block =
      fixture.childBlockL1Numbers?.[String(fixture.childReceipt!.blockNumber)]
    const parentLogBlock = fixture.parentLogs?.[0].blockNumber
    if (!l1Block || !parentLogBlock)
      throw new Error('Fixture missing range data')

    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      parentIsArbitrum: true,
      parentL2BlockRangeByL1: {
        [l1Block]: {
          firstBlock: parentLogBlock - 20,
          lastBlock: parentLogBlock + 20,
        },
        [Math.max(0, l1Block - 1000)]: {
          firstBlock: parentLogBlock - 1000,
          lastBlock: parentLogBlock - 900,
        },
      },
    })

    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('traces via L3 fallback window when l2BlockRangeForL1 throws', async () => {
    const fixture = loadFixture('deposit.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.childReceipt as providers.TransactionReceipt
    )
    const parentLogBlock = fixture.parentLogs?.[0].blockNumber
    if (!parentLogBlock) throw new Error('Fixture missing parent log data')

    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      parentIsArbitrum: true,
      parentL2BlockRangeThrows: true,
      parentBlockNumber: parentLogBlock + 1000,
    })

    const result = await childReceipt.getParentDepositTransactionHash(
      childProvider,
      parentProvider
    )
    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })
})
