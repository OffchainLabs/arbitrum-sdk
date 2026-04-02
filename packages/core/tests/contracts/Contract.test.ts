import { describe, it, expect, vi } from 'vitest'
import { ArbitrumContract } from '../../src/contracts/Contract'
import { encodeFunctionData } from '../../src/encoding/abi'
import type { ArbitrumProvider } from '../../src/interfaces/provider'

/**
 * Minimal ERC20 ABI for testing Contract class.
 */
const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001'
const USER_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(1),
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

describe('ArbitrumContract', () => {
  describe('encode', () => {
    it('encodes a function call (static method — no provider needed)', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const calldata = contract.encodeFunctionData('transfer', [
        '0x0000000000000000000000000000000000000002',
        1000n,
      ])
      // transfer(address,uint256) selector = 0xa9059cbb
      expect(calldata.slice(0, 10)).toBe('0xa9059cbb')
      expect(calldata.length).toBe(2 + 8 + 64 + 64)
    })

    it('encodes function with no args', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const calldata = contract.encodeFunctionData('totalSupply', [])
      expect(calldata).toBe('0x18160ddd')
    })
  })

  describe('encodeWrite', () => {
    it('returns TransactionRequestData', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const tx = contract.encodeWrite('transfer', [
        '0x0000000000000000000000000000000000000002',
        1000n,
      ])
      expect(tx.to).toBe(CONTRACT_ADDRESS)
      expect(tx.data.slice(0, 10)).toBe('0xa9059cbb')
      expect(tx.value).toBe(0n)
    })

    it('includes value when specified', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const tx = contract.encodeWrite(
        'transfer',
        ['0x0000000000000000000000000000000000000002', 1000n],
        { value: 500n }
      )
      expect(tx.value).toBe(500n)
    })

    it('includes from when specified', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const tx = contract.encodeWrite(
        'transfer',
        ['0x0000000000000000000000000000000000000002', 1000n],
        { from: USER_ADDRESS }
      )
      expect(tx.from).toBe(USER_ADDRESS)
    })
  })

  describe('read', () => {
    it('calls provider and decodes uint256 result', async () => {
      const balanceHex =
        '0x0000000000000000000000000000000000000000000000000000000000000064' // 100
      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(balanceHex),
      })

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS, provider)
      const result = await contract.read('balanceOf', [USER_ADDRESS])

      // Verify provider was called with correct args
      expect(provider.call).toHaveBeenCalledWith({
        to: CONTRACT_ADDRESS,
        data: expect.stringMatching(/^0x70a08231/), // balanceOf selector
      })

      // Result should be decoded
      expect(result).toEqual([100n])
    })

    it('calls provider and decodes bool result', async () => {
      const trueHex =
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(trueHex),
      })

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS, provider)
      const result = await contract.read('transfer', [
        '0x0000000000000000000000000000000000000002',
        1000n,
      ])

      expect(result).toEqual([true])
    })

    it('throws if no provider is set', async () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      await expect(
        contract.read('balanceOf', [USER_ADDRESS])
      ).rejects.toThrow()
    })

    it('supports blockTag option', async () => {
      const balanceHex =
        '0x0000000000000000000000000000000000000000000000000000000000000064'
      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(balanceHex),
      })

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS, provider)
      await contract.read('balanceOf', [USER_ADDRESS], {
        blockTag: 'latest',
      })

      expect(provider.call).toHaveBeenCalledWith({
        to: CONTRACT_ADDRESS,
        data: expect.stringMatching(/^0x70a08231/),
        blockTag: 'latest',
      })
    })
  })

  describe('parseEventLogs', () => {
    it('parses Transfer logs from a list of logs', () => {
      const transferTopic =
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const logs = [
        {
          address: CONTRACT_ADDRESS,
          topics: [
            transferTopic,
            '0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          ],
          data: '0x00000000000000000000000000000000000000000000000000000000000003e8',
          blockNumber: 100,
          blockHash: '0xabc',
          transactionHash: '0xdef',
          transactionIndex: 0,
          logIndex: 0,
          removed: false,
        },
        {
          // Different topic — should be filtered out
          address: CONTRACT_ADDRESS,
          topics: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          data: '0x',
          blockNumber: 100,
          blockHash: '0xabc',
          transactionHash: '0xdef',
          transactionIndex: 0,
          logIndex: 1,
          removed: false,
        },
      ]

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const parsed = contract.parseEventLogs('Transfer', logs)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].args.from).toBe(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      )
      expect(parsed[0].args.to).toBe(
        '0x0000000000000000000000000000000000000001'
      )
      expect(parsed[0].args.value).toBe(1000n)
      expect(parsed[0].name).toBe('Transfer')
      expect(parsed[0].blockNumber).toBe(100)
      expect(parsed[0].transactionHash).toBe('0xdef')
    })

    it('returns empty array when no logs match', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const parsed = contract.parseEventLogs('Transfer', [])
      expect(parsed).toHaveLength(0)
    })

    it('filters out removed logs', () => {
      const transferTopic =
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const logs = [
        {
          address: CONTRACT_ADDRESS,
          topics: [
            transferTopic,
            '0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          ],
          data: '0x00000000000000000000000000000000000000000000000000000000000003e8',
          blockNumber: 100,
          blockHash: '0xabc',
          transactionHash: '0xdef',
          transactionIndex: 0,
          logIndex: 0,
          removed: true,
        },
      ]

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const parsed = contract.parseEventLogs('Transfer', logs)
      expect(parsed).toHaveLength(0)
    })
  })

  describe('getEventTopic', () => {
    it('returns Transfer event topic', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const topic = contract.getEventTopic('Transfer')
      expect(topic).toBe(
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      )
    })

    it('returns Approval event topic', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const topic = contract.getEventTopic('Approval')
      expect(topic).toBe(
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      )
    })
  })

  describe('connect', () => {
    it('returns a new Contract with a provider attached', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const provider = createMockProvider()
      const connected = contract.connect(provider)

      // New instance, not mutated
      expect(connected).not.toBe(contract)
      expect(connected.address).toBe(CONTRACT_ADDRESS)
    })

    it('connected contract can read', async () => {
      const balanceHex =
        '0x0000000000000000000000000000000000000000000000000000000000000064'
      const provider = createMockProvider({
        call: vi.fn().mockResolvedValue(balanceHex),
      })

      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const connected = contract.connect(provider)
      const result = await connected.read('balanceOf', [USER_ADDRESS])
      expect(result).toEqual([100n])
    })
  })

  describe('at', () => {
    it('returns a new Contract with a different address', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)
      const newAddress = '0x0000000000000000000000000000000000000002'
      const atNew = contract.at(newAddress)

      expect(atNew).not.toBe(contract)
      expect(atNew.address).toBe(newAddress)
    })
  })

  describe('encode matches abi.encodeFunctionData', () => {
    it('produces the same output', () => {
      const contract = new ArbitrumContract(ERC20_ABI, CONTRACT_ADDRESS)

      const args = [
        '0x0000000000000000000000000000000000000002',
        1000n,
      ]

      const fromContract = contract.encodeFunctionData('transfer', args)
      const fromDirect = encodeFunctionData(ERC20_ABI, 'transfer', args)

      expect(fromContract).toBe(fromDirect)
    })
  })
})
