import { expect } from 'chai'
import {
  resetNetworksToDefault,
  addCustomNetwork,
  getL1Network,
  getArbitrumNetwork,
  l1Networks,
  l2Networks as arbitrumNetworks,
  getChildrenForNetwork,
  isParentChain,
  getMulticall,
} from '../../src/lib/dataEntities/networks'

const ethereumMainnetChainId = 1
const arbitrumOneChainId = 42161

const mockL1ChainId = 111111
const mockL2ChainId = 222222
const mockL3ChainId = 99999999

describe('Networks', async () => {
  beforeEach(async () => {
    resetNetworksToDefault()
  })

  describe('adding networks', () => {
    it('adds a custom Arbitrum network', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        parentChainId: ethereumMainnetChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customArbitrumNetwork })

      expect(await getArbitrumNetwork(mockL2ChainId)).to.be.ok

      // assert network has correct parent
      const arbitrumNetwork = await getArbitrumNetwork(
        customArbitrumNetwork.chainID
      )
      expect(arbitrumNetwork.parentChainId).to.equal(ethereumMainnetChainId)
    })

    it('adds a custom L1 and Arbitrum network', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customArbitrumNetwork = {
        ...arbitrumOne,
        parentChainId: mockL1ChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL1Network, customArbitrumNetwork })

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getArbitrumNetwork(mockL2ChainId)).to.be.ok

      // assert network has correct parent
      const arbitrumNetwork = await getArbitrumNetwork(
        customArbitrumNetwork.chainID
      )
      expect(arbitrumNetwork.parentChainId).to.equal(mockL1ChainId)
    })

    it('adds a custom L3 network', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customArbitrumNetwork })

      expect(await getArbitrumNetwork(mockL3ChainId)).to.be.ok

      // assert network has correct parent
      const l3Network = await getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.parentChainId).to.equal(arbitrumOneChainId)
    })

    it('adds a custom L1, L2, and L3 network', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customArbitrumNetwork = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        parentChainId: mockL1ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL1Network, customArbitrumNetwork })

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getArbitrumNetwork(mockL2ChainId)).to.be.ok

      // assert network has correct parent
      const arbitrumNetwork = await getArbitrumNetwork(mockL2ChainId)
      expect(arbitrumNetwork.parentChainId).to.equal(mockL1ChainId)

      const customL3Network = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        parentChainId: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customArbitrumNetwork: customL3Network })

      expect(await getArbitrumNetwork(mockL3ChainId)).to.be.ok

      // assert network has correct parent
      const l3Network = await getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.parentChainId).to.equal(mockL2ChainId)
    })

    it('fails to add a custom L1 and Arbitrum network if they do not match', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      const wrongParentChainId = 1241244

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customArbitrumNetwork = {
        ...arbitrumOne,
        parentChainId: wrongParentChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      try {
        addCustomNetwork({ customL1Network, customArbitrumNetwork })
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Partner chain id for Arbitrum network ${customArbitrumNetwork.chainID} doesn't match the provided L1 network. Expected ${customL1Network.chainID} but got ${wrongParentChainId}.`
        )
      }
    })

    it('fails to add a custom L3 without previously registering L2', async function () {
      const arbitrumOne = await getArbitrumNetwork(arbitrumOneChainId)

      try {
        addCustomNetwork({
          customArbitrumNetwork: {
            ...arbitrumOne,
            chainID: mockL3ChainId,
            parentChainId: mockL2ChainId,
            isArbitrum: true,
            isCustom: true,
          },
        })
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Network ${mockL3ChainId}'s parent network ${mockL2ChainId} is not recognized`
        )
      }
    })
  })

  describe('fetching networks', () => {
    it('successfully fetches an L1 network with `getL1Network`', async function () {
      const network = await getL1Network(ethereumMainnetChainId)
      expect(network.chainID).to.be.eq(ethereumMainnetChainId)
    })

    it('successfully fetches an Arbitrum network with `getArbitrumNetwork`', async function () {
      const network = await getArbitrumNetwork(arbitrumOneChainId)
      expect(network.chainID).to.be.eq(arbitrumOneChainId)
    })

    it('fails to fetch a registered Arbitrum network with `getL1Network`', async function () {
      try {
        await getL1Network(arbitrumOneChainId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${arbitrumOneChainId}.`
        )
      }
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
        chainID: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customArbitrumNetwork: customL3Network })

      const l3Network = await getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.chainID).to.be.eq(mockL3ChainId)
      // assert network has correct parent
      expect(l3Network.parentChainId).to.equal(arbitrumOneChainId)
    })

    it('fails to fetch an unrecognized L1 network', async () => {
      const chainId = 9999

      try {
        await getL1Network(chainId)
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${chainId}.`
        )
      }
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
    it('returns correct L1 networks', () => {
      const l1NetworksEntries = Object.entries(l1Networks)
      const l1NetworksKeys = l1NetworksEntries.map(([key]) => key)

      const expected = [1, 1338, 17000, 11155111].map(id => id.toString())

      expect(l1NetworksKeys).to.have.length(expected.length)
      expect(l1NetworksKeys).to.have.members(expected)
    })

    // todo: this could be a snapshot test
    it('returns correct Arbitrum networks', () => {
      const arbitrumNetworksEntries = Object.entries(arbitrumNetworks)
      const arbitrumNetworksKeys = arbitrumNetworksEntries.map(([key]) => key)

      const expected = [42161, 42170, 421614, 23011913]
        //
        .map(id => id.toString())

      expect(arbitrumNetworksKeys).to.have.length(expected.length)
      expect(arbitrumNetworksKeys).to.have.members(expected)
    })
  })

  describe('getChildrenForNetwork', () => {
    it('returns correct children for ethereum mainnet', () => {
      const children = getChildrenForNetwork(1).map(c => c.chainID)
      expect(children).to.have.members([42161, 42170])
    })

    it('returns correct children for arbitrum one', () => {
      const children = getChildrenForNetwork(42161).map(c => c.chainID)
      expect(children).to.have.members([])
    })

    it('returns correct children for arbitrum nova', () => {
      const children = getChildrenForNetwork(42170).map(c => c.chainID)
      expect(children).to.have.members([])
    })

    it('returns correct children for sepolia', () => {
      const children = getChildrenForNetwork(11155111).map(c => c.chainID)
      expect(children).to.have.members([421614])
    })

    it('returns correct children for arbitrum sepolia', () => {
      const children = getChildrenForNetwork(421614).map(c => c.chainID)
      expect(children).to.have.members([23011913])
    })
  })

  describe('isParentChain', () => {
    it('returns correct value for ethereum mainnet', () => {
      expect(isParentChain(1)).to.equal(true)
    })

    it('returns correct value for arbitrum one', () => {
      expect(isParentChain(42161)).to.equal(false)
    })

    it('returns correct value for arbitrum nova', () => {
      expect(isParentChain(42170)).to.equal(false)
    })

    it('returns correct value for sepolia', () => {
      expect(isParentChain(11155111)).to.equal(true)
    })

    it('returns correct value for arbitrum sepolia', () => {
      expect(isParentChain(421614)).to.equal(true)
    })
  })

  describe('getMulticall', () => {
    it('returns correct value for ethereum mainnet', async () => {
      const multicall = await getMulticall(1)
      expect(multicall).to.equal('0x5ba1e12693dc8f9c48aad8770482f4739beed696')
    })

    it('returns correct value for arbitrum one', async () => {
      const multicall = await getMulticall(42161)
      expect(multicall).to.equal('0x842eC2c7D803033Edf55E478F461FC547Bc54EB2')
    })

    it('returns correct value for arbitrum nova', async () => {
      const multicall = await getMulticall(42170)
      expect(multicall).to.equal('0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86')
    })

    it('returns correct value for sepolia', async () => {
      const multicall = await getMulticall(11155111)
      expect(multicall).to.equal('0xded9AD2E65F3c4315745dD915Dbe0A4Df61b2320')
    })

    it('returns correct value for arbitrum sepolia', async () => {
      const multicall = await getMulticall(421614)
      expect(multicall).to.equal('0xA115146782b7143fAdB3065D86eACB54c169d092')
    })
  })
})
