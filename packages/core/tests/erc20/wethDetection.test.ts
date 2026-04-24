import { describe, it, expect, vi } from 'vitest'
import { isWethGateway } from '../../src/erc20/wethDetection'
import type { ArbitrumProvider } from '../../src/interfaces/provider'

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

function encodeAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '')
  return '0x' + clean.padStart(64, '0')
}

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(1),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x' + '0'.repeat(64)),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x0'),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: 0n,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }),
    ...overrides,
  }
}

describe('WETH Detection', () => {
  it('returns true when l1Weth() returns a non-zero address', async () => {
    // Mock call returns a valid WETH address
    const provider = createMockProvider({
      call: vi.fn().mockResolvedValue(encodeAddress(WETH_ADDRESS)),
    })

    const result = await isWethGateway(
      '0xd92023E9d9911199a6711321D1277285e6d4e2db',
      provider
    )
    expect(result).toBe(true)
  })

  it('returns false when l1Weth() returns the zero address', async () => {
    const provider = createMockProvider({
      call: vi
        .fn()
        .mockResolvedValue(
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        ),
    })

    const result = await isWethGateway(
      '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
      provider
    )
    expect(result).toBe(false)
  })

  it('returns false when l1Weth() call reverts', async () => {
    const provider = createMockProvider({
      call: vi.fn().mockRejectedValue(new Error('execution reverted')),
    })

    const result = await isWethGateway(
      '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
      provider
    )
    expect(result).toBe(false)
  })

  it('returns false when call returns empty data', async () => {
    const provider = createMockProvider({
      call: vi.fn().mockResolvedValue('0x'),
    })

    const result = await isWethGateway(
      '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
      provider
    )
    expect(result).toBe(false)
  })
})
