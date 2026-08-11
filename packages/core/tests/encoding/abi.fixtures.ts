/**
 * ABI with various types for comprehensive encoding and decoding tests.
 */
export const COMPREHENSIVE_ABI = [
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
