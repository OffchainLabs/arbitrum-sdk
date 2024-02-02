import { expect } from 'chai'
import {
  resetNetworksToDefault,
  addCustomNetwork,
  getL1Network,
  getL2Network,
  l1Networks,
  l2Networks,
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
    it('adds a custom L2 network', async function () {
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const customL2Network = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        partnerChainID: ethereumMainnetChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL2Network })

      expect(await getL2Network(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const l1Network = await getL1Network(customL2Network.partnerChainID)
      expect(l1Network.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const l2Network = await getL2Network(customL2Network.chainID)
      expect(l2Network.partnerChainID).to.equal(ethereumMainnetChainId)
    })

    it('adds a custom L1 and L2 network', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customL2Network = {
        ...arbitrumOne,
        partnerChainID: mockL1ChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL1Network, customL2Network })

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getL2Network(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const l1Network = await getL1Network(mockL1ChainId)
      expect(l1Network.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const l2Network = await getL2Network(customL2Network.chainID)
      expect(l2Network.partnerChainID).to.equal(mockL1ChainId)
    })

    it('adds a custom L3 network', async function () {
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const customL2Network = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL2Network })

      expect(await getL2Network(mockL3ChainId)).to.be.ok

      // assert network was added as child
      const l2Network = await getL2Network(customL2Network.partnerChainID)
      expect(l2Network.partnerChainIDs).to.include(mockL3ChainId)
      // assert network has correct parent
      const l3Network = await getL2Network(mockL3ChainId)
      expect(l3Network.partnerChainID).to.equal(arbitrumOneChainId)
    })

    it('adds a custom L1, L2, and L3 network', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customL2Network = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        partnerChainID: mockL1ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL1Network, customL2Network })

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getL2Network(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const l1Network = await getL1Network(mockL1ChainId)
      expect(l1Network.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const l2Network = await getL2Network(mockL2ChainId)
      expect(l2Network.partnerChainID).to.equal(mockL1ChainId)

      const customL3Network = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL2Network: customL3Network })

      expect(await getL2Network(mockL3ChainId)).to.be.ok

      // assert network was added as child
      const l2NetworkAgain = await getL2Network(mockL2ChainId)
      expect(l2NetworkAgain.partnerChainIDs).to.include(mockL3ChainId)
      // assert network has correct parent
      const l3Network = await getL2Network(mockL3ChainId)
      expect(l3Network.partnerChainID).to.equal(mockL2ChainId)
    })

    it('fails to add a custom L1 and L2 network if they do not match', async function () {
      const ethereumMainnet = await getL1Network(ethereumMainnetChainId)
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const wrongPartnerChainId = 1241244

      const customL1Network = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customL2Network = {
        ...arbitrumOne,
        partnerChainID: wrongPartnerChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      try {
        addCustomNetwork({ customL1Network, customL2Network })
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Partner chain id for L2 network ${customL2Network.chainID} doesn't match the provided L1 network. Expected ${customL1Network.chainID} but got ${wrongPartnerChainId}.`
        )
      }
    })

    it('fails to add a custom L3 without previously registering L2', async function () {
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      try {
        addCustomNetwork({
          customL2Network: {
            ...arbitrumOne,
            chainID: mockL3ChainId,
            partnerChainID: mockL2ChainId,
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

    it('successfully fetches an L2 network with `getL2Network`', async function () {
      const network = await getL2Network(arbitrumOneChainId)
      expect(network.chainID).to.be.eq(arbitrumOneChainId)
    })

    it('fails to fetch a registered L2 network with `getL1Network`', async function () {
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

    it('fails to fetch a registered L1 network with `getL2Network`', async function () {
      try {
        await getL2Network(ethereumMainnetChainId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${ethereumMainnetChainId}.`
        )
      }
    })

    it('successfully fetches an L3 chain with `getL2Network`', async function () {
      const arbitrumOne = await getL2Network(arbitrumOneChainId)

      const customL3Network = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomNetwork({ customL2Network: customL3Network })

      const l3Network = await getL2Network(mockL3ChainId)
      expect(l3Network.chainID).to.be.eq(mockL3ChainId)
      // assert network has correct parent
      expect(l3Network.partnerChainID).to.equal(arbitrumOneChainId)

      // assert network was added as child
      const l2Network = await getL2Network(customL3Network.partnerChainID)
      expect(l2Network.partnerChainIDs).to.include(mockL3ChainId)
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
        await getL2Network(chainId)
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

      const expected = [1, 1338, 5, 11155111].map(id => id.toString())

      expect(l1NetworksKeys).to.have.length(expected.length)
      expect(l1NetworksKeys).to.have.members(expected)
    })

    // todo: this could be a snapshot test
    it('returns correct L2 networks', () => {
      const l2NetworksEntries = Object.entries(l2Networks)
      const l2NetworksKeys = l2NetworksEntries.map(([key]) => key)

      const expected = [42161, 421613, 42170, 421614, 23011913]
        //
        .map(id => id.toString())

      expect(l2NetworksKeys).to.have.length(expected.length)
      expect(l2NetworksKeys).to.have.members(expected)
    })
  })
})
