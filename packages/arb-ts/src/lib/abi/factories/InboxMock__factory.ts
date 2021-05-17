/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer } from 'ethers'
import { Provider, TransactionRequest } from '@ethersproject/providers'
import { Contract, ContractFactory, Overrides } from '@ethersproject/contracts'

import type { InboxMock } from '../InboxMock'

export class InboxMock__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer)
  }

  deploy(overrides?: Overrides): Promise<InboxMock> {
    return super.deploy(overrides || {}) as Promise<InboxMock>
  }
  getDeployTransaction(overrides?: Overrides): TransactionRequest {
    return super.getDeployTransaction(overrides || {})
  }
  attach(address: string): InboxMock {
    return super.attach(address) as InboxMock
  }
  connect(signer: Signer): InboxMock__factory {
    return super.connect(signer) as InboxMock__factory
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): InboxMock {
    return new Contract(address, _abi, signerOrProvider) as InboxMock
  }
}

const _abi = [
  {
    inputs: [],
    name: 'activeOutbox',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'bridge',
    outputs: [
      {
        internalType: 'contract IBridge',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'destAddr',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'l2CallValue',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxSubmissionCost',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'excessFeeRefundAddress',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'callValueRefundAddress',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'maxGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPriceBid',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'createRetryableTicket',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l2ToL1Sender',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'setL2ToL1Sender',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

const _bytecode =
  '0x6080604052600080546001600160a01b031916905534801561002057600080fd5b50610201806100306000396000f3fe60806040526004361061004a5760003560e01c806311b383ac1461004f578063679b6ded1461008457806380648b0214610141578063ab5d894314610172578063e78cea9214610172575b600080fd5b34801561005b57600080fd5b506100826004803603602081101561007257600080fd5b50356001600160a01b0316610187565b005b61012f600480360361010081101561009b57600080fd5b6001600160a01b038235811692602081013592604082013592606083013581169260808101359091169160a08201359160c081013591810190610100810160e08201356401000000008111156100f057600080fd5b82018360208201111561010257600080fd5b8035906020019184600183028401116401000000008311171561012457600080fd5b5090925090506101a9565b60408051918252519081900360200190f35b34801561014d57600080fd5b506101566101b8565b604080516001600160a01b039092168252519081900360200190f35b34801561017e57600080fd5b506101566101c7565b600080546001600160a01b0319166001600160a01b0392909216919091179055565b60009998505050505050505050565b6000546001600160a01b031690565b309056fea264697066735822122013bb6faeffa8d9e5d6aabaeeffc7c3c6cc9e7d229c7a01d1a872e525665b7dc664736f6c634300060b0033'
