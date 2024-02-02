import { expect } from 'chai'
import {
  getNetwork,
  resetNetworksToDefault,
  addCustomNetwork,
  getL1Network,
  getL2Network,
  l1Networks,
  l2Networks,
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
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getL2Network(mockL2ChainId)).to.be.ok
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
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getL2Network(mockL2ChainId)).to.be.ok
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
        },
      } as const

      addCustomNetwork(mockCustomNetwork)

      expect(await getNetwork(mockOrbitChainId, 2)).to.be.ok
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
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockL2ChainId,
          isArbitrum: true,
          isCustom: true,
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
        },
      } as const

      addCustomNetwork(mockOrbitNetwork)

      expect(await getL1Network(mockL1ChainId)).to.be.ok
      expect(await getL2Network(mockL2ChainId)).to.be.ok
      expect(await getL2Network(mockOrbitChainId)).to.be.ok
    })

    it('fails to add an Orbit chain paired with default L1', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: mainnetId,
          isArbitrum: true,
          isCustom: true,
        },
      } as const

      try {
        addCustomNetwork(mockCustomNetwork)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          'Orbit chains must be paired with an L2 chain'
        )
      }
    })

    it('fails to add a custom L1 paired with an L3', async function () {
      const ethNetwork = await getL1Network(mainnetId)
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL1Network: {
          ...ethNetwork,
          chainID: mockL1ChainId,
          isArbitrum: false,
          isCustom: true,
        },
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: mockL1ChainId,
          isArbitrum: true,
          isCustom: true,
        },
      } as const

      try {
        addCustomNetwork(mockCustomNetwork)
      } catch (err) {
        // should fail
        expect(err).to.be.an('error')
        expect((err as Error).message).to.be.eq(
          'Orbit chains must be paired with an L2 chain'
        )
      }
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

    it('fails to fetch an Orbit chain with `getL1Network`', async function () {
      let parentChain
      try {
        parentChain = await getL1Network(mockOrbitChainId)
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

    it('successfully fetches an Orbit chain with `getL2Network`', async function () {
      const arbOneNetwork = await getL2Network(arbOneId)

      const mockCustomNetwork = {
        customL2Network: {
          ...arbOneNetwork,
          chainID: mockOrbitChainId,
          partnerChainID: arbOneId,
          isArbitrum: true,
          isCustom: true,
        },
      } as const

      addCustomNetwork(mockCustomNetwork)
      const chain = await getNetwork(mockOrbitChainId, 2)
      expect(chain.chainID, fetchErrorMessage).to.be.eq(mockOrbitChainId)
    })

    it('fails to fetch an unrecognized L1 network', async () => {
      const chainId = 9999
      try {
        await getL1Network(chainId)
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
        await getL2Network(chainId)
        expect.fail('Expected error was not thrown')
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
