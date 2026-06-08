import { expect } from 'chai'
import { providers } from 'ethers'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { buildReplayProviders } from './fixtureHarness'
import { getChildTx, getExpectedHash, loadFixture } from './testHelpers'

describe('Reverse Tracing Real Data: getParentTransactionHash', () => {
  it('traces real retryable ticket creation tx to parent tx', async () => {
    const fixture = loadFixture('retryable.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.ticketReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)

    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('traces real redeem tx to parent tx via RedeemScheduled ticketId', async () => {
    const fixture = loadFixture('retryable.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.redeemReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)

    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('returns null when retryable ticket tx is not type 0x69', async () => {
    const fixture = loadFixture('retryable.json')
    const ticketHash = fixture.ticketReceipt!.transactionHash.toLowerCase()
    getChildTx(fixture, ticketHash).type = '0x2'

    const childReceipt = new ChildTransactionReceipt(
      fixture.ticketReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('returns null when retryable ticket tx has no requestId', async () => {
    const fixture = loadFixture('retryable.json')
    const ticketHash = fixture.ticketReceipt!.transactionHash.toLowerCase()
    delete getChildTx(fixture, ticketHash).requestId

    const childReceipt = new ChildTransactionReceipt(
      fixture.ticketReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('returns null for redeem when RedeemScheduled log is unavailable', async () => {
    const fixture = loadFixture('retryable.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.redeemReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      childLogs: [],
    })

    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })

  it('uses ticket creation block for delayed redeem ranges (regression)', async () => {
    const fixture = loadFixture('retryable.json')
    const ticketBlock = fixture.ticketReceipt!.blockNumber
    const ticketL1Block =
      fixture.childBlockL1Numbers?.[String(ticketBlock)] ?? undefined
    if (!ticketL1Block)
      throw new Error('Fixture missing ticket l1 block mapping')

    const delayedBlock = ticketBlock + 500000
    fixture.redeemReceipt!.blockNumber = delayedBlock
    const redeemHash = fixture.redeemReceipt!.transactionHash.toLowerCase()
    if (!fixture.childReceiptByHash) fixture.childReceiptByHash = {}
    fixture.childReceiptByHash[redeemHash] = fixture.redeemReceipt!

    if (!fixture.childLogs || fixture.childLogs.length === 0) {
      throw new Error('Fixture missing redeem scheduled log')
    }
    fixture.childLogs[0].blockNumber = delayedBlock
    fixture.childBlockL1Numbers = {
      ...(fixture.childBlockL1Numbers || {}),
      [String(ticketBlock)]: ticketL1Block,
      [String(delayedBlock)]: ticketL1Block + 5000,
    }

    const childReceipt = new ChildTransactionReceipt(
      fixture.redeemReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture)
    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.equal(getExpectedHash(fixture, 'parentTxHash'))
  })

  it('returns null when MessageDelivered is missing for retryable tracing', async () => {
    const fixture = loadFixture('retryable.json')
    const childReceipt = new ChildTransactionReceipt(
      fixture.ticketReceipt as providers.TransactionReceipt
    )
    const { childProvider, parentProvider } = buildReplayProviders(fixture, {
      parentLogs: [],
    })

    const result = await childReceipt.getParentTransactionHash(
      childProvider,
      parentProvider
    )

    expect(result).to.be.null
  })
})
