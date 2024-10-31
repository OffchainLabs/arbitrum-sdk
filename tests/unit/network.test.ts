import { expect } from 'chai'
import {
  resetNetworksToDefault,
  registerCustomArbitrumNetwork,
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  getMulticallAddress,
  isArbitrumNetworkNativeTokenEther,
  ArbitrumNetwork,
} from '../../src/lib/dataEntities/networks'
import { SignerOrProvider } from '../../src/lib/dataEntities/signerOrProvider'
import { constants } from 'ethers'

const ethereumMainnetChainId = 1
const arbitrumOneChainId = 42161

const mockL2ChainId = 222222
const mockL3ChainId = 99999999

describe('Networks', async () => {
  beforeEach(async () => {
    resetNetworksToDefault()
  })

  describe('adding networks', () => {
    it('adds a custom L2 network', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork = {
        ...arbitrumOne,
        chainId: mockL2ChainId,
        parentChainId: ethereumMainnetChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      registerCustomArbitrumNetwork(customArbitrumNetwork)

      expect(await getArbitrumNetwork(mockL2ChainId)).to.be.ok

      // assert network has correct parent
      const arbitrumNetwork = await getArbitrumNetwork(
        customArbitrumNetwork.chainId
      )
      expect(arbitrumNetwork.parentChainId).to.equal(ethereumMainnetChainId)
    })

    it('adds a custom L3 network', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork = {
        ...arbitrumOne,
        chainId: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      registerCustomArbitrumNetwork(customArbitrumNetwork)

      expect(await getArbitrumNetwork(mockL3ChainId)).to.be.ok

      // assert network has correct parent
      const l3Network = await getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.parentChainId).to.equal(arbitrumOneChainId)
    })
  })

  describe('fetching networks', () => {
    it('successfully fetches an Arbitrum network with `getArbitrumNetwork`', async function () {
      const network = await getArbitrumNetwork(arbitrumOneChainId)
      expect(network.chainId).to.be.eq(arbitrumOneChainId)
    })

    it('fails to fetch a registered L1 network with `getArbitrumNetwork`', async function () {
      try {
        await getArbitrumNetwork(ethereumMainnetChainId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${ethereumMainnetChainId}.`
        )
      }
    })

    it('successfully fetches an L3 chain with `getArbitrumNetwork`', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customL3Network = {
        ...arbitrumOne,
        chainId: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      registerCustomArbitrumNetwork(customL3Network)

      const l3Network = await getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.chainId).to.be.eq(mockL3ChainId)
      // assert network has correct parent
      expect(l3Network.parentChainId).to.equal(arbitrumOneChainId)
    })

    it('fails to fetch an unrecognized L2/L3 network', async () => {
      const chainId = 9999

      try {
        await getArbitrumNetwork(chainId)
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${chainId}.`
        )
      }
    })
  })

  describe('returns correct networks', () => {
    // todo: this could be a snapshot test
    it('returns correct Arbitrum networks', () => {
      const arbitrumNetworksIds = getArbitrumNetworks().map(n => n.chainId)
      const expected = [42161, 42170, 421614]

      expect(arbitrumNetworksIds).to.have.length(expected.length)
      expect(arbitrumNetworksIds).to.have.members(expected)
    })
  })

  describe('getChildrenForNetwork', () => {
    it('returns correct children for ethereum mainnet', () => {
      const children = getChildrenForNetwork(1).map(c => c.chainId)
      expect(children).to.have.members([42161, 42170])
    })

    it('returns correct children for arbitrum one', () => {
      const children = getChildrenForNetwork(42161).map(c => c.chainId)
      expect(children).to.have.members([])
    })

    it('returns correct children for arbitrum nova', () => {
      const children = getChildrenForNetwork(42170).map(c => c.chainId)
      expect(children).to.have.members([])
    })

    it('returns correct children for sepolia', () => {
      const children = getChildrenForNetwork(11155111).map(c => c.chainId)
      expect(children).to.have.members([421614])
    })

    it('returns correct children for arbitrum sepolia', () => {
      const children = getChildrenForNetwork(421614).map(c => c.chainId)
      expect(children).to.have.members([])
    })
  })

  describe('isParentNetwork', () => {
    it('returns correct value for ethereum mainnet', () => {
      expect(isParentNetwork(1)).to.equal(true)
    })

    it('returns correct value for arbitrum one', () => {
      expect(isParentNetwork(42161)).to.equal(false)
    })

    it('returns correct value for arbitrum nova', () => {
      expect(isParentNetwork(42170)).to.equal(false)
    })

    it('returns correct value for sepolia', () => {
      expect(isParentNetwork(11155111)).to.equal(true)
    })

    it('returns correct value for arbitrum sepolia', () => {
      expect(isParentNetwork(421614)).to.equal(false)
    })
  })

  describe('getMulticallAddress', () => {
    it('returns correct value for ethereum mainnet', async () => {
      const multicall = await getMulticallAddress(1)
      expect(multicall).to.equal('0x5ba1e12693dc8f9c48aad8770482f4739beed696')
    })

    it('returns correct value for arbitrum one', async () => {
      const multicall = await getMulticallAddress(42161)
      expect(multicall).to.equal('0x842eC2c7D803033Edf55E478F461FC547Bc54EB2')
    })

    it('returns correct value for arbitrum nova', async () => {
      const multicall = await getMulticallAddress(42170)
      expect(multicall).to.equal('0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86')
    })

    it('returns correct value for sepolia', async () => {
      const multicall = await getMulticallAddress(11155111)
      expect(multicall).to.equal('0xded9AD2E65F3c4315745dD915Dbe0A4Df61b2320')
    })

    it('returns correct value for arbitrum sepolia', async () => {
      const multicall = await getMulticallAddress(421614)
      expect(multicall).to.equal('0xA115146782b7143fAdB3065D86eACB54c169d092')
    })
  })

  describe('async/sync usage of the getArbitrumNetwork function', () => {
    it('returns ArbitrumNetwork for chain ID', () => {
      const network = getArbitrumNetwork(arbitrumOneChainId)
      // TypeScript should infer this as ArbitrumNetwork, not Promise<ArbitrumNetwork>
      expect(network.chainId).to.equal(arbitrumOneChainId)
    })

    it('returns Promise<ArbitrumNetwork> for SignerOrProvider input', async () => {
      const networkPromise = getArbitrumNetwork({
        getNetwork: async () => ({ chainId: arbitrumOneChainId }),
      } as unknown as SignerOrProvider)
      // TypeScript should infer this as Promise<ArbitrumNetwork>
      expect(networkPromise).to.be.an.instanceOf(Promise)
      const network = await networkPromise
      expect(network.chainId).to.equal(arbitrumOneChainId)
    })
  })

  describe('isArbitrumNetworkNativeTokenEther', () => {
    it('returns `true` when `nativeToken` is undefined', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: undefined,
        } as ArbitrumNetwork)
      ).to.equal(true)
    })

    it('returns `true` when `nativeToken` is zero address', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: constants.AddressZero,
        } as ArbitrumNetwork)
      ).to.equal(true)
    })

    it('returns `false` when `nativeToken` is a valid address', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        } as ArbitrumNetwork)
      ).to.equal(false)
    })
  })
})
