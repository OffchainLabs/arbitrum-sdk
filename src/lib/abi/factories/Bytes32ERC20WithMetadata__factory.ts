/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  Bytes32ERC20WithMetadata,
  Bytes32ERC20WithMetadataInterface,
} from "../Bytes32ERC20WithMetadata";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "guy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "src",
        type: "address",
      },
      {
        internalType: "address",
        name: "dst",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x60806040526426b0b5b2b960d91b6002556226a5a960e91b6003556004805460ff1916601217905534801561003357600080fd5b506103f9806100436000396000f3fe608060405234801561001057600080fd5b50600436106100835760003560e01c806306fdde0314610088578063095ea7b3146100a45780631249c58b146100c757806323b872dd146100d1578063313ce567146100e457806370a082311461010357806395d89b4114610123578063a9059cbb1461012c578063dd62ed3e1461013f575b600080fd5b61009160025481565b6040519081526020015b60405180910390f35b6100b76100b23660046102d3565b61016a565b604051901515815260200161009b565b6100cf610198565b005b6100b76100df3660046102fd565b6101c6565b6004546100f19060ff1681565b60405160ff909116815260200161009b565b610091610111366004610339565b60006020819052908152604090205481565b61009160035481565b6100b761013a3660046102d3565b6102a3565b61009161014d366004610354565b600160209081526000928352604080842090915290825290205481565b3360009081526001602081815260408084206001600160a01b03871685529091529091208290555b92915050565b3360009081526020819052604081208054670de0b6b3a764000092906101bf90849061039d565b9091555050565b60006001600160a01b038416331461022c576001600160a01b03841660009081526001602090815260408083203384529091529020546102079083906103b0565b6001600160a01b03851660009081526001602090815260408083203384529091529020555b6001600160a01b0384166000908152602081905260409020546102509083906103b0565b6001600160a01b03808616600090815260208190526040808220939093559085168152205461028090839061039d565b6001600160a01b0384166000908152602081905260409020555060019392505050565b60006102b03384846101c6565b9392505050565b80356001600160a01b03811681146102ce57600080fd5b919050565b600080604083850312156102e657600080fd5b6102ef836102b7565b946020939093013593505050565b60008060006060848603121561031257600080fd5b61031b846102b7565b9250610329602085016102b7565b9150604084013590509250925092565b60006020828403121561034b57600080fd5b6102b0826102b7565b6000806040838503121561036757600080fd5b610370836102b7565b915061037e602084016102b7565b90509250929050565b634e487b7160e01b600052601160045260246000fd5b8082018082111561019257610192610387565b818103818111156101925761019261038756fea2646970667358221220422530bf51954b0e37f4875803276e37ef9f9a41da1ae6e4b69a329418f0a9dd64736f6c63430008100033";

type Bytes32ERC20WithMetadataConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: Bytes32ERC20WithMetadataConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class Bytes32ERC20WithMetadata__factory extends ContractFactory {
  constructor(...args: Bytes32ERC20WithMetadataConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "Bytes32ERC20WithMetadata";
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<Bytes32ERC20WithMetadata> {
    return super.deploy(overrides || {}) as Promise<Bytes32ERC20WithMetadata>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): Bytes32ERC20WithMetadata {
    return super.attach(address) as Bytes32ERC20WithMetadata;
  }
  connect(signer: Signer): Bytes32ERC20WithMetadata__factory {
    return super.connect(signer) as Bytes32ERC20WithMetadata__factory;
  }
  static readonly contractName: "Bytes32ERC20WithMetadata";
  public readonly contractName: "Bytes32ERC20WithMetadata";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): Bytes32ERC20WithMetadataInterface {
    return new utils.Interface(_abi) as Bytes32ERC20WithMetadataInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): Bytes32ERC20WithMetadata {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as Bytes32ERC20WithMetadata;
  }
}
