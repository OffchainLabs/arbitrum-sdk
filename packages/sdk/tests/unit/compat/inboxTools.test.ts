import { describe, it, expect, vi } from 'vitest'
import { InboxTools } from '../../../src/compat/inboxTools'
import { ArbitrumNetwork } from '../../../src/lib/dataEntities/networks'

function makeNetwork(): ArbitrumNetwork {
  return {
    chainId: 42161,
    name: 'Arbitrum One',
    parentChainId: 1,
    confirmPeriodBlocks: 45818,
    isCustom: false,
    isTestnet: false,
    ethBridge: {
      bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
      inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
      outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
      rollup: '0x4DCeB440657f21083db8aDd07665f8ddBe1DCfc0',
    },
  }
}

describe('InboxTools (compat)', () => {
  it('constructs with a signer and child chain', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const network = makeNetwork()

    const tools = new InboxTools(mockSigner, network)
    expect(tools).to.be.an('object')
  })

  it('throws when signer has no provider', () => {
    const mockSigner = {
      signMessage: vi.fn(),
    } as any
    const network = makeNetwork()

    expect(() => new InboxTools(mockSigner, network)).to.throw()
  })

  it('has getForceIncludableEvent method', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const tools = new InboxTools(mockSigner, makeNetwork())
    expect(typeof tools.getForceIncludableEvent).to.eq('function')
  })

  it('has forceInclude method', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const tools = new InboxTools(mockSigner, makeNetwork())
    expect(typeof tools.forceInclude).to.eq('function')
  })

  it('has signChildTx method', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const tools = new InboxTools(mockSigner, makeNetwork())
    expect(typeof tools.signChildTx).to.eq('function')
  })

  it('has sendChildSignedTx method', () => {
    const mockSigner = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 1 }) },
      signMessage: vi.fn(),
    } as any
    const tools = new InboxTools(mockSigner, makeNetwork())
    expect(typeof tools.sendChildSignedTx).to.eq('function')
  })
})
