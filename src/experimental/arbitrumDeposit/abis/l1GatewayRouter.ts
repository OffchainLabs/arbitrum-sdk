export const l1GatewayRouterAbi = [
  {
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' }
    ],
    name: 'outboundTransfer',
    outputs: [{ type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{ name: '_token', type: 'address' }],
    name: 'getGateway',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const 