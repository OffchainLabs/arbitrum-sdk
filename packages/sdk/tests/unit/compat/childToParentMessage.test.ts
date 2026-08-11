import { describe, it, expect, vi } from 'vitest'
import { BigNumber } from 'ethers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { Signer } from '@ethersproject/abstract-signer'
import {
  ChildToParentMessageReader,
  ChildToParentMessageWriter,
  ChildToParentMessage,
} from '../../../src/compat/childToParentMessage'
import type { ChildToParentTransactionEvent } from '../../../src/compat/childToParentMessage'

/**
 * Create a mock ethers v5 Provider
 */
function makeMockProvider(chainId = 1): Provider {
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

const sampleEvent: ChildToParentTransactionEvent = {
  caller: '0x' + 'aa'.repeat(20),
  destination: '0x' + 'bb'.repeat(20),
  hash: BigNumber.from('0x' + 'cc'.repeat(32)),
  position: BigNumber.from(42),
  arbBlockNum: BigNumber.from(1000),
  ethBlockNum: BigNumber.from(500),
  timestamp: BigNumber.from(1700000000),
  callvalue: BigNumber.from(0),
  data: '0xdeadbeef',
}

describe('ChildToParentMessageReader', () => {
  it('constructs with ethers v5 provider and BigNumber event', () => {
    const provider = makeMockProvider()
    const reader = new ChildToParentMessageReader(provider, sampleEvent)

    expect(reader).toBeDefined()
    expect(reader.event).toBe(sampleEvent)
  })
})

describe('ChildToParentMessageWriter', () => {
  it('constructs with ethers v5 signer and BigNumber event', () => {
    const provider = makeMockProvider()
    const signer = makeMockSigner(provider)
    const writer = new ChildToParentMessageWriter(signer, sampleEvent)

    expect(writer).toBeDefined()
    expect(writer.event).toBe(sampleEvent)
  })
})

describe('ChildToParentMessage.fromEvent', () => {
  it('returns Reader when given a Provider', () => {
    const provider = makeMockProvider()
    const msg = ChildToParentMessage.fromEvent(provider, sampleEvent)

    expect(msg).toBeInstanceOf(ChildToParentMessageReader)
  })

  it('returns Writer when given a Signer', () => {
    const signer = makeMockSigner()
    const msg = ChildToParentMessage.fromEvent(signer, sampleEvent)

    expect(msg).toBeInstanceOf(ChildToParentMessageWriter)
  })

  it('accepts optional parentProvider override', () => {
    const signer = makeMockSigner()
    const overrideProvider = makeMockProvider(5)
    const msg = ChildToParentMessage.fromEvent(
      signer,
      sampleEvent,
      overrideProvider
    )

    expect(msg).toBeInstanceOf(ChildToParentMessageWriter)
  })
})
