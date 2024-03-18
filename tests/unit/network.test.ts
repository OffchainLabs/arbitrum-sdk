import { expect } from 'chai'
import {
  resetNetworksToDefault,
  addCustomChain,
  getParentChain,
  getChildChain,
  parentChains,
  childChains,
} from '../../src/lib/dataEntities/networks'

const ethereumMainnetChainId = 1
const arbitrumOneChainId = 42161

const mockL1ChainId = 111111
const mockL2ChainId = 222222
const mockL3ChainId = 99999999

describe('Chains', async () => {
  beforeEach(async () => {
    resetNetworksToDefault()
  })

  describe('adding chains', () => {
    it('adds a custom parent chain', async function () {
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const customChildChain = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        partnerChainID: ethereumMainnetChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({ customL2Network: customChildChain })

      expect(await getChildChain(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const parentChain = await getParentChain(customChildChain.partnerChainID)
      expect(parentChain.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const childChain = await getChildChain(customChildChain.chainID)
      expect(childChain.partnerChainID).to.equal(ethereumMainnetChainId)
    })

    it('adds a custom parent and child chain', async function () {
      const ethereumMainnet = await getParentChain(ethereumMainnetChainId)
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const customParentChain = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customChildChain = {
        ...arbitrumOne,
        partnerChainID: mockL1ChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({
        customL1Network: customParentChain,
        customL2Network: customChildChain,
      })

      expect(await getParentChain(mockL1ChainId)).to.be.ok
      expect(await getChildChain(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const parentChain = await getParentChain(mockL1ChainId)
      expect(parentChain.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const childChain = await getChildChain(customChildChain.chainID)
      expect(childChain.partnerChainID).to.equal(mockL1ChainId)
    })

    it('adds a custom orbit chain', async function () {
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const customChildChain = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({ customL2Network: customChildChain })

      expect(await getChildChain(mockL3ChainId)).to.be.ok

      // assert network was added as child
      const childChain = await getChildChain(customChildChain.partnerChainID)
      expect(childChain.partnerChainIDs).to.include(mockL3ChainId)
      // assert network has correct parent
      const orbitChain = await getChildChain(mockL3ChainId)
      expect(orbitChain.partnerChainID).to.equal(arbitrumOneChainId)
    })

    it('adds a custom L1, parent, and child chains', async function () {
      const ethereumMainnet = await getParentChain(ethereumMainnetChainId)
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const customParentChain = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customChildChain = {
        ...arbitrumOne,
        chainID: mockL2ChainId,
        partnerChainID: mockL1ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({
        customL1Network: customParentChain,
        customL2Network: customChildChain,
      })

      expect(await getParentChain(mockL1ChainId)).to.be.ok
      expect(await getChildChain(mockL2ChainId)).to.be.ok

      // assert network was added as child
      const parentChain = await getParentChain(mockL1ChainId)
      expect(parentChain.partnerChainIDs).to.include(mockL2ChainId)
      // assert network has correct parent
      const childChain = await getChildChain(mockL2ChainId)
      expect(childChain.partnerChainID).to.equal(mockL1ChainId)

      const customOrbitChain = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({ customL2Network: customOrbitChain })

      expect(await getChildChain(mockL3ChainId)).to.be.ok

      // assert network was added as child
      const childChainAgain = await getChildChain(mockL2ChainId)
      expect(childChainAgain.partnerChainIDs).to.include(mockL3ChainId)
      // assert network has correct parent
      const orbitChain = await getChildChain(mockL3ChainId)
      expect(orbitChain.partnerChainID).to.equal(mockL2ChainId)
    })

    it('fails to add a custom L1 and parent chain if they do not match', async function () {
      const ethereumMainnet = await getParentChain(ethereumMainnetChainId)
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const wrongPartnerChainId = 1241244

      const customParentChain = {
        ...ethereumMainnet,
        chainID: mockL1ChainId,
        isArbitrum: false,
        isCustom: true,
      } as const

      const customChildChain = {
        ...arbitrumOne,
        partnerChainID: wrongPartnerChainId,
        chainID: mockL2ChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      try {
        addCustomChain({
          customL1Network: customParentChain,
          customL2Network: customChildChain,
        })
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Partner chain id for parent chain ${customChildChain.chainID} doesn't match the provided L1 chain. Expected ${customParentChain.chainID} but got ${wrongPartnerChainId}.`
        )
      }
    })

    it('fails to add a custom orbit chain without previously registering parent chain', async function () {
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      try {
        addCustomChain({
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
          `Chain ${mockL3ChainId}'s parent chain ${mockL2ChainId} is not recognized`
        )
      }
    })
  })

  describe('fetching networks', () => {
    it('successfully fetches an L1 network with `getParentChain`', async function () {
      const network = await getParentChain(ethereumMainnetChainId)
      expect(network.chainID).to.be.eq(ethereumMainnetChainId)
    })

    it('successfully fetches an parent chain with `getChildChain`', async function () {
      const network = await getChildChain(arbitrumOneChainId)
      expect(network.chainID).to.be.eq(arbitrumOneChainId)
    })

    it('fails to fetch a registered parent chain with `getParentChain`', async function () {
      try {
        await getParentChain(arbitrumOneChainId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized chain ${arbitrumOneChainId}.`
        )
      }
    })

    it('fails to fetch a registered L1 network with `getChildChain`', async function () {
      try {
        await getChildChain(ethereumMainnetChainId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized chain ${ethereumMainnetChainId}.`
        )
      }
    })

    it('successfully fetches an L3 chain with `getChildChain`', async function () {
      const arbitrumOne = await getChildChain(arbitrumOneChainId)

      const customOrbitChain = {
        ...arbitrumOne,
        chainID: mockL3ChainId,
        partnerChainID: arbitrumOneChainId,
        isArbitrum: true,
        isCustom: true,
      } as const

      addCustomChain({ customL2Network: customOrbitChain })

      const orbitChain = await getChildChain(mockL3ChainId)
      expect(orbitChain.chainID).to.be.eq(mockL3ChainId)
      // assert network has correct parent
      expect(orbitChain.partnerChainID).to.equal(arbitrumOneChainId)

      // assert network was added as child
      const childChain = await getChildChain(customOrbitChain.partnerChainID)
      expect(childChain.partnerChainIDs).to.include(mockL3ChainId)
    })

    it('fails to fetch an unrecognized L1 chain', async () => {
      const chainId = 9999

      try {
        await getParentChain(chainId)
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized chain ${chainId}.`
        )
      }
    })

    it('fails to fetch an unrecognized L2/L3 chain', async () => {
      const chainId = 9999

      try {
        await getChildChain(chainId)
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized chain ${chainId}.`
        )
      }
    })
  })

  describe('returns correct networks', () => {
    // todo: this could be a snapshot test
    it('returns correct L1 chains', () => {
      const parentChainsEntries = Object.entries(parentChains)
      const parentChainsKeys = parentChainsEntries.map(([key]) => key)

      const expected = [1, 1338, 5, 11155111].map(id => id.toString())

      expect(parentChainsKeys).to.have.length(expected.length)
      expect(parentChainsKeys).to.have.members(expected)
    })

    // todo: this could be a snapshot test
    it('returns correct parent chains', () => {
      const childChainsEntries = Object.entries(childChains)
      const childChainsKeys = childChainsEntries.map(([key]) => key)

      const expected = [42161, 421613, 42170, 421614, 23011913].map(id =>
        id.toString()
      )

      expect(childChainsKeys).to.have.length(expected.length)
      expect(childChainsKeys).to.have.members(expected)
    })
  })
})
