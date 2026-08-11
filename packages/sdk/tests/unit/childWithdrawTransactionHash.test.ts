import { expect } from 'chai'
import { providers } from 'ethers'
import { ParentTransactionReceipt } from '../../src/lib/message/ParentTransaction'
import { buildReplayProviders } from './fixtureHarness'
import { getExpectedHash, getParentTx, loadFixture } from './testHelpers'

describe('Reverse Tracing Real Data: getChildWithdrawTransactionHash', () => {
  it('traces real outbox execution tx back to child L2ToL1Tx', async () => {
    const fixture = loadFixture('withdraw.json')
    const parentReceipt = new ParentTransactionReceipt(
      fixture.parentExecutionReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)

    const result = await parentReceipt.getChildWithdrawTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.equal(getExpectedHash(fixture, 'childTxHash'))
  })

  it('returns null when parent execution receipt has no OutBoxTransactionExecuted', async () => {
    const fixture = loadFixture('withdraw.json')
    fixture.parentExecutionReceipt!.logs = []
    const parentReceipt = new ParentTransactionReceipt(
      fixture.parentExecutionReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)

    const result = await parentReceipt.getChildWithdrawTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('returns null when parent transaction cannot be fetched', async () => {
    const fixture = loadFixture('withdraw.json')
    const parentTxHash =
      fixture.parentExecutionReceipt!.transactionHash.toLowerCase()
    const parentReceipt = new ParentTransactionReceipt(
      fixture.parentExecutionReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      parentTxByHash: { [parentTxHash]: null },
    })

    const result = await parentReceipt.getChildWithdrawTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('returns null when parent execution calldata cannot be decoded', async () => {
    const fixture = loadFixture('withdraw.json')
    const parentTxHash =
      fixture.parentExecutionReceipt!.transactionHash.toLowerCase()
    const tx = getParentTx(fixture, parentTxHash) as unknown as Record<
      string,
      unknown
    >
    tx.data = '0xdeadbeef'

    const parentReceipt = new ParentTransactionReceipt(
      fixture.parentExecutionReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await parentReceipt.getChildWithdrawTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('returns null when no matching child L2ToL1Tx event is found', async () => {
    const fixture = loadFixture('withdraw.json')
    const parentReceipt = new ParentTransactionReceipt(
      fixture.parentExecutionReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      childLogs: [],
    })

    const result = await parentReceipt.getChildWithdrawTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })
})
