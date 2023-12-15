import { expect } from 'chai'
import {
  getNetwork,
  resetNetworksToDefault,
  addCustomNetwork,
  getL1Network,
  getL2Network,
} from '../../src/lib/dataEntities/networks'

const mainnetId = 1
const arbOneId = 42161
const arbNovaId = 42170
const mockL1ChainId = 111111
const mockL2ChainId = 222222
const mockOrbitChainId = 99999999

describe('Networks', () => {
  const fetchErrorMessage =
    'Network fetched successfully but the chain ID is invalid.'

  beforeEach(async () => {
    resetNetworksToDefault()
  })

  describe('adding networks', () => {
    it('adds a custom L2 network', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)
      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: false,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getNetwork(mockL2ChainId, 2)).to.be.ok
    })

    it('adds a custom L1 and L2 network', async function () {
      const ethNetwork = await getL1Network(mainnetId)
      const arbOneNetwork = await getL2Network(arbOneId)
      const mockCustomNetwork = {
        customL1Network: {
          ...ethNetwork,
          chainID: mockL1ChainId,
          isArbitrum: false,
          isCustom: true,
          isOrbit: false,
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: false,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getNetwork(mockL1ChainId, 1)).to.be.ok
      expect(await getNetwork(mockL2ChainId, 2)).to.be.ok
    })

    it('adds a custom Orbit chain', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: arbOneId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getNetwork(mockOrbitChainId, 2)).to.be.ok
    })

    it('adds a custom L1 and Orbit chain', async function () {
      const ethNetwork = await getL1Network(mainnetId)
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL1Network: {
          ...ethNetwork,
          chainID: mockL1ChainId,
          isArbitrum: false,
          isCustom: true,
          isOrbit: false,
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getNetwork(mockL1ChainId, 1)).to.be.ok
      expect(await getNetwork(mockL2ChainId, 2)).to.be.ok
    })

    it('adds a custom L1, L2, and L3', async function () {
      const ethNetwork = await getL1Network(mainnetId)
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL1Network: {
          ...ethNetwork,
          chainID: mockL1ChainId,
          isArbitrum: false,
          isCustom: true,
          isOrbit: false,
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: false,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      const mockOrbitNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockOrbitNetwork)

      expect(await getNetwork(mockL1ChainId, 1)).to.be.ok
      expect(await getNetwork(mockL2ChainId, 2)).to.be.ok
      expect(await getNetwork(mockOrbitChainId, 2)).to.be.ok
    })
  })

  describe('fetching networks', () => {
    it('successfully fetches an L1 network with `getL1Network`', async function () {
      const network = await getL1Network(mainnetId)
      expect(network.chainID, fetchErrorMessage).to.be.eq(mainnetId)
    })

    it('fails to fetch an L2 network that is not a parent with `getL1Network`', async function () {
      let network
      try {
        network = await getL1Network(arbNovaId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${arbNovaId}.`
        )
      } finally {
        expect(network, '`getL1Network` returned a result for an L2 network.')
          .to.be.undefined
      }
    })

    it('successfully fetches an L2 network with `getL2Network`', async function () {
      const network = await getL2Network(arbOneId)
      expect(network.chainID, fetchErrorMessage).to.be.eq(arbOneId)
    })

    it('fails to fetch an L1 network with `getL2Network`', async function () {
      let network
      try {
        network = await getL2Network(mainnetId)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${mainnetId}.`
        )
      } finally {
        expect(network, '`getL2Network` returned a result for an L1 network.')
          .to.be.undefined
      }
    })

    it('successfully fetches a parent chain with `getNetwork`', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: arbOneId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)
      const parentChain = await getNetwork(arbOneId, 1)
      expect(parentChain.chainID, fetchErrorMessage).to.be.eq(arbOneId)
    })

    it('fails to fetch an Orbit chain with `getNetwork` because it is in the wrong layer', async function () {
      let parentChain
      try {
        parentChain = await getNetwork(mockOrbitChainId, 1)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${mockOrbitChainId}.`
        )
      } finally {
        expect(
          parentChain,
          '`getNetwork` returned a result for an Orbit chain.'
        ).to.be.undefined
      }
    })

    it('successfully fetches an Orbit chain with `getNetwork`', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: arbOneId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)
      const chain = await getNetwork(mockOrbitChainId, 2)
      expect(chain.chainID, fetchErrorMessage).to.be.eq(mockOrbitChainId)
    })

    it('fails to fetch a parent chain with `getNetwork` because it is the wrong layer', async function () {
      let chain
      try {
        chain = await getNetwork(mainnetId, 2)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${mainnetId}.`
        )
      } finally {
        expect(chain, '`getNetwork` returned a result for a parent chain.').to
          .be.undefined
      }
    })

    it('fails to fetch an unrecognized L1 network', async () => {
      const chainId = 9999
      try {
        await getNetwork(chainId, 1)
        expect.fail('Expected error was not thrown')
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${chainId}.`
        )
      }
    })

    it('fails to fetch an unrecognized L2 network', async () => {
      const chainId = 9999
      try {
        await getNetwork(chainId, 2)
        expect.fail('Expected error was not thrown')
      } catch (err) {
        expect(err).to.be.instanceOf(Error)
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${chainId}.`
        )
      }
    })

    it('fails to fetch a network in L1 until a child is added', async function () {
      let parentChain
      try {
        parentChain = await getNetwork(arbOneId, 1)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          `Unrecognized network ${arbOneId}.`
        )
      } finally {
        expect(
          parentChain,
          '`getNetwork` returned a result for an Orbit chain.'
        ).to.be.undefined
      }

      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: arbOneId,
          isArbitrum: true,
          isCustom: true,
          isOrbit: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)
      parentChain = await getNetwork(arbOneId, 1)
      expect(parentChain.chainID, fetchErrorMessage).to.be.eq(arbOneId)
    })
  })
})
