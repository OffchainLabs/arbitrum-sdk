export const inboxAbi = [
  {
    inputs: [],
    name: 'depositEth',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'l2CallValue', type: 'uint256' },
      { name: 'maxSubmissionCost', type: 'uint256' },
      { name: 'excessFeeRefundAddress', type: 'address' },
      { name: 'callValueRefundAddress', type: 'address' },
      { name: 'gasLimit', type: 'uint256' },
      { name: 'maxFeePerGas', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'createRetryableTicket',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'messageNum', type: 'uint256' },
      { indexed: false, name: 'data', type: 'bytes' },
    ],
    name: 'InboxMessageDelivered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'messageNum', type: 'uint256' }],
    name: 'InboxMessageDeliveredFromOrigin',
    type: 'event',
  },
] as const
