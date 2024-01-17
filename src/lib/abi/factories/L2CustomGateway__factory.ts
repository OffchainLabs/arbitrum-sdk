/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  L2CustomGateway,
  L2CustomGatewayInterface,
} from "../L2CustomGateway";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "l1Token",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "DepositFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "l1Address",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "l2Address",
        type: "address",
      },
    ],
    name: "TokenSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "TxToL1",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "l1Token",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_l2ToL1Id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_exitNum",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "WithdrawalInitiated",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "l1ERC20",
        type: "address",
      },
    ],
    name: "calculateL2TokenAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "counterpartGateway",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "exitNum",
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
        name: "_token",
        type: "address",
      },
      {
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "finalizeInboundTransfer",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
      {
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "getOutboundCalldata",
    outputs: [
      {
        internalType: "bytes",
        name: "outboundCalldata",
        type: "bytes",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_l1Counterpart",
        type: "address",
      },
      {
        internalType: "address",
        name: "_router",
        type: "address",
      },
    ],
    name: "initialize",
    outputs: [],
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
    name: "l1ToL2Token",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_l1Token",
        type: "address",
      },
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "outboundTransfer",
    outputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_l1Token",
        type: "address",
      },
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "outboundTransfer",
    outputs: [
      {
        internalType: "bytes",
        name: "res",
        type: "bytes",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "postUpgradeInit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "l1Address",
        type: "address[]",
      },
      {
        internalType: "address[]",
        name: "l2Address",
        type: "address[]",
      },
    ],
    name: "registerTokenFromL1",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "router",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50611462806100206000396000f3fe6080604052600436106100a75760003560e01c806395fcea781161006457806395fcea7814610198578063a0c76a96146101ad578063a7e28d48146101cd578063d2ce7d65146101ed578063d4f5532f14610200578063f887ea401461022057600080fd5b8063015234ab146100ac5780632db09c1c146100d55780632e567b361461010d578063485cc955146101225780637b3a3c8b146101425780638a2dc01414610162575b600080fd5b3480156100b857600080fd5b506100c260025481565b6040519081526020015b60405180910390f35b3480156100e157600080fd5b506000546100f5906001600160a01b031681565b6040516001600160a01b0390911681526020016100cc565b61012061011b366004610e1b565b610240565b005b34801561012e57600080fd5b5061012061013d366004610e9f565b610474565b610155610150366004610ed8565b610482565b6040516100cc9190610f9a565b34801561016e57600080fd5b506100f561017d366004610fb4565b6003602052600090815260409020546001600160a01b031681565b3480156101a457600080fd5b5061012061049e565b3480156101b957600080fd5b506101556101c8366004611073565b610516565b3480156101d957600080fd5b506100f56101e8366004610fb4565b610581565b6101556101fb3660046110f1565b61059f565b34801561020c57600080fd5b5061012061021b3660046111ba565b6107eb565b34801561022c57600080fd5b506001546100f5906001600160a01b031681565b60005461025e906001600160a01b031661111161111160901b010190565b6001600160a01b0316336001600160a01b0316146102975760405162461bcd60e51b815260040161028e90611225565b60405180910390fd5b6000806102a4848461096c565b9150915080516000146102c257506040805160208101909152600081525b60006102cd89610581565b90506001600160a01b0381163b6103015760006102ee8a838b8b8b89610986565b905080156102ff575050505061046c565b505b60408051600481526024810182526020810180516001600160e01b031663c2eeeebd60e01b179052905160009182916001600160a01b0385169161034491611257565b600060405180830381855afa9150503d806000811461037f576040519150601f19603f3d011682016040523d82523d6000602084013e610384565b606091505b50915091506000821580610399575060208251105b156103a6575060016103d5565b60006103b383600c6109b2565b90508c6001600160a01b0316816001600160a01b0316146103d357600191505b505b8015610403576103f78c308d8c60405180602001604052806000815250610a1a565b5050505050505061046c565b505050610411818888610a9a565b866001600160a01b0316886001600160a01b03168a6001600160a01b03167fc7f2e9c55c40a50fbc217dfc70cd39a222940dfa62145aa0ca49eb9535d4fcb28960405161046091815260200190565b60405180910390a45050505b505050505050565b61047e8282610b01565b5050565b6060610494868686600080888861059f565b9695505050505050565b60006104c87fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d61035490565b9050336001600160a01b038216146105135760405162461bcd60e51b815260206004820152600e60248201526d2727aa2fa32927a6afa0a226a4a760911b604482015260640161028e565b50565b6060632e567b3660e01b8686868661053060025488610b4e565b604051602401610544959493929190611273565b60408051601f198184030181529190526020810180516001600160e01b03166001600160e01b031990931692909217909152905095945050505050565b6001600160a01b039081166000908152600360205260409020541690565b606034156105da5760405162461bcd60e51b81526020600482015260086024820152674e4f5f56414c554560c01b604482015260640161028e565b6001546000906060906001600160a01b03163303610606576105fc8585610b7a565b9092509050610643565b33915084848080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152509293505050505b8051156106885760405162461bcd60e51b8152602060048201526013602482015272115615149057d110551057d11254d050931151606a1b604482015260640161028e565b6000806106948c610581565b90506001600160a01b0381163b6106e25760405162461bcd60e51b81526020600482015260126024820152711513d2d15397d393d517d111541313d6515160721b604482015260640161028e565b8b6001600160a01b0316816001600160a01b031663c2eeeebd6040518163ffffffff1660e01b8152600401602060405180830381865afa15801561072a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061074e91906112b9565b6001600160a01b03161461079c5760405162461bcd60e51b81526020600482015260156024820152742727aa2fa2ac2822a1aa22a22fa618afaa27a5a2a760591b604482015260640161028e565b6107a781858c610b96565b99506107b68c858d8d87610a1a565b915050806040516020016107cc91815260200190565b6040516020818303038152906040529350505050979650505050505050565b600054610809906001600160a01b031661111161111160901b010190565b6001600160a01b0316336001600160a01b0316146108395760405162461bcd60e51b815260040161028e90611225565b60005b8381101561096557828282818110610856576108566112d6565b905060200201602081019061086b9190610fb4565b60036000878785818110610881576108816112d6565b90506020020160208101906108969190610fb4565b6001600160a01b039081168252602082019290925260400160002080546001600160a01b031916929091169190911790558282828181106108d9576108d96112d6565b90506020020160208101906108ee9190610fb4565b6001600160a01b0316858583818110610909576109096112d6565b905060200201602081019061091e9190610fb4565b6001600160a01b03167f0dd664a155dd89526bb019e22b00291bb7ca9d07ba3ec4a1a76b410da9797ceb60405160405180910390a38061095d81611302565b91505061083c565b5050505050565b60608061097b8385018561131b565b909590945092505050565b60006109a48730878660405180602001604052806000815250610a1a565b506001979650505050505050565b60006109bf82601461137e565b83511015610a045760405162461bcd60e51b815260206004820152601260248201527152656164206f7574206f6620626f756e647360701b604482015260640161028e565b5081810160200151600160601b90045b92915050565b60025460009081610a388786610a338b838b848b610516565b610c04565b604080516001600160a01b038b81168252602082018690529181018890529192508291818916918a16907f3073a74ecb728d10be779fe19a74a1428e20468f5b4d167bf9c73d9067847d739060600160405180910390a4979650505050505050565b6040516346154c9f60e11b81526001600160a01b03838116600483015260248201839052841690638c2a993e90604401600060405180830381600087803b158015610ae457600080fd5b505af1158015610af8573d6000803e3d6000fd5b50505050505050565b610b0b8282610c3c565b6001600160a01b03811661047e5760405162461bcd60e51b815260206004820152600a6024820152692120a22fa927aaaa22a960b11b604482015260640161028e565b60608282604051602001610b63929190611391565b604051602081830303815290604052905092915050565b60006060610b8a838501856113aa565b915091505b9250929050565b6040516374f4f54760e01b81526001600160a01b03838116600483015260248201839052600091908516906374f4f54790604401600060405180830381600087803b158015610be457600080fd5b505af1158015610bf8573d6000803e3d6000fd5b50939695505050505050565b6002805460009182610c1583611302565b909155505060008054610c34919086906001600160a01b031685610cfe565b949350505050565b6001600160a01b038216610c885760405162461bcd60e51b81526020600482015260136024820152721253959053125117d0d3d55395115494105495606a1b604482015260640161028e565b6000546001600160a01b031615610cd05760405162461bcd60e51b815260206004820152600c60248201526b1053149150511657d253925560a21b604482015260640161028e565b600080546001600160a01b039384166001600160a01b03199182161790915560018054929093169116179055565b6040516349460b4d60e11b8152600090819060649063928c169a908890610d2b90889088906004016113ef565b60206040518083038185885af1158015610d49573d6000803e3d6000fd5b50505050506040513d601f19601f82011682018060405250810190610d6e9190611413565b905080846001600160a01b0316866001600160a01b03167f2b986d32a0536b7e19baa48ab949fec7b903b7fad7730820b20632d100cc3a6886604051610db49190610f9a565b60405180910390a495945050505050565b6001600160a01b038116811461051357600080fd5b60008083601f840112610dec57600080fd5b5081356001600160401b03811115610e0357600080fd5b602083019150836020828501011115610b8f57600080fd5b60008060008060008060a08789031215610e3457600080fd5b8635610e3f81610dc5565b95506020870135610e4f81610dc5565b94506040870135610e5f81610dc5565b93506060870135925060808701356001600160401b03811115610e8157600080fd5b610e8d89828a01610dda565b979a9699509497509295939492505050565b60008060408385031215610eb257600080fd5b8235610ebd81610dc5565b91506020830135610ecd81610dc5565b809150509250929050565b600080600080600060808688031215610ef057600080fd5b8535610efb81610dc5565b94506020860135610f0b81610dc5565b93506040860135925060608601356001600160401b03811115610f2d57600080fd5b610f3988828901610dda565b969995985093965092949392505050565b60005b83811015610f65578181015183820152602001610f4d565b50506000910152565b60008151808452610f86816020860160208601610f4a565b601f01601f19169290920160200192915050565b602081526000610fad6020830184610f6e565b9392505050565b600060208284031215610fc657600080fd5b8135610fad81610dc5565b634e487b7160e01b600052604160045260246000fd5b600082601f830112610ff857600080fd5b81356001600160401b038082111561101257611012610fd1565b604051601f8301601f19908116603f0116810190828211818310171561103a5761103a610fd1565b8160405283815286602085880101111561105357600080fd5b836020870160208301376000602085830101528094505050505092915050565b600080600080600060a0868803121561108b57600080fd5b853561109681610dc5565b945060208601356110a681610dc5565b935060408601356110b681610dc5565b92506060860135915060808601356001600160401b038111156110d857600080fd5b6110e488828901610fe7565b9150509295509295909350565b600080600080600080600060c0888a03121561110c57600080fd5b873561111781610dc5565b9650602088013561112781610dc5565b955060408801359450606088013593506080880135925060a08801356001600160401b0381111561115757600080fd5b6111638a828b01610dda565b989b979a50959850939692959293505050565b60008083601f84011261118857600080fd5b5081356001600160401b0381111561119f57600080fd5b6020830191508360208260051b8501011115610b8f57600080fd5b600080600080604085870312156111d057600080fd5b84356001600160401b03808211156111e757600080fd5b6111f388838901611176565b9096509450602087013591508082111561120c57600080fd5b5061121987828801611176565b95989497509550505050565b6020808252601890820152774f4e4c595f434f554e544552504152545f4741544557415960401b604082015260600190565b60008251611269818460208701610f4a565b9190910192915050565b6001600160a01b0386811682528581166020830152841660408201526060810183905260a0608082018190526000906112ae90830184610f6e565b979650505050505050565b6000602082840312156112cb57600080fd5b8151610fad81610dc5565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b600060018201611314576113146112ec565b5060010190565b6000806040838503121561132e57600080fd5b82356001600160401b038082111561134557600080fd5b61135186838701610fe7565b9350602085013591508082111561136757600080fd5b5061137485828601610fe7565b9150509250929050565b80820180821115610a1457610a146112ec565b828152604060208201526000610c346040830184610f6e565b600080604083850312156113bd57600080fd5b82356113c881610dc5565b915060208301356001600160401b038111156113e357600080fd5b61137485828601610fe7565b6001600160a01b0383168152604060208201819052600090610c3490830184610f6e565b60006020828403121561142557600080fd5b505191905056fea2646970667358221220cadbdf7ae66a7419642c39dffd34540b74321557e9b9f3d7e9c9d5d17e6ec23b64736f6c63430008100033";

type L2CustomGatewayConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: L2CustomGatewayConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class L2CustomGateway__factory extends ContractFactory {
  constructor(...args: L2CustomGatewayConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "L2CustomGateway";
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<L2CustomGateway> {
    return super.deploy(overrides || {}) as Promise<L2CustomGateway>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): L2CustomGateway {
    return super.attach(address) as L2CustomGateway;
  }
  connect(signer: Signer): L2CustomGateway__factory {
    return super.connect(signer) as L2CustomGateway__factory;
  }
  static readonly contractName: "L2CustomGateway";
  public readonly contractName: "L2CustomGateway";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): L2CustomGatewayInterface {
    return new utils.Interface(_abi) as L2CustomGatewayInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): L2CustomGateway {
    return new Contract(address, _abi, signerOrProvider) as L2CustomGateway;
  }
}
