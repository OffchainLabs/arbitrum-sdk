import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BigNumber, Wallet, providers } from 'ethers'
import { EthBridger } from '../../../src/compat/ethBridger'
import { ArbitrumNetwork } from '../../../src/lib/dataEntities/networks'

/**
 * A minimal ArbitrumNetwork fixture for unit tests.
 */
function makeNetwork(overrides?: Partial<ArbitrumNetwork>): ArbitrumNetwork {
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
    tokenBridge: {
      parentGatewayRouter: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
      childGatewayRouter: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
      parentErc20Gateway: '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
      childErc20Gateway: '0x09e9222E96E7B4AE2a407B98d48e330053351EEe',
      parentCustomGateway: '0xcEe284F754E854890e311e3280b767F80797180d',
      childCustomGateway: '0x096760F208390250649E3e8763348E783AEF5562',
      parentWethGateway: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
      childWethGateway: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
      childWeth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      parentWeth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      parentProxyAdmin: '0x9aD46fac0Cf7f790E5be05A0F15223935A0c0aDa',
      childProxyAdmin: '0xd570aCE65C43af47101fC6250FD6fC63D1c22a86',
      parentMultiCall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
      childMultiCall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
    },
    ...overrides,
  }
}

describe('EthBridger (compat)', () => {
  let network: ArbitrumNetwork

  beforeEach(() => {
    network = makeNetwork()
  })

  describe('constructor', () => {
    it('creates an instance from a network object', () => {
      const bridger = new EthBridger(network)
      expect(bridger.childNetwork).to.deep.equal(network)
    })

    it('sets nativeToken from the network', () => {
      const bridger = new EthBridger(network)
      expect(bridger.nativeToken).to.be.undefined
    })

    it('sets nativeToken when network has one', () => {
      const customNetwork = makeNetwork({
        nativeToken: '0x1234567890123456789012345678901234567890',
      })
      const bridger = new EthBridger(customNetwork)
      expect(bridger.nativeToken).to.eq(
        '0x1234567890123456789012345678901234567890'
      )
    })
  })

  describe('fromProvider', () => {
    it('creates an instance from a provider that returns a known chain id', async () => {
      const mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 42161 }),
      } as unknown as providers.Provider

      const bridger = await EthBridger.fromProvider(mockProvider)
      expect(bridger.childNetwork.chainId).to.eq(42161)
    })
  })

  describe('getDepositRequest', () => {
    it('returns a transaction request for ETH deposit', async () => {
      const bridger = new EthBridger(network)
      const amount = BigNumber.from('1000000000000000000') // 1 ETH
      const from = '0x1234567890123456789012345678901234567890'

      const result = await bridger.getDepositRequest({ amount, from })

      expect(result.txRequest).to.be.an('object')
      expect(result.txRequest.to).to.eq(network.ethBridge.inbox)
      expect(result.txRequest.from).to.eq(from)
      // For ETH native chains, value should be the deposit amount
      expect(BigNumber.from(result.txRequest.value).eq(amount)).to.be.true
    })
  })

  describe('getWithdrawalRequest', () => {
    it('returns a transaction request for ETH withdrawal', async () => {
      const bridger = new EthBridger(network)
      const amount = BigNumber.from('500000000000000000') // 0.5 ETH
      const from = '0x1234567890123456789012345678901234567890'
      const destinationAddress = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'

      const result = await bridger.getWithdrawalRequest({
        amount,
        from,
        destinationAddress,
      })

      expect(result.txRequest).to.be.an('object')
      expect(result.txRequest.to.toLowerCase()).to.eq(
        '0x0000000000000000000000000000000000000064'
      )
      expect(result.txRequest.from).to.eq(from)
      expect(BigNumber.from(result.txRequest.value).eq(amount)).to.be.true
    })
  })

  describe('getApproveGasTokenRequest', () => {
    it('throws for ETH-native chains', () => {
      const bridger = new EthBridger(network)
      expect(() => bridger.getApproveGasTokenRequest()).to.throw(
        'chain uses ETH as its native/gas token'
      )
    })

    it('returns approve tx for custom gas token chains', () => {
      const customNetwork = makeNetwork({
        nativeToken: '0x1234567890123456789012345678901234567890',
      })
      const bridger = new EthBridger(customNetwork)
      const result = bridger.getApproveGasTokenRequest()

      expect(result.to).to.eq('0x1234567890123456789012345678901234567890')
      expect(result.data).to.be.a('string')
      expect(BigNumber.from(result.value).eq(0)).to.be.true
    })
  })

  describe('nativeTokenIsEth', () => {
    it('returns true when no native token is set', () => {
      const bridger = new EthBridger(network)
      // Access via the deposit request behavior (no native token approval needed)
      expect(() => bridger.getApproveGasTokenRequest()).to.throw(
        'chain uses ETH as its native/gas token'
      )
    })
  })
})
