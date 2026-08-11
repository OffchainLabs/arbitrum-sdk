import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BigNumber } from 'ethers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { Signer } from '@ethersproject/abstract-signer'
import {
  ParentToChildMessageReader,
  ParentToChildMessageWriter,
  ParentToChildMessage,
  EthDepositMessage,
} from '../../../src/compat/parentToChildMessage'
import { ParentToChildMessageStatus } from '../../../src/compat/types'
import type { RetryableMessageParams } from '../../../src/compat/types'

/**
 * Create a mock ethers v5 Provider with minimal interface
 */
function makeMockProvider(chainId = 42161): Provider {
  return {
    getNetwork: vi.fn().mockResolvedValue({ chainId }),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue({
      hash: '0x' + 'ab'.repeat(32),
      number: 100,
      timestamp: 1700000000,
    }),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x'),
    getLogs: vi.fn().mockResolvedValue([]),
    // Required for structural typing
    _isProvider: true,
  } as unknown as Provider
}

/**
 * Create a mock ethers v5 Signer with a connected provider
 */
function makeMockSigner(provider?: Provider): Signer {
  const mockProvider = provider ?? makeMockProvider()
  return {
    getAddress: vi.fn().mockResolvedValue('0x' + 'aa'.repeat(20)),
    signMessage: vi.fn(),
    sendTransaction: vi.fn().mockResolvedValue({
      hash: '0x' + 'dd'.repeat(32),
      wait: vi.fn().mockResolvedValue({
        to: '0x' + '00'.repeat(20),
        from: '0x' + 'aa'.repeat(20),
        contractAddress: null,
        transactionIndex: 0,
        gasUsed: BigNumber.from(21000),
        logsBloom: '0x',
        blockHash: '0x' + 'bb'.repeat(32),
        transactionHash: '0x' + 'dd'.repeat(32),
        logs: [],
        blockNumber: 101,
        confirmations: 1,
        cumulativeGasUsed: BigNumber.from(21000),
        effectiveGasPrice: BigNumber.from(1000000000),
        byzantium: true,
        type: 2,
        status: 1,
      }),
    }),
    provider: mockProvider,
    _isSigner: true,
  } as unknown as Signer
}

const sampleMessageData: RetryableMessageParams = {
  destAddress: '0x' + '11'.repeat(20),
  l2CallValue: BigNumber.from(0),
  l1Value: BigNumber.from(1000000),
  maxSubmissionFee: BigNumber.from(100000),
  excessFeeRefundAddress: '0x' + '22'.repeat(20),
  callValueRefundAddress: '0x' + '33'.repeat(20),
  gasLimit: BigNumber.from(100000),
  maxFeePerGas: BigNumber.from(1000000000),
  data: '0xdeadbeef',
}

describe('ParentToChildMessageReader', () => {
  it('constructs with ethers v5 provider and BigNumber params', () => {
    const provider = makeMockProvider()
    const reader = new ParentToChildMessageReader(
      provider,
      42161,
      '0x' + 'aa'.repeat(20),
      BigNumber.from(1),
      BigNumber.from(25000000000),
      sampleMessageData
    )

    expect(reader.retryableCreationId).toBeDefined()
    expect(typeof reader.retryableCreationId).toBe('string')
    expect(reader.retryableCreationId.startsWith('0x')).toBe(true)
    expect(reader.chainId).toBe(42161)
    expect(reader.sender).toBe('0x' + 'aa'.repeat(20))
    expect(reader.messageNumber.eq(BigNumber.from(1))).toBe(true)
    expect(reader.parentBaseFee.eq(BigNumber.from(25000000000))).toBe(true)
    expect(reader.messageData).toEqual(sampleMessageData)
  })

  it('status() delegates to core reader and returns a ParentToChildMessageStatus', async () => {
    const provider = makeMockProvider()
    const reader = new ParentToChildMessageReader(
      provider,
      42161,
      '0x' + 'aa'.repeat(20),
      BigNumber.from(1),
      BigNumber.from(25000000000),
      sampleMessageData
    )

    // When no receipt is found, status should be NOT_YET_CREATED
    const status = await reader.status()
    expect(status).toBe(ParentToChildMessageStatus.NOT_YET_CREATED)
  })
})

describe('ParentToChildMessageWriter', () => {
  it('constructs with ethers v5 signer and BigNumber params', () => {
    const signer = makeMockSigner()
    const writer = new ParentToChildMessageWriter(
      signer,
      42161,
      '0x' + 'aa'.repeat(20),
      BigNumber.from(1),
      BigNumber.from(25000000000),
      sampleMessageData
    )

    expect(writer.retryableCreationId).toBeDefined()
    expect(writer.chainSigner).toBe(signer)
  })

  it('throws if signer has no provider', () => {
    const signerNoProvider = {
      signMessage: vi.fn(),
      provider: undefined,
      _isSigner: true,
    } as unknown as Signer

    expect(
      () =>
        new ParentToChildMessageWriter(
          signerNoProvider,
          42161,
          '0x' + 'aa'.repeat(20),
          BigNumber.from(1),
          BigNumber.from(25000000000),
          sampleMessageData
        )
    ).toThrow('Signer not connected to provider')
  })
})

describe('ParentToChildMessage.fromEventComponents', () => {
  it('returns Reader when given a Provider', () => {
    const provider = makeMockProvider()
    const msg = ParentToChildMessage.fromEventComponents(
      provider,
      42161,
      '0x' + 'aa'.repeat(20),
      BigNumber.from(1),
      BigNumber.from(25000000000),
      sampleMessageData
    )

    expect(msg).toBeInstanceOf(ParentToChildMessageReader)
  })

  it('returns Writer when given a Signer', () => {
    const signer = makeMockSigner()
    const msg = ParentToChildMessage.fromEventComponents(
      signer,
      42161,
      '0x' + 'aa'.repeat(20),
      BigNumber.from(1),
      BigNumber.from(25000000000),
      sampleMessageData
    )

    expect(msg).toBeInstanceOf(ParentToChildMessageWriter)
  })
})

describe('EthDepositMessage', () => {
  it('constructs with BigNumber fields and computes childTxHash', () => {
    const provider = makeMockProvider()
    const msg = new EthDepositMessage(
      provider,
      42161,
      BigNumber.from(1),
      '0x' + 'aa'.repeat(20),
      '0x' + 'bb'.repeat(20),
      BigNumber.from('1000000000000000000')
    )

    expect(msg.childTxHash).toBeDefined()
    expect(msg.childTxHash.startsWith('0x')).toBe(true)
    expect(msg.childChainId).toBe(42161)
    expect(msg.messageNumber.eq(BigNumber.from(1))).toBe(true)
    expect(msg.from).toBe('0x' + 'aa'.repeat(20))
    expect(msg.to).toBe('0x' + 'bb'.repeat(20))
    expect(msg.value.eq(BigNumber.from('1000000000000000000'))).toBe(true)
  })

  it('status() returns PENDING when receipt not found', async () => {
    const provider = makeMockProvider()
    const msg = new EthDepositMessage(
      provider,
      42161,
      BigNumber.from(1),
      '0x' + 'aa'.repeat(20),
      '0x' + 'bb'.repeat(20),
      BigNumber.from('1000000000000000000')
    )

    const status = await msg.status()
    expect(status).toBe(1) // EthDepositMessageStatus.PENDING
  })
})
