import { expect } from 'chai'
import { BigNumber } from 'ethers'

import {
  EncodeRetryableTicketParams,
  ParentToChildMessageCreator,
} from '../../src/lib/message/ParentToChildMessageCreator'
import { Inbox__factory } from '../../src/lib/abi/factories/Inbox__factory'
import { ERC20Inbox__factory } from '../../src/lib/abi/factories/ERC20Inbox__factory'
import { ArbSdkError } from '../../src/lib/dataEntities/errors'

describe('ParentToChildMessageCreator.encodeRetryableTicket', () => {
  const base: EncodeRetryableTicketParams = {
    to: '0x1111111111111111111111111111111111111111',
    l2CallValue: BigNumber.from(7),
    data: '0xabcdef',
    excessFeeRefundAddress: '0x2222222222222222222222222222222222222222',
    callValueRefundAddress: '0x3333333333333333333333333333333333333333',
    gasLimit: BigNumber.from(100_000),
    maxFeePerGas: BigNumber.from(1_000_000_000),
    maxSubmissionCost: BigNumber.from(500),
    nativeTokenIsEth: true,
  }

  const expectedDeposit = base.gasLimit
    .mul(base.maxFeePerGas)
    .add(base.maxSubmissionCost!)
    .add(base.l2CallValue)

  it('derives the deposit and encodes ETH Inbox calldata', async () => {
    const res = await ParentToChildMessageCreator.encodeRetryableTicket(base)

    expect(res.deposit.toString()).to.eq(expectedDeposit.toString())
    expect(res.maxSubmissionCost.toString()).to.eq('500')

    const decoded = Inbox__factory.createInterface().decodeFunctionData(
      'createRetryableTicket',
      res.data
    )
    expect(decoded[0]).to.eq(base.to)
    expect(decoded[1].toString()).to.eq('7') // l2CallValue
    expect(decoded[2].toString()).to.eq('500') // maxSubmissionCost
    expect(decoded[3]).to.eq(base.excessFeeRefundAddress)
    expect(decoded[4]).to.eq(base.callValueRefundAddress)
    expect(decoded[5].toString()).to.eq('100000') // gasLimit
    expect(decoded[6].toString()).to.eq('1000000000') // maxFeePerGas
    expect(decoded[7]).to.eq(base.data) // ETH Inbox: data is the last arg
  })

  it('encodes ERC20 Inbox calldata with tokenTotalFeeAmount', async () => {
    const res = await ParentToChildMessageCreator.encodeRetryableTicket({
      ...base,
      nativeTokenIsEth: false,
    })

    const decoded = ERC20Inbox__factory.createInterface().decodeFunctionData(
      'createRetryableTicket',
      res.data
    )
    // ERC20 Inbox has an extra tokenTotalFeeAmount arg (the deposit) before data
    expect(decoded[7].toString()).to.eq(res.deposit.toString())
    expect(decoded[8]).to.eq(base.data)
  })

  it('uses a caller-provided deposit instead of deriving it', async () => {
    const res = await ParentToChildMessageCreator.encodeRetryableTicket({
      ...base,
      deposit: BigNumber.from(42),
    })
    expect(res.deposit.toString()).to.eq('42')
  })

  it('throws when neither maxSubmissionCost nor parentProvider/inbox is supplied', async () => {
    const { maxSubmissionCost: _omit, ...noCost } = base
    let error: unknown
    try {
      await ParentToChildMessageCreator.encodeRetryableTicket(
        noCost as EncodeRetryableTicketParams
      )
    } catch (e) {
      error = e
    }
    expect(error).to.be.instanceOf(ArbSdkError)
  })
})
