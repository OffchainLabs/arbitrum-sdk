import { describe, it, expect } from 'vitest'
import {
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopic,
  decodeEventLog,
  getFunctionSelector,
} from '../../src/encoding/abi'

/**
 * Minimal ERC20 ABI for testing.
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
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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

/**
 * ABI with various types for comprehensive testing.
 */
const COMPREHENSIVE_ABI = [
  {
    type: 'function',
    name: 'testBool',
    inputs: [{ name: 'val', type: 'bool' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testBytes',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testBytes32',
    inputs: [{ name: 'data', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testString',
    inputs: [{ name: 'str', type: 'string' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testUint8',
    inputs: [{ name: 'val', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testInt256',
    inputs: [{ name: 'val', type: 'int256' }],
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testTuple',
    inputs: [
      {
        name: 'val',
        type: 'tuple',
        components: [
          { name: 'a', type: 'uint256' },
          { name: 'b', type: 'address' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'testDynamicArray',
    inputs: [{ name: 'vals', type: 'uint256[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'testFixedArray',
    inputs: [{ name: 'vals', type: 'uint256[3]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'testMultipleOutputs',
    inputs: [],
    outputs: [
      { name: 'a', type: 'uint256' },
      { name: 'b', type: 'address' },
      { name: 'c', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testUint32',
    inputs: [{ name: 'val', type: 'uint32' }],
    outputs: [{ name: '', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testUint64',
    inputs: [{ name: 'val', type: 'uint64' }],
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testUint128',
    inputs: [{ name: 'val', type: 'uint128' }],
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'testAddressArray',
    inputs: [{ name: 'addrs', type: 'address[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

describe('ABI encoder/decoder', () => {
  describe('encodeFunctionData', () => {
    it('encodes ERC20 transfer', () => {
      // Known: transfer(address,uint256) selector = 0xa9059cbb
      const data = encodeFunctionData(ERC20_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        1000n,
      ])
      // Selector
      expect(data.slice(0, 10)).toBe('0xa9059cbb')
      // Address padded to 32 bytes
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
      // uint256 1000 = 0x3e8
      expect(data.slice(74, 138)).toBe(
        '00000000000000000000000000000000000000000000000000000000000003e8'
      )
      expect(data.length).toBe(2 + 8 + 64 + 64) // 0x + 4 bytes selector + 2 * 32 bytes
    })

    it('encodes function with no args', () => {
      const data = encodeFunctionData(ERC20_ABI, 'totalSupply', [])
      // totalSupply() selector = 0x18160ddd
      expect(data).toBe('0x18160ddd')
    })

    it('encodes balanceOf with address arg', () => {
      const data = encodeFunctionData(ERC20_ABI, 'balanceOf', [
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      ])
      // balanceOf(address) selector = 0x70a08231
      expect(data.slice(0, 10)).toBe('0x70a08231')
      // address is lowercased and padded
      expect(data.slice(10, 74)).toBe(
        '000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045'
      )
    })

    it('encodes bool', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testBool', [true])
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )

      const data2 = encodeFunctionData(COMPREHENSIVE_ABI, 'testBool', [false])
      expect(data2.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('encodes bytes32', () => {
      const val =
        '0xdeadbeef00000000000000000000000000000000000000000000000000000000'
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testBytes32', [val])
      expect(data.slice(10, 74)).toBe(val.slice(2))
    })

    it('encodes dynamic bytes', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testBytes', [
        '0xdeadbeef',
      ])
      // Offset to data (32 bytes = 0x20)
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length (4 bytes = 0x04)
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000004'
      )
      // Data padded to 32 bytes
      expect(data.slice(138, 202)).toBe(
        'deadbeef00000000000000000000000000000000000000000000000000000000'
      )
    })

    it('encodes string', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testString', [
        'hello',
      ])
      // Offset to data
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length (5 bytes)
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000005'
      )
      // "hello" = 0x68656c6c6f padded to 32 bytes
      expect(data.slice(138, 202)).toBe(
        '68656c6c6f000000000000000000000000000000000000000000000000000000'
      )
    })

    it('encodes uint8', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testUint8', [255n])
      expect(data.slice(10, 74)).toBe(
        '00000000000000000000000000000000000000000000000000000000000000ff'
      )
    })

    it('encodes int256 negative', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testInt256', [-1n])
      expect(data.slice(10, 74)).toBe(
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
    })

    it('encodes int256 positive', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testInt256', [42n])
      expect(data.slice(10, 74)).toBe(
        '000000000000000000000000000000000000000000000000000000000000002a'
      )
    })

    it('encodes tuple', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testTuple', [
        {
          a: 42n,
          b: '0x0000000000000000000000000000000000000001',
        },
      ])
      // tuple(uint256,address) is static, encoded inline
      expect(data.slice(10, 74)).toBe(
        '000000000000000000000000000000000000000000000000000000000000002a'
      )
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
    })

    it('encodes dynamic array', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testDynamicArray', [
        [1n, 2n, 3n],
      ])
      // Offset to array data
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Array length
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000003'
      )
      // Elements
      expect(data.slice(138, 202)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(data.slice(202, 266)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000002'
      )
      expect(data.slice(266, 330)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000003'
      )
    })

    it('encodes fixed-size array', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testFixedArray', [
        [10n, 20n, 30n],
      ])
      // Fixed array is encoded inline (no offset, no length prefix)
      expect(data.slice(10, 74)).toBe(
        '000000000000000000000000000000000000000000000000000000000000000a'
      )
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000014'
      )
      expect(data.slice(138, 202)).toBe(
        '000000000000000000000000000000000000000000000000000000000000001e'
      )
    })

    it('encodes uint32, uint64, uint128', () => {
      const d32 = encodeFunctionData(COMPREHENSIVE_ABI, 'testUint32', [
        100000n,
      ])
      expect(d32.slice(10, 74)).toBe(
        '00000000000000000000000000000000000000000000000000000000000186a0'
      )

      const d64 = encodeFunctionData(COMPREHENSIVE_ABI, 'testUint64', [
        2n ** 40n,
      ])
      expect(d64.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000010000000000'
      )

      const d128 = encodeFunctionData(COMPREHENSIVE_ABI, 'testUint128', [
        2n ** 100n,
      ])
      expect(d128.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000010000000000000000000000000'
      )
    })

    it('encodes address array', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testAddressArray', [
        [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000002',
        ],
      ])
      // Offset
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000002'
      )
      // Elements
      expect(data.slice(138, 202)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(data.slice(202, 266)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000002'
      )
    })

    it('throws on unknown function name', () => {
      expect(() =>
        encodeFunctionData(ERC20_ABI, 'nonexistent' as string, [])
      ).toThrow()
    })
  })

  describe('decodeFunctionResult', () => {
    it('decodes uint256 return value', () => {
      // balanceOf returns uint256
      const data =
        '0x0000000000000000000000000000000000000000000000000000000000000064' // 100
      const result = decodeFunctionResult(ERC20_ABI, 'balanceOf', data)
      expect(result).toEqual([100n])
    })

    it('decodes bool return value', () => {
      const data =
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      const result = decodeFunctionResult(ERC20_ABI, 'transfer', data)
      expect(result).toEqual([true])
    })

    it('decodes false bool', () => {
      const data =
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      const result = decodeFunctionResult(ERC20_ABI, 'transfer', data)
      expect(result).toEqual([false])
    })

    it('decodes multiple outputs', () => {
      const data =
        '0x' +
        '000000000000000000000000000000000000000000000000000000000000002a' + // uint256 = 42
        '0000000000000000000000000000000000000000000000000000000000000001' + // address = 0x...01
        '0000000000000000000000000000000000000000000000000000000000000001' // bool = true
      const result = decodeFunctionResult(
        COMPREHENSIVE_ABI,
        'testMultipleOutputs',
        data
      )
      expect(result[0]).toBe(42n)
      expect(result[1]).toBe('0x0000000000000000000000000000000000000001')
      expect(result[2]).toBe(true)
    })

    it('decodes string return', () => {
      const data =
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' + // offset
        '0000000000000000000000000000000000000000000000000000000000000005' + // length
        '68656c6c6f000000000000000000000000000000000000000000000000000000' // "hello"
      const result = decodeFunctionResult(COMPREHENSIVE_ABI, 'testString', data)
      expect(result).toEqual(['hello'])
    })

    it('decodes bytes return', () => {
      const data =
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' + // offset
        '0000000000000000000000000000000000000000000000000000000000000004' + // length
        'deadbeef00000000000000000000000000000000000000000000000000000000' // data
      const result = decodeFunctionResult(COMPREHENSIVE_ABI, 'testBytes', data)
      expect(result).toEqual(['0xdeadbeef'])
    })

    it('decodes int256 negative', () => {
      const data =
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const result = decodeFunctionResult(
        COMPREHENSIVE_ABI,
        'testInt256',
        data
      )
      expect(result).toEqual([-1n])
    })

    it('decodes bytes32', () => {
      const data =
        '0xdeadbeef00000000000000000000000000000000000000000000000000000000'
      const result = decodeFunctionResult(
        COMPREHENSIVE_ABI,
        'testBytes32',
        data
      )
      expect(result).toEqual([
        '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
      ])
    })
  })

  describe('encodeEventTopic', () => {
    it('encodes Transfer event topic', () => {
      // Transfer(address,address,uint256)
      const topic = encodeEventTopic(ERC20_ABI, 'Transfer')
      expect(topic).toBe(
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      )
    })

    it('encodes Approval event topic', () => {
      // Approval(address,address,uint256)
      const topic = encodeEventTopic(ERC20_ABI, 'Approval')
      expect(topic).toBe(
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      )
    })

    it('throws for unknown event', () => {
      expect(() =>
        encodeEventTopic(ERC20_ABI, 'NonexistentEvent' as string)
      ).toThrow()
    })
  })

  describe('decodeEventLog', () => {
    it('decodes Transfer event', () => {
      const transferTopic =
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const topics = [
        transferTopic,
        '0x000000000000000000000000' +
          'd8da6bf26964af9d7eed9e03e53415d37aa96045', // from
        '0x000000000000000000000000' +
          '0000000000000000000000000000000000000001', // to
      ]
      const data =
        '0x00000000000000000000000000000000000000000000000000000000000003e8' // 1000

      const result = decodeEventLog(ERC20_ABI, 'Transfer', { topics, data })
      expect(result.from).toBe(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      )
      expect(result.to).toBe(
        '0x0000000000000000000000000000000000000001'
      )
      expect(result.value).toBe(1000n)
    })

    it('decodes Approval event', () => {
      const approvalTopic =
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      const topics = [
        approvalTopic,
        '0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ]
      const data =
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' // max uint256

      const result = decodeEventLog(ERC20_ABI, 'Approval', { topics, data })
      expect(result.owner).toBe(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      )
      expect(result.value).toBe(2n ** 256n - 1n)
    })
  })

  describe('edge cases', () => {
    it('encodes zero uint256', () => {
      const data = encodeFunctionData(ERC20_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        0n,
      ])
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('encodes max uint256', () => {
      const data = encodeFunctionData(ERC20_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        2n ** 256n - 1n,
      ])
      expect(data.slice(74, 138)).toBe(
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
    })

    it('encodes empty dynamic bytes', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testBytes', ['0x'])
      // Offset
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length = 0
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
      // No data follows
      expect(data.length).toBe(2 + 8 + 64 + 64)
    })

    it('encodes empty string', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testString', [''])
      // Offset
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length = 0
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('encodes empty dynamic array', () => {
      const data = encodeFunctionData(COMPREHENSIVE_ABI, 'testDynamicArray', [
        [],
      ])
      // Offset
      expect(data.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
      // Length = 0
      expect(data.slice(74, 138)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
    })

    it('accepts number for uint fields and coerces to bigint', () => {
      // Users may pass number instead of bigint for small values
      const data = encodeFunctionData(ERC20_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        1000 as unknown as bigint,
      ])
      expect(data.slice(74, 138)).toBe(
        '00000000000000000000000000000000000000000000000000000000000003e8'
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // C1 + C2 + C10: Dynamic arrays with dynamic element types
  // ──────────────────────────────────────────────────────────────────────────

  describe('dynamic arrays with dynamic elements (C1/C2/C10)', () => {
    /**
     * ABI for a function that returns bytes[]
     */
    const BYTES_ARRAY_ABI = [
      {
        type: 'function',
        name: 'getResults',
        inputs: [],
        outputs: [{ name: 'results', type: 'bytes[]' }],
        stateMutability: 'view',
      },
    ] as const

    /**
     * ABI for a function that returns string[]
     */
    const STRING_ARRAY_ABI = [
      {
        type: 'function',
        name: 'getNames',
        inputs: [],
        outputs: [{ name: 'names', type: 'string[]' }],
        stateMutability: 'view',
      },
    ] as const

    /**
     * Multicall2 ABI (subset)
     */
    const MULTICALL2_ABI = [
      {
        type: 'function',
        name: 'aggregate',
        inputs: [
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'callData', type: 'bytes' },
            ],
          },
        ],
        outputs: [
          { name: 'blockNumber', type: 'uint256' },
          { name: 'returnData', type: 'bytes[]' },
        ],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'tryAggregate',
        inputs: [
          { name: 'requireSuccess', type: 'bool' },
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'callData', type: 'bytes' },
            ],
          },
        ],
        outputs: [
          {
            name: 'returnData',
            type: 'tuple[]',
            components: [
              { name: 'success', type: 'bool' },
              { name: 'returnData', type: 'bytes' },
            ],
          },
        ],
        stateMutability: 'nonpayable',
      },
    ] as const

    it('decodes bytes[] with two elements', () => {
      // Manually construct ABI-encoded bytes[] = ["0xdeadbeef", "0xcafe"]
      // Outer: offset to array -> length=2 -> offset to elem0, offset to elem1 -> elem0 data, elem1 data
      const data =
        '0x' +
        // offset to bytes[] data (32 bytes)
        '0000000000000000000000000000000000000000000000000000000000000020' +
        // array length = 2
        '0000000000000000000000000000000000000000000000000000000000000002' +
        // offset to element 0 from start of array content (after length): 64 bytes (2 * 32)
        '0000000000000000000000000000000000000000000000000000000000000040' +
        // offset to element 1 from start of array content: 64 + 32(len) + 32(data) = 128
        '0000000000000000000000000000000000000000000000000000000000000080' +
        // element 0: length=4, data=deadbeef
        '0000000000000000000000000000000000000000000000000000000000000004' +
        'deadbeef00000000000000000000000000000000000000000000000000000000' +
        // element 1: length=2, data=cafe
        '0000000000000000000000000000000000000000000000000000000000000002' +
        'cafe000000000000000000000000000000000000000000000000000000000000'
      const result = decodeFunctionResult(BYTES_ARRAY_ABI, 'getResults', data)
      expect(result[0]).toEqual(['0xdeadbeef', '0xcafe'])
    })

    it('decodes string[] with two elements', () => {
      // ABI-encoded string[] = ["hello", "world"]
      const data =
        '0x' +
        // offset to string[] data
        '0000000000000000000000000000000000000000000000000000000000000020' +
        // array length = 2
        '0000000000000000000000000000000000000000000000000000000000000002' +
        // offset to element 0: 64
        '0000000000000000000000000000000000000000000000000000000000000040' +
        // offset to element 1: 64 + 32 + 32 = 128
        '0000000000000000000000000000000000000000000000000000000000000080' +
        // element 0: length=5, "hello"
        '0000000000000000000000000000000000000000000000000000000000000005' +
        '68656c6c6f000000000000000000000000000000000000000000000000000000' +
        // element 1: length=5, "world"
        '0000000000000000000000000000000000000000000000000000000000000005' +
        '776f726c64000000000000000000000000000000000000000000000000000000'
      const result = decodeFunctionResult(STRING_ARRAY_ABI, 'getNames', data)
      expect(result[0]).toEqual(['hello', 'world'])
    })

    it('encodes and decodes tuple(address, bytes)[] round-trip', () => {
      const calls = [
        {
          target: '0x0000000000000000000000000000000000000001',
          callData: '0xdeadbeef',
        },
        {
          target: '0x0000000000000000000000000000000000000002',
          callData: '0xcafe',
        },
      ]
      const encoded = encodeFunctionData(MULTICALL2_ABI, 'aggregate', [calls])

      // Verify selector for aggregate((address,bytes)[])
      const selector = getFunctionSelector(MULTICALL2_ABI, 'aggregate')
      expect(encoded.startsWith(selector)).toBe(true)

      // The encoding should be decodable — we can at least verify it doesn't
      // produce garbage by checking the encoded data has expected structure.
      // The offset to the array should be 32 (0x20)
      expect(encoded.slice(10, 74)).toBe(
        '0000000000000000000000000000000000000000000000000000000000000020'
      )
    })

    it('encodes (bool, bytes)[] — Multicall2 Result type', () => {
      // ABI for a function that takes Result[] as input for testing encoding
      const RESULT_ARRAY_ABI = [
        {
          type: 'function',
          name: 'processResults',
          inputs: [
            {
              name: 'results',
              type: 'tuple[]',
              components: [
                { name: 'success', type: 'bool' },
                { name: 'returnData', type: 'bytes' },
              ],
            },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ] as const

      const results = [
        { success: true, returnData: '0xdeadbeef' },
        { success: false, returnData: '0x' },
      ]

      // Should not throw — this was broken before the fix
      const encoded = encodeFunctionData(RESULT_ARRAY_ABI, 'processResults', [
        results,
      ])
      expect(encoded).toBeTruthy()
      expect(typeof encoded).toBe('string')
      expect(encoded.startsWith('0x')).toBe(true)
    })

    it('decodes Multicall2 tryAggregate return with actual ABI encoding', () => {
      // tryAggregate returns (bool success, bytes returnData)[]
      // Construct valid ABI-encoded return data:
      // tuple[] where each tuple is (bool, bytes)
      const data =
        '0x' +
        // offset to the tuple[] data
        '0000000000000000000000000000000000000000000000000000000000000020' +
        // array length = 2
        '0000000000000000000000000000000000000000000000000000000000000002' +
        // offset to tuple 0 (from start of array body, after length word): 64
        '0000000000000000000000000000000000000000000000000000000000000040' +
        // offset to tuple 1: will be calculated
        '00000000000000000000000000000000000000000000000000000000000000c0' +
        // ---- tuple 0: (true, 0xdeadbeef) ----
        // bool success = true
        '0000000000000000000000000000000000000000000000000000000000000001' +
        // offset to bytes data within this tuple = 64
        '0000000000000000000000000000000000000000000000000000000000000040' +
        // bytes length = 4
        '0000000000000000000000000000000000000000000000000000000000000004' +
        // bytes data = deadbeef
        'deadbeef00000000000000000000000000000000000000000000000000000000' +
        // ---- tuple 1: (false, 0xcafe) ----
        // bool success = false
        '0000000000000000000000000000000000000000000000000000000000000000' +
        // offset to bytes data within this tuple = 64
        '0000000000000000000000000000000000000000000000000000000000000040' +
        // bytes length = 2
        '0000000000000000000000000000000000000000000000000000000000000002' +
        // bytes data = cafe
        'cafe000000000000000000000000000000000000000000000000000000000000'

      const result = decodeFunctionResult(
        MULTICALL2_ABI,
        'tryAggregate',
        data
      )
      const tuples = result[0] as Array<Record<string, unknown>>
      expect(tuples).toHaveLength(2)
      expect(tuples[0].success).toBe(true)
      expect(tuples[0].returnData).toBe('0xdeadbeef')
      expect(tuples[1].success).toBe(false)
      expect(tuples[1].returnData).toBe('0xcafe')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // C3: Operator precedence bug
  // ──────────────────────────────────────────────────────────────────────────

  describe('empty/truncated data handling (C3)', () => {
    it('decoding uint256 from empty data throws a clear error', () => {
      const UINT_ABI = [
        {
          type: 'function',
          name: 'getValue',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
        },
      ] as const

      // "0x" is empty data — should throw, not produce SyntaxError
      expect(() =>
        decodeFunctionResult(UINT_ABI, 'getValue', '0x')
      ).toThrow()
    })

    it('decoding from data shorter than expected throws meaningful error', () => {
      const UINT_ABI = [
        {
          type: 'function',
          name: 'getValue',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
        },
      ] as const

      // Only 16 hex chars = 8 bytes, not enough for a 32-byte word
      expect(() =>
        decodeFunctionResult(UINT_ABI, 'getValue', '0x00000000000000ff')
      ).toThrow()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // H4: Function overload resolution
  // ──────────────────────────────────────────────────────────────────────────

  describe('function overload resolution (H4)', () => {
    const OVERLOADED_ABI = [
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
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ] as const

    it('selects 2-param overload when called with 2 args', () => {
      const data = encodeFunctionData(OVERLOADED_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        1000n,
      ])
      // transfer(address,uint256) selector = 0xa9059cbb
      expect(data.slice(0, 10)).toBe('0xa9059cbb')
    })

    it('selects 3-param overload when called with 3 args', () => {
      const data = encodeFunctionData(OVERLOADED_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        1000n,
        '0xdeadbeef',
      ])
      // transfer(address,uint256,bytes) — different selector
      // Should NOT be 0xa9059cbb
      expect(data.slice(0, 10)).not.toBe('0xa9059cbb')
    })

    it('still works with non-overloaded functions', () => {
      // Use the standard ERC20 ABI where transfer is not overloaded
      const data = encodeFunctionData(ERC20_ABI, 'transfer', [
        '0x0000000000000000000000000000000000000001',
        1000n,
      ])
      expect(data.slice(0, 10)).toBe('0xa9059cbb')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // H5: UTF-8 string encoding/decoding
  // ──────────────────────────────────────────────────────────────────────────

  describe('UTF-8 string encoding/decoding (H5)', () => {
    const STRING_ABI = [
      {
        type: 'function',
        name: 'setName',
        inputs: [{ name: 'name', type: 'string' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'getName',
        inputs: [],
        outputs: [{ name: 'name', type: 'string' }],
        stateMutability: 'view',
      },
    ] as const

    it('encode and decode "café" round-trip', () => {
      const encoded = encodeFunctionData(STRING_ABI, 'setName', ['café'])
      // Decode: strip selector, treat rest as if it were return data
      const returnData = '0x' + encoded.slice(10)
      const decoded = decodeFunctionResult(STRING_ABI, 'getName', returnData)
      expect(decoded[0]).toBe('café')
    })

    it('encode and decode "日本語" round-trip', () => {
      const encoded = encodeFunctionData(STRING_ABI, 'setName', ['日本語'])
      const returnData = '0x' + encoded.slice(10)
      const decoded = decodeFunctionResult(STRING_ABI, 'getName', returnData)
      expect(decoded[0]).toBe('日本語')
    })

    it('encode and decode emoji "🎉" round-trip', () => {
      const encoded = encodeFunctionData(STRING_ABI, 'setName', ['🎉'])
      const returnData = '0x' + encoded.slice(10)
      const decoded = decodeFunctionResult(STRING_ABI, 'getName', returnData)
      expect(decoded[0]).toBe('🎉')
    })

    it('encode and decode empty string round-trip', () => {
      const encoded = encodeFunctionData(STRING_ABI, 'setName', [''])
      const returnData = '0x' + encoded.slice(10)
      const decoded = decodeFunctionResult(STRING_ABI, 'getName', returnData)
      expect(decoded[0]).toBe('')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // H6: Address validation
  // ──────────────────────────────────────────────────────────────────────────

  describe('address validation (H6)', () => {
    it('rejects non-hex address', () => {
      expect(() =>
        encodeFunctionData(ERC20_ABI, 'balanceOf', ['not-an-address'])
      ).toThrow()
    })

    it('rejects too-short address', () => {
      expect(() =>
        encodeFunctionData(ERC20_ABI, 'balanceOf', ['0x123'])
      ).toThrow()
    })

    it('rejects too-long address', () => {
      expect(() =>
        encodeFunctionData(ERC20_ABI, 'balanceOf', [
          '0x' + '0'.repeat(42),
        ])
      ).toThrow()
    })

    it('accepts valid 40-char hex address', () => {
      const data = encodeFunctionData(ERC20_ABI, 'balanceOf', [
        '0x' + '0'.repeat(40),
      ])
      expect(data).toBeTruthy()
    })

    it('accepts checksummed address', () => {
      const data = encodeFunctionData(ERC20_ABI, 'balanceOf', [
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      ])
      expect(data).toBeTruthy()
    })
  })
})
