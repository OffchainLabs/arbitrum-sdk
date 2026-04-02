/**
 * Tests for the MultiCaller utility.
 *
 * Verifies that MultiCaller batches calls via Multicall2.tryAggregate
 * and correctly decodes results from the provider.
 */
import { describe, it, expect, vi } from 'vitest'
import { MultiCaller } from '../../src/utils/multicall'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { encodeFunctionData, decodeFunctionResult } from '../../src/encoding/abi'
import { Multicall2Abi } from '../../src/abi/Multicall2'
import { ERC20Abi } from '../../src/abi/ERC20'

const MULTICALL_ADDRESS = '0x5ba1e12693dc8f9c48aad8770482f4739beed696'

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(42161),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x0'),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }),
    ...overrides,
  }
}

/**
 * Helper to ABI-encode a tryAggregate result: Result[] = (bool success, bytes returnData)[]
 * This is what the multicall contract returns on-chain.
 */
function encodeTryAggregateResult(
  results: Array<{ success: boolean; returnData: string }>
): string {
  // We need to encode the output of tryAggregate which returns (bool, bytes)[]
  // The ABI encoder handles the tuple array encoding
  // We use our own encoder to produce the expected return data

  // Build the return data manually:
  // tryAggregate returns: Result[] where Result = (bool success, bytes returnData)
  // ABI encoding: offset to array, array length, then for each element: offset, then data

  // Simpler approach: use the actual ABI to encode a mock call result
  // For testing, let's manually build the hex

  // The output is a single dynamic parameter: Result[]
  // Offset to the array data (32 bytes)
  let hex = '0x'
  hex += '0000000000000000000000000000000000000000000000000000000000000020' // offset to array
  hex += BigInt(results.length).toString(16).padStart(64, '0') // array length

  // For each result, we need offsets (since (bool, bytes) is dynamic due to bytes)
  const headerSize = results.length * 32 // 32 bytes per offset
  const elementData: string[] = []
  let currentOffset = headerSize

  for (const result of results) {
    // Offset to this element's data
    hex += BigInt(currentOffset).toString(16).padStart(64, '0')

    // Encode the element: (bool success, bytes returnData)
    // bool is static (32 bytes), bytes is dynamic
    let elementHex = ''
    // success: bool
    elementHex += result.success
      ? '0000000000000000000000000000000000000000000000000000000000000001'
      : '0000000000000000000000000000000000000000000000000000000000000000'
    // offset to returnData bytes (64 bytes from start of this element: past bool + offset word)
    elementHex +=
      '0000000000000000000000000000000000000000000000000000000000000040'
    // bytes: length + data
    const dataNoPrefix = result.returnData.startsWith('0x')
      ? result.returnData.slice(2)
      : result.returnData
    const byteLen = dataNoPrefix.length / 2
    elementHex += BigInt(byteLen).toString(16).padStart(64, '0')
    // Pad data to 32-byte boundary
    const paddedData = dataNoPrefix.padEnd(
      Math.ceil(dataNoPrefix.length / 64) * 64,
      '0'
    )
    elementHex += paddedData

    elementData.push(elementHex)
    currentOffset += elementHex.length / 2
  }

  // Append all element data
  for (const data of elementData) {
    hex += data
  }

  return hex
}

