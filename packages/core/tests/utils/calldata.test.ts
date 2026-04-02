import { describe, it, expect } from 'vitest'
import { getErc20ParentAddressFromParentToChildTxRequest } from '../../src/utils/calldata'
import { encodeFunctionData } from '../../src/encoding/abi'

const TOKEN_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const DEST_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const REFUND_ADDRESS = '0x1234567890AbcdEF1234567890aBcdef12345678'

const outboundTransferAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransfer',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

const outboundTransferCustomRefundAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransferCustomRefund',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_refundTo', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

describe('Calldata Decode', () => {
  it('extracts token address from outboundTransfer calldata', () => {
    const data = encodeFunctionData(
      outboundTransferAbi,
      'outboundTransfer',
      [TOKEN_ADDRESS, DEST_ADDRESS, 1000000n, 100000n, 1000000000n, '0x']
    )

    const result = getErc20ParentAddressFromParentToChildTxRequest({
      to: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
      data,
      value: 0n,
    })

    expect(result.toLowerCase()).toBe(TOKEN_ADDRESS.toLowerCase())
  })

  it('extracts token address from outboundTransferCustomRefund calldata', () => {
    const data = encodeFunctionData(
      outboundTransferCustomRefundAbi,
      'outboundTransferCustomRefund',
      [
        TOKEN_ADDRESS,
        REFUND_ADDRESS,
        DEST_ADDRESS,
        1000000n,
        100000n,
        1000000000n,
        '0x',
      ]
    )

    const result = getErc20ParentAddressFromParentToChildTxRequest({
      to: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
      data,
      value: 0n,
    })

    expect(result.toLowerCase()).toBe(TOKEN_ADDRESS.toLowerCase())
  })

  it('throws for unrecognized calldata', () => {
    expect(() =>
      getErc20ParentAddressFromParentToChildTxRequest({
        to: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
        data: '0xdeadbeef',
        value: 0n,
      })
    ).toThrow('data signature not matching deposit methods')
  })
})
