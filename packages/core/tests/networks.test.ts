import { describe, it, expect, beforeEach } from 'vitest'
import {
  getArbitrumNetwork,
  getArbitrumNetworks,
  getChildrenForNetwork,
  isParentNetwork,
  registerCustomArbitrumNetwork,
  resetNetworksToDefault,
  isArbitrumNetworkNativeTokenEther,
  assertArbitrumNetworkHasTokenBridge,
  getNitroGenesisBlock,
  getMulticallAddress,
  type ArbitrumNetwork,
} from '../src/networks'

const ethereumMainnetChainId = 1
const arbitrumOneChainId = 42161

const mockL2ChainId = 222222
const mockL3ChainId = 99999999

describe('Networks', () => {
  beforeEach(() => {
    resetNetworksToDefault()
  })

  describe('adding networks', () => {
    it('adds a custom L2 network', () => {
      const arbitrumOne = getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork: ArbitrumNetwork = {
        ...arbitrumOne,
        chainId: mockL2ChainId,
        parentChainId: ethereumMainnetChainId,
        isCustom: true,
      }

      registerCustomArbitrumNetwork(customArbitrumNetwork)

      expect(getArbitrumNetwork(mockL2ChainId)).toBeTruthy()

      const arbitrumNetwork = getArbitrumNetwork(
        customArbitrumNetwork.chainId
      )
      expect(arbitrumNetwork.parentChainId).toBe(ethereumMainnetChainId)
    })

    it('adds a custom L3 network', () => {
      const arbitrumOne = getArbitrumNetwork(arbitrumOneChainId)

      const customArbitrumNetwork: ArbitrumNetwork = {
        ...arbitrumOne,
        chainId: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isCustom: true,
      }

      registerCustomArbitrumNetwork(customArbitrumNetwork)

      expect(getArbitrumNetwork(mockL3ChainId)).toBeTruthy()

      const l3Network = getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.parentChainId).toBe(arbitrumOneChainId)
    })

    it('throws if isCustom is false', () => {
      const arbitrumOne = getArbitrumNetwork(arbitrumOneChainId)

      expect(() =>
        registerCustomArbitrumNetwork({
          ...arbitrumOne,
          chainId: mockL2ChainId,
          isCustom: false,
        })
      ).toThrow('must have isCustom flag set to true')
    })

    it('throws if throwIfAlreadyRegistered is true and network exists', () => {
      const arbitrumOne = getArbitrumNetwork(arbitrumOneChainId)

      const customNetwork: ArbitrumNetwork = {
        ...arbitrumOne,
        chainId: mockL2ChainId,
        isCustom: true,
      }

      registerCustomArbitrumNetwork(customNetwork)

      expect(() =>
        registerCustomArbitrumNetwork(customNetwork, {
          throwIfAlreadyRegistered: true,
        })
      ).toThrow(`Network ${mockL2ChainId} already included`)
    })
  })

  describe('fetching networks', () => {
    it('successfully fetches an Arbitrum network with getArbitrumNetwork', () => {
      const network = getArbitrumNetwork(arbitrumOneChainId)
      expect(network.chainId).toBe(arbitrumOneChainId)
    })

    it('returns ArbitrumNetwork synchronously for chain ID (not a Promise)', () => {
      const network = getArbitrumNetwork(arbitrumOneChainId)
      // Should be a plain object, not a Promise
      expect(network).not.toBeInstanceOf(Promise)
      expect(network.chainId).toBe(arbitrumOneChainId)
    })

    it('fetches Arbitrum Nova', () => {
      const network = getArbitrumNetwork(42170)
      expect(network.name).toBe('Arbitrum Nova')
      expect(network.parentChainId).toBe(1)
    })

    it('fails to fetch a non-Arbitrum network', () => {
      expect(() => getArbitrumNetwork(ethereumMainnetChainId)).toThrow(
        `Unrecognized network ${ethereumMainnetChainId}.`
      )
    })

    it('fails to fetch an unrecognized network', () => {
      const chainId = 9999
      expect(() => getArbitrumNetwork(chainId)).toThrow(
        `Unrecognized network ${chainId}.`
      )
    })

    it('successfully fetches a registered custom L3 chain', () => {
      const arbitrumOne = getArbitrumNetwork(arbitrumOneChainId)

      registerCustomArbitrumNetwork({
        ...arbitrumOne,
        chainId: mockL3ChainId,
        parentChainId: arbitrumOneChainId,
        isCustom: true,
      })

      const l3Network = getArbitrumNetwork(mockL3ChainId)
      expect(l3Network.chainId).toBe(mockL3ChainId)
      expect(l3Network.parentChainId).toBe(arbitrumOneChainId)
    })
  })

  describe('returns correct networks', () => {
    it('returns correct Arbitrum networks', () => {
      const arbitrumNetworksIds = getArbitrumNetworks().map(n => n.chainId)
      const expected = [42161, 42170, 421614]

      expect(arbitrumNetworksIds).toHaveLength(expected.length)
      expect(arbitrumNetworksIds.sort()).toEqual(expected.sort())
    })
  })

  describe('getChildrenForNetwork', () => {
    it('returns correct children for ethereum mainnet', () => {
      const children = getChildrenForNetwork(1).map(c => c.chainId)
      expect(children.sort()).toEqual([42161, 42170].sort())
    })

    it('returns correct children for arbitrum one', () => {
      const children = getChildrenForNetwork(42161).map(c => c.chainId)
      expect(children).toEqual([])
    })

    it('returns correct children for arbitrum nova', () => {
      const children = getChildrenForNetwork(42170).map(c => c.chainId)
      expect(children).toEqual([])
    })

    it('returns correct children for sepolia', () => {
      const children = getChildrenForNetwork(11155111).map(c => c.chainId)
      expect(children).toEqual([421614])
    })

    it('returns correct children for arbitrum sepolia', () => {
      const children = getChildrenForNetwork(421614).map(c => c.chainId)
      expect(children).toEqual([])
    })
  })

  describe('isParentNetwork', () => {
    it('returns true for ethereum mainnet', () => {
      expect(isParentNetwork(1)).toBe(true)
    })

    it('returns false for arbitrum one', () => {
      expect(isParentNetwork(42161)).toBe(false)
    })

    it('returns false for arbitrum nova', () => {
      expect(isParentNetwork(42170)).toBe(false)
    })

    it('returns true for sepolia', () => {
      expect(isParentNetwork(11155111)).toBe(true)
    })

    it('returns false for arbitrum sepolia', () => {
      expect(isParentNetwork(421614)).toBe(false)
    })
  })

  describe('getMulticallAddress', () => {
    it('returns correct value for ethereum mainnet', () => {
      const multicall = getMulticallAddress(1)
      expect(multicall).toBe('0x5ba1e12693dc8f9c48aad8770482f4739beed696')
    })

    it('returns correct value for arbitrum one', () => {
      const multicall = getMulticallAddress(42161)
      expect(multicall).toBe('0x842eC2c7D803033Edf55E478F461FC547Bc54EB2')
    })

    it('returns correct value for arbitrum nova', () => {
      const multicall = getMulticallAddress(42170)
      expect(multicall).toBe('0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86')
    })

    it('returns correct value for sepolia', () => {
      const multicall = getMulticallAddress(11155111)
      expect(multicall).toBe('0xded9AD2E65F3c4315745dD915Dbe0A4Df61b2320')
    })

    it('returns correct value for arbitrum sepolia', () => {
      const multicall = getMulticallAddress(421614)
      expect(multicall).toBe('0xA115146782b7143fAdB3065D86eACB54c169d092')
    })

    it('throws for unknown chain', () => {
      expect(() => getMulticallAddress(9999)).toThrow(
        'Failed to retrieve Multicall address for chain: 9999'
      )
    })
  })

  describe('isArbitrumNetworkNativeTokenEther', () => {
    it('returns true when nativeToken is undefined', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: undefined,
        } as ArbitrumNetwork)
      ).toBe(true)
    })

    it('returns true when nativeToken is zero address', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: '0x0000000000000000000000000000000000000000',
        } as ArbitrumNetwork)
      ).toBe(true)
    })

    it('returns false when nativeToken is a valid address', () => {
      expect(
        isArbitrumNetworkNativeTokenEther({
          nativeToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        } as ArbitrumNetwork)
      ).toBe(false)
    })
  })

  describe('assertArbitrumNetworkHasTokenBridge', () => {
    it('does not throw when token bridge is present', () => {
      const network = getArbitrumNetwork(42161)
      expect(() => assertArbitrumNetworkHasTokenBridge(network)).not.toThrow()
    })

    it('throws when token bridge is undefined', () => {
      const network = {
        ...getArbitrumNetwork(42161),
        tokenBridge: undefined,
      }
      expect(() =>
        assertArbitrumNetworkHasTokenBridge(network)
      ).toThrow('missing the token bridge')
    })
  })

  describe('getNitroGenesisBlock', () => {
    it('returns Nitro genesis block for Arbitrum One', () => {
      expect(getNitroGenesisBlock(42161)).toBe(22207817)
    })

    it('returns 0 for non-Arbitrum One chains', () => {
      expect(getNitroGenesisBlock(42170)).toBe(0)
      expect(getNitroGenesisBlock(421614)).toBe(0)
    })
  })
})
