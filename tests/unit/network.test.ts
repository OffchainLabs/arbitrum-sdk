import {
  getL1Network,
  addCustomChain,
  getL2Network,
  getParentChain,
  getChain,
} from '../../src'

import { expect } from 'chai'

const mainnetId = 1
const arbOneId = 42161
const mockOrbitChainId = 99999999

describe('Network', () => {
  const fetchErrorMessage =
    'Network fetched successfully but the chain ID is invalid.'

  it('Adds a custom Orbit chain', async function () {
    const arbOneNetwork = await getL2Network(arbOneId)

    addCustomChain({
      customChain: {
        // we partially copy Arbitrum One network because we only want to mimic a custom chain
        ...arbOneNetwork,
        chainID: mockOrbitChainId,
        partnerChainID: arbOneId,
        isArbitrum: true,
        isCustom: true,
      },
    })
  })

  it('Successfully fetches an L1 network with `getL1Network`', async function () {
    const network = await getL1Network(mainnetId)
    expect(network.chainID, fetchErrorMessage).to.be.eq(mainnetId)
  })

  it('Fails to fetch an L2 network with `getL1Network`', async function () {
    let network
    try {
      network = await getL1Network(arbOneId)
    } catch (err) {
      // should fail
      expect(err).to.be.an('error')
      expect((err as Error).message).to.be.eq(
        `Unrecognized network ${arbOneId}.`
      )
    } finally {
      expect(network, '`getL1Network` returned a result for an L2 network.').to
        .be.undefined
    }
  })

  it('Successfully fetches an L2 network with `getL2Network`', async function () {
    const network = await getL2Network(arbOneId)
    expect(network.chainID, fetchErrorMessage).to.be.eq(arbOneId)
  })

  it('Fails to fetch an L1 network with `getL2Network`', async function () {
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
      expect(network, '`getL2Network` returned a result for an L1 network.').to
        .be.undefined
    }
  })

  it('Successfully fetches a parent chain with `getParentChain`', async function () {
    const parentChain = await getParentChain(arbOneId)
    expect(parentChain.chainID, fetchErrorMessage).to.be.eq(arbOneId)
  })

  it('Fails to fetch an Orbit chain with `getParentChain`', async function () {
    let parentChain
    try {
      parentChain = await getParentChain(mockOrbitChainId)
    } catch (err) {
      // should fail
      expect(err).to.be.an('error')
      expect((err as Error).message).to.be.eq(
        `Unrecognized ParentChain ${mockOrbitChainId}.`
      )
    } finally {
      expect(
        parentChain,
        '`getParentChain` returned a result for an Orbit chain.'
      ).to.be.undefined
    }
  })

  it('Successfully fetches an Orbit chain with `getChain`', async function () {
    const chain = await getChain(mockOrbitChainId)
    expect(chain.chainID, fetchErrorMessage).to.be.eq(mockOrbitChainId)
  })

  it('Fails to fetch a parent chain with `getChain`', async function () {
    let chain
    try {
      chain = await getChain(mainnetId)
    } catch (err) {
      // should fail
      expect(err).to.be.an('error')
      expect((err as Error).message).to.be.eq(
        `Unrecognized Chain ${mainnetId}.`
      )
    } finally {
      expect(chain, '`getChain` returned a result for a parent chain.').to.be
        .undefined
    }
  })
})