describe('MultiCaller', () => {
  describe('constructor and fromProvider', () => {
    it('creates an instance with address', () => {
      const provider = createMockProvider()
      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      expect(mc.address).toBe(MULTICALL_ADDRESS)
    })
  })

  describe('getBlockNumberInput', () => {
    it('returns a CallInput that encodes getBlockNumber', () => {
      const provider = createMockProvider()
      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const input = mc.getBlockNumberInput()

      expect(input.targetAddr).toBe(MULTICALL_ADDRESS)
      expect(typeof input.encoder).toBe('function')
      expect(typeof input.decoder).toBe('function')

      // The encoded data should be the selector for getBlockNumber()
      const encoded = input.encoder()
      expect(encoded.startsWith('0x')).toBe(true)
      // getBlockNumber() selector = 0x42cbb15c
      expect(encoded).toBe('0x42cbb15c')
    })

    it('decoder correctly decodes a uint256 result', () => {
      const provider = createMockProvider()
      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const input = mc.getBlockNumberInput()

      // Encode a uint256 value of 12345
      const returnData =
        '0x0000000000000000000000000000000000000000000000000000000000003039'
      const result = input.decoder(returnData)
      expect(result).toBe(12345n)
    })
  })

  describe('getCurrentBlockTimestampInput', () => {
    it('returns a CallInput that encodes getCurrentBlockTimestamp', () => {
      const provider = createMockProvider()
      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const input = mc.getCurrentBlockTimestampInput()

      expect(input.targetAddr).toBe(MULTICALL_ADDRESS)
      const encoded = input.encoder()
      expect(encoded.startsWith('0x')).toBe(true)
      // getCurrentBlockTimestamp() selector = 0x0f28c97d
      expect(encoded).toBe('0x0f28c97d')
    })

    it('decoder correctly decodes a uint256 result', () => {
      const provider = createMockProvider()
      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const input = mc.getCurrentBlockTimestampInput()

      const returnData =
        '0x0000000000000000000000000000000000000000000000000000000065a8c000'
      const result = input.decoder(returnData)
      expect(result).toBe(0x65a8c000n)
    })
  })

  describe('multiCall', () => {
    it('batches multiple calls and decodes results', async () => {
      // Mock return data: two successful calls returning uint256 values
      const balanceReturnData =
        '0000000000000000000000000000000000000000000000000000000000000064' // 100
      const supplyReturnData =
        '00000000000000000000000000000000000000000000000000000000000003e8' // 1000

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: '0x' + balanceReturnData },
        { success: true, returnData: '0x' + supplyReturnData },
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)

      const tokenAddress = '0x0000000000000000000000000000000000000001'

      const inputs = [
        {
          targetAddr: tokenAddress,
          encoder: () =>
            encodeFunctionData(ERC20Abi, 'balanceOf', [
              '0x0000000000000000000000000000000000000002',
            ]),
          decoder: (returnData: string) =>
            decodeFunctionResult(ERC20Abi, 'balanceOf', returnData)[0] as bigint,
        },
        {
          targetAddr: tokenAddress,
          encoder: () => encodeFunctionData(ERC20Abi, 'totalSupply', []),
          decoder: (returnData: string) =>
            decodeFunctionResult(ERC20Abi, 'totalSupply', returnData)[0] as bigint,
        },
      ] as const

      const results = await mc.multiCall([...inputs])

      expect(results).toHaveLength(2)
      expect(results[0]).toBe(100n)
      expect(results[1]).toBe(1000n)
    })

    it('returns undefined for failed calls when requireSuccess is false', async () => {
      const balanceReturnData =
        '0000000000000000000000000000000000000000000000000000000000000064' // 100

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: '0x' + balanceReturnData },
        { success: false, returnData: '0x' }, // failed call
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)

      const inputs = [
        {
          targetAddr: '0x0000000000000000000000000000000000000001',
          encoder: () =>
            encodeFunctionData(ERC20Abi, 'balanceOf', [
              '0x0000000000000000000000000000000000000002',
            ]),
          decoder: (returnData: string) =>
            decodeFunctionResult(ERC20Abi, 'balanceOf', returnData)[0] as bigint,
        },
        {
          targetAddr: '0x0000000000000000000000000000000000000001',
          encoder: () => encodeFunctionData(ERC20Abi, 'totalSupply', []),
          decoder: (returnData: string) =>
            decodeFunctionResult(ERC20Abi, 'totalSupply', returnData)[0] as bigint,
        },
      ]

      const results = await mc.multiCall(inputs, false)

      expect(results).toHaveLength(2)
      expect(results[0]).toBe(100n)
      expect(results[1]).toBeUndefined()
    })

    it('calls provider.call with the correct target address and encoded data', async () => {
      const mockReturnHex = encodeTryAggregateResult([
        {
          success: true,
          returnData:
            '0x0000000000000000000000000000000000000000000000000000000000000064',
        },
      ])

      const callMock = vi.fn().mockResolvedValue(mockReturnHex)
      const provider = createMockProvider({ call: callMock })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)

      await mc.multiCall([
        {
          targetAddr: '0x0000000000000000000000000000000000000001',
          encoder: () => '0xdeadbeef',
          decoder: (returnData: string) => returnData,
        },
      ])

      expect(callMock).toHaveBeenCalledWith({
        to: MULTICALL_ADDRESS,
        data: expect.stringContaining('0x'), // tryAggregate calldata
      })
    })
  })

  describe('getTokenData', () => {
    /**
     * Helper: encode a string as an ABI-encoded string return value.
     * ABI string return: offset(32) + length(32) + padded-data
     */
    function encodeStringReturn(str: string): string {
      const hexChars = Array.from(str)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
      const byteLen = hexChars.length / 2
      const paddedData = hexChars.padEnd(Math.ceil(hexChars.length / 64) * 64, '0')
      return (
        '0x' +
        // offset to string data (32 bytes)
        '0000000000000000000000000000000000000000000000000000000000000020' +
        // string length
        BigInt(byteLen).toString(16).padStart(64, '0') +
        // string data (padded)
        paddedData
      )
    }

    /**
     * Helper: encode a bytes32 value (for tokens like MKR that return bytes32 for name/symbol).
     */
    function encodeBytes32Return(str: string): string {
      const hexChars = Array.from(str)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
      return '0x' + hexChars.padEnd(64, '0')
    }

    /**
     * Helper: encode a uint8/uint256 decimals return.
     */
    function encodeDecimalsReturn(decimals: number): string {
      return '0x' + BigInt(decimals).toString(16).padStart(64, '0')
    }

    it('returns name, symbol, and decimals for standard ERC-20 tokens', async () => {
      // For each token: 3 calls (name, symbol, decimals) = 3 results
      const nameReturn = encodeStringReturn('Dai Stablecoin')
      const symbolReturn = encodeStringReturn('DAI')
      const decimalsReturn = encodeDecimalsReturn(18)

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: nameReturn },
        { success: true, returnData: symbolReturn },
        { success: true, returnData: decimalsReturn },
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const result = await mc.getTokenData([
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      ])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Dai Stablecoin')
      expect(result[0].symbol).toBe('DAI')
      expect(result[0].decimals).toBe(18)
    })

    it('handles bytes32 name/symbol (like Maker MKR)', async () => {
      const nameReturn = encodeBytes32Return('Maker')
      const symbolReturn = encodeBytes32Return('MKR')
      const decimalsReturn = encodeDecimalsReturn(18)

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: nameReturn },
        { success: true, returnData: symbolReturn },
        { success: true, returnData: decimalsReturn },
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const result = await mc.getTokenData([
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      ])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Maker')
      expect(result[0].symbol).toBe('MKR')
      expect(result[0].decimals).toBe(18)
    })

    it('handles multiple tokens', async () => {
      const daiName = encodeStringReturn('Dai Stablecoin')
      const daiSymbol = encodeStringReturn('DAI')
      const daiDecimals = encodeDecimalsReturn(18)
      const usdcName = encodeStringReturn('USD Coin')
      const usdcSymbol = encodeStringReturn('USDC')
      const usdcDecimals = encodeDecimalsReturn(6)

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: daiName },
        { success: true, returnData: daiSymbol },
        { success: true, returnData: daiDecimals },
        { success: true, returnData: usdcName },
        { success: true, returnData: usdcSymbol },
        { success: true, returnData: usdcDecimals },
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const result = await mc.getTokenData([
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ])

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Dai Stablecoin')
      expect(result[0].symbol).toBe('DAI')
      expect(result[0].decimals).toBe(18)
      expect(result[1].name).toBe('USD Coin')
      expect(result[1].symbol).toBe('USDC')
      expect(result[1].decimals).toBe(6)
    })

    it('returns undefined for failed calls', async () => {
      const nameReturn = encodeStringReturn('Test Token')
      const decimalsReturn = encodeDecimalsReturn(18)

      const mockReturnHex = encodeTryAggregateResult([
        { success: true, returnData: nameReturn },
        { success: false, returnData: '0x' }, // symbol call failed
        { success: true, returnData: decimalsReturn },
      ])

      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(mockReturnHex),
      })

      const mc = new MultiCaller(provider, MULTICALL_ADDRESS)
      const result = await mc.getTokenData([
        '0x0000000000000000000000000000000000000001',
      ])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Token')
      expect(result[0].symbol).toBeUndefined()
      expect(result[0].decimals).toBe(18)
    })
  })
})
