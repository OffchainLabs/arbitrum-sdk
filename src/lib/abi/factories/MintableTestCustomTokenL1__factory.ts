/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  MintableTestCustomTokenL1,
  MintableTestCustomTokenL1Interface,
} from "../MintableTestCustomTokenL1";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_gateway",
        type: "address",
      },
      {
        internalType: "address",
        name: "_router",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
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
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
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
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
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
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "amount",
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
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "bridgeMint",
    outputs: [],
    stateMutability: "nonpayable",
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
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "subtractedValue",
        type: "uint256",
      },
    ],
    name: "decreaseAllowance",
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
    inputs: [],
    name: "gateway",
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
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "addedValue",
        type: "uint256",
      },
    ],
    name: "increaseAllowance",
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
    inputs: [],
    name: "isArbitrumEnabled",
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
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "nonces",
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
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "v",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "r",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "s",
        type: "bytes32",
      },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "l2CustomTokenAddress",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "maxSubmissionCostForCustomGateway",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxSubmissionCostForRouter",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxGasForCustomGateway",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxGasForRouter",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "gasPriceBid",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "valueForGateway",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "valueForRouter",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "creditBackAddress",
        type: "address",
      },
    ],
    name: "registerTokenOnL2",
    outputs: [],
    stateMutability: "payable",
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
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
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
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
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
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_value",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_data",
        type: "bytes",
      },
    ],
    name: "transferAndCall",
    outputs: [
      {
        internalType: "bool",
        name: "success",
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
        name: "sender",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
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
  "0x60806040523480156200001157600080fd5b506040516200209f3803806200209f83398101604081905262000034916200051d565b60005482908290610100900460ff1615808015620000595750600054600160ff909116105b806200008957506200007630620001cf60201b620009be1760201c565b15801562000089575060005460ff166001145b620000e15760405162461bcd60e51b815260206004820152602e60248201526000805160206200203f83398151915260448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084015b60405180910390fd5b6000805460ff19166001179055801562000105576000805461ff0019166101001790555b80156200013b576000805461ff0019169055604051600181526000805160206200207f8339815191529060200160405180910390a15b5060cc80546001600160a01b038085166001600160a01b03199283161790925560cd805492841692909116919091179055604080518082018252600f81526e2a32b9ba21bab9ba37b6aa37b5b2b760891b6020808301919091528251808401909352600483526321a0a92160e11b83820152620001c59290601290620009cd620001de821b17901c565b50505050620006c6565b6001600160a01b03163b151590565b600054610100900460ff1615808015620001ff5750600054600160ff909116105b806200022f57506200021c30620001cf60201b620009be1760201c565b1580156200022f575060005460ff166001145b620002835760405162461bcd60e51b815260206004820152602e60248201526000805160206200203f83398151915260448201526d191e481a5b9a5d1a585b1a5e995960921b6064820152608401620000d8565b6000805460ff191660011790558015620002a7576000805461ff0019166101001790555b620002b28462000309565b620002be848462000393565b6038805460ff191660ff8416179055801562000303576000805461ff0019169055604051600181526000805160206200207f8339815191529060200160405180910390a15b50505050565b600054610100900460ff16620003655760405162461bcd60e51b815260206004820152602b60248201526000805160206200205f83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d8565b6200039081604051806040016040528060018152602001603160f81b815250620003ff60201b60201c565b50565b600054610100900460ff16620003ef5760405162461bcd60e51b815260206004820152602b60248201526000805160206200205f83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d8565b620003fb828262000475565b5050565b600054610100900460ff166200045b5760405162461bcd60e51b815260206004820152602b60248201526000805160206200205f83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d8565b815160209283012081519190920120606591909155606655565b600054610100900460ff16620004d15760405162461bcd60e51b815260206004820152602b60248201526000805160206200205f83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d8565b6036620004df8382620005fa565b506037620004ee8282620005fa565b50506038805460ff1916601217905550565b80516001600160a01b03811681146200051857600080fd5b919050565b600080604083850312156200053157600080fd5b6200053c8362000500565b91506200054c6020840162000500565b90509250929050565b634e487b7160e01b600052604160045260246000fd5b600181811c908216806200058057607f821691505b602082108103620005a157634e487b7160e01b600052602260045260246000fd5b50919050565b601f821115620005f557600081815260208120601f850160051c81016020861015620005d05750805b601f850160051c820191505b81811015620005f157828155600101620005dc565b5050505b505050565b81516001600160401b0381111562000616576200061662000555565b6200062e816200062784546200056b565b84620005a7565b602080601f8311600181146200066657600084156200064d5750858301515b600019600386901b1c1916600185901b178555620005f1565b600085815260208120601f198616915b82811015620006975788860151825594840194600190910190840162000676565b5085821015620006b65787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b61196980620006d66000396000f3fe60806040526004361061012a5760003560e01c806370a08231116100ab578063a457c2d71161006f578063a457c2d71461031d578063a9059cbb1461033d578063d505accf1461035d578063dd62ed3e1461037d578063f887ea401461039d578063fc792d8e146103bd57600080fd5b806370a08231146102935780637ecebe00146102b35780638c2a993e146102d35780638e5f5ad1146102f357806395d89b411461030857600080fd5b806323b872dd116100f257806323b872dd146101f8578063313ce567146102185780633644e5151461023e57806339509351146102535780634000aea01461027357600080fd5b806306fdde031461012f578063095ea7b31461015a578063116191b61461018a5780631249c58b146101c257806318160ddd146101d9575b600080fd5b34801561013b57600080fd5b506101446103d0565b6040516101519190611428565b60405180910390f35b34801561016657600080fd5b5061017a61017536600461145e565b610462565b6040519015158152602001610151565b34801561019657600080fd5b5060cc546101aa906001600160a01b031681565b6040516001600160a01b039091168152602001610151565b3480156101ce57600080fd5b506101d761047c565b005b3480156101e557600080fd5b506035545b604051908152602001610151565b34801561020457600080fd5b5061017a610213366004611488565b61048c565b34801561022457600080fd5b5060385460ff165b60405160ff9091168152602001610151565b34801561024a57600080fd5b506101ea6104a1565b34801561025f57600080fd5b5061017a61026e36600461145e565b6104b0565b34801561027f57600080fd5b5061017a61028e3660046114da565b6104d2565b34801561029f57600080fd5b506101ea6102ae3660046115a5565b610548565b3480156102bf57600080fd5b506101ea6102ce3660046115a5565b610553565b3480156102df57600080fd5b506101d76102ee36600461145e565b610571565b3480156102ff57600080fd5b5061022c6105cf565b34801561031457600080fd5b50610144610625565b34801561032957600080fd5b5061017a61033836600461145e565b610634565b34801561034957600080fd5b5061017a61035836600461145e565b6106ba565b34801561036957600080fd5b506101d76103783660046115c0565b6106c8565b34801561038957600080fd5b506101ea610398366004611633565b61082c565b3480156103a957600080fd5b5060cd546101aa906001600160a01b031681565b6101d76103cb366004611666565b610857565b6060603680546103df906116dd565b80601f016020809104026020016040519081016040528092919081815260200182805461040b906116dd565b80156104585780601f1061042d57610100808354040283529160200191610458565b820191906000526020600020905b81548152906001019060200180831161043b57829003601f168201915b5050505050905090565b600033610470818585610b02565b60019150505b92915050565b61048a336302faf080610c26565b565b6000610499848484610ce7565b949350505050565b60006104ab610cf4565b905090565b6000336104708185856104c3838361082c565b6104cd9190611711565b610b02565b60006104de84846106ba565b50836001600160a01b0316336001600160a01b03167fe19260aff97b920c7df27010903aeb9c8d2be5d310a2c67824cf3f15396e4c168585604051610524929190611732565b60405180910390a3833b1561053e5761053e848484610d6f565b5060019392505050565b600061047682610dd9565b6001600160a01b038116600090815260996020526040812054610476565b60cc546001600160a01b031633146105c15760405162461bcd60e51b815260206004820152600e60248201526d4f4e4c595f6c314741544557415960901b60448201526064015b60405180910390fd5b6105cb8282610c26565b5050565b60cd54600090600160a01b900460ff1661061f5760405162461bcd60e51b81526020600482015260116024820152701393d517d156141150d5115117d0d05313607a1b60448201526064016105b8565b5060b190565b6060603780546103df906116dd565b60003381610642828661082c565b9050838110156106a25760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084016105b8565b6106af8286868403610b02565b506001949350505050565b600033610470818585610df7565b834211156107185760405162461bcd60e51b815260206004820152601d60248201527f45524332305065726d69743a206578706972656420646561646c696e6500000060448201526064016105b8565b60007f6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c98888886107478c610fa2565b6040805160208101969096526001600160a01b0394851690860152929091166060840152608083015260a082015260c0810186905260e00160405160208183030381529060405280519060200120905060006107a282610fca565b905060006107b282878787611018565b9050896001600160a01b0316816001600160a01b0316146108155760405162461bcd60e51b815260206004820152601e60248201527f45524332305065726d69743a20696e76616c6964207369676e6174757265000060448201526064016105b8565b6108208a8a8a610b02565b50505050505050505050565b6001600160a01b03918216600090815260346020908152604080832093909416825291909152205490565b600060cd60149054906101000a900460ff169050600160cd60146101000a81548160ff02191690831515021790555060cc60009054906101000a90046001600160a01b03166001600160a01b031663ca346d4a858c8a898e886040518763ffffffff1660e01b81526004016108d095949392919061174b565b60206040518083038185885af11580156108ee573d6000803e3d6000fd5b50505050506040513d601f19601f82011682018060405250810190610913919061177b565b5060cd5460cc54604051632d67b72d60e01b81526001600160a01b0392831692632d67b72d92879261095392909116908b908b908f908a9060040161174b565b60206040518083038185885af1158015610971573d6000803e3d6000fd5b50505050506040513d601f19601f82011682018060405250810190610996919061177b565b5060cd8054911515600160a01b0260ff60a01b19909216919091179055505050505050505050565b6001600160a01b03163b151590565b600054610100900460ff16158080156109ed5750600054600160ff909116105b80610a0e57506109fc306109be565b158015610a0e575060005460ff166001145b610a715760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016105b8565b6000805460ff191660011790558015610a94576000805461ff0019166101001790555b610a9d84611040565b610aa7848461108d565b6038805460ff191660ff84161790558015610afc576000805461ff0019169055604051600181527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b50505050565b6001600160a01b038316610b645760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b60648201526084016105b8565b6001600160a01b038216610bc55760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b60648201526084016105b8565b6001600160a01b0383811660008181526034602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6001600160a01b038216610c7c5760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f20616464726573730060448201526064016105b8565b8060356000828254610c8e9190611711565b90915550506001600160a01b0382166000818152603360209081526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35050565b60006104998484846110c3565b60006104ab7f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f610d2360655490565b6066546040805160208101859052908101839052606081018290524660808201523060a082015260009060c0016040516020818303038152906040528051906020012090509392505050565b604051635260769b60e11b815283906001600160a01b0382169063a4c0ed3690610da190339087908790600401611794565b600060405180830381600087803b158015610dbb57600080fd5b505af1158015610dcf573d6000803e3d6000fd5b5050505050505050565b6001600160a01b038116600090815260336020526040812054610476565b6001600160a01b038316610e5b5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b60648201526084016105b8565b6001600160a01b038216610ebd5760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b60648201526084016105b8565b6001600160a01b03831660009081526033602052604090205481811015610f355760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b60648201526084016105b8565b6001600160a01b0380851660008181526033602052604080822086860390559286168082529083902080548601905591517fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90610f959086815260200190565b60405180910390a3610afc565b6001600160a01b03811660009081526099602052604090208054600181018255905b50919050565b6000610476610fd7610cf4565b8360405161190160f01b6020820152602281018390526042810182905260009060620160405160208183030381529060405280519060200120905092915050565b6000806000611029878787876110dc565b9150915061103681611196565b5095945050505050565b600054610100900460ff166110675760405162461bcd60e51b81526004016105b8906117c4565b61108a81604051806040016040528060018152602001603160f81b8152506112db565b50565b600054610100900460ff166110b45760405162461bcd60e51b81526004016105b8906117c4565b6105cb828261131c565b505050565b6000336110d185828561136e565b6106af858585610df7565b6000806fa2a8918ca85bafe22016d0b997e4df60600160ff1b03831115611109575060009050600361118d565b6040805160008082526020820180845289905260ff881692820192909252606081018690526080810185905260019060a0016020604051602081039080840390855afa15801561115d573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b0381166111865760006001925092505061118d565b9150600090505b94509492505050565b60008160048111156111aa576111aa61180f565b036111b25750565b60018160048111156111c6576111c661180f565b0361120e5760405162461bcd60e51b815260206004820152601860248201527745434453413a20696e76616c6964207369676e617475726560401b60448201526064016105b8565b60028160048111156112225761122261180f565b0361126f5760405162461bcd60e51b815260206004820152601f60248201527f45434453413a20696e76616c6964207369676e6174757265206c656e6774680060448201526064016105b8565b60038160048111156112835761128361180f565b0361108a5760405162461bcd60e51b815260206004820152602260248201527f45434453413a20696e76616c6964207369676e6174757265202773272076616c604482015261756560f01b60648201526084016105b8565b600054610100900460ff166113025760405162461bcd60e51b81526004016105b8906117c4565b815160209283012081519190920120606591909155606655565b600054610100900460ff166113435760405162461bcd60e51b81526004016105b8906117c4565b603661134f8382611873565b50603761135c8282611873565b50506038805460ff1916601217905550565b600061137a848461082c565b90506000198114610afc57818110156113d55760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e636500000060448201526064016105b8565b610afc8484848403610b02565b6000815180845260005b81811015611408576020818501810151868301820152016113ec565b506000602082860101526020601f19601f83011685010191505092915050565b60208152600061143b60208301846113e2565b9392505050565b80356001600160a01b038116811461145957600080fd5b919050565b6000806040838503121561147157600080fd5b61147a83611442565b946020939093013593505050565b60008060006060848603121561149d57600080fd5b6114a684611442565b92506114b460208501611442565b9150604084013590509250925092565b634e487b7160e01b600052604160045260246000fd5b6000806000606084860312156114ef57600080fd5b6114f884611442565b925060208401359150604084013567ffffffffffffffff8082111561151c57600080fd5b818601915086601f83011261153057600080fd5b813581811115611542576115426114c4565b604051601f8201601f19908116603f0116810190838211818310171561156a5761156a6114c4565b8160405282815289602084870101111561158357600080fd5b8260208601602083013760006020848301015280955050505050509250925092565b6000602082840312156115b757600080fd5b61143b82611442565b600080600080600080600060e0888a0312156115db57600080fd5b6115e488611442565b96506115f260208901611442565b95506040880135945060608801359350608088013560ff8116811461161657600080fd5b9699959850939692959460a0840135945060c09093013592915050565b6000806040838503121561164657600080fd5b61164f83611442565b915061165d60208401611442565b90509250929050565b60008060008060008060008060006101208a8c03121561168557600080fd5b61168e8a611442565b985060208a0135975060408a0135965060608a0135955060808a0135945060a08a0135935060c08a0135925060e08a013591506116ce6101008b01611442565b90509295985092959850929598565b600181811c908216806116f157607f821691505b602082108103610fc457634e487b7160e01b600052602260045260246000fd5b8082018082111561047657634e487b7160e01b600052601160045260246000fd5b82815260406020820152600061049960408301846113e2565b6001600160a01b039586168152602081019490945260408401929092526060830152909116608082015260a00190565b60006020828403121561178d57600080fd5b5051919050565b60018060a01b03841681528260208201526060604082015260006117bb60608301846113e2565b95945050505050565b6020808252602b908201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960408201526a6e697469616c697a696e6760a81b606082015260800190565b634e487b7160e01b600052602160045260246000fd5b601f8211156110be57600081815260208120601f850160051c8101602086101561184c5750805b601f850160051c820191505b8181101561186b57828155600101611858565b505050505050565b815167ffffffffffffffff81111561188d5761188d6114c4565b6118a18161189b84546116dd565b84611825565b602080601f8311600181146118d657600084156118be5750858301515b600019600386901b1c1916600185901b17855561186b565b600085815260208120601f198616915b82811015611905578886015182559484019460019091019084016118e6565b50858210156119235787850151600019600388901b60f8161c191681555b5050505050600190811b0190555056fea2646970667358221220b805b01e0b3f01659ebeaed9a44a38a9662118d4801d5e4c9902245be928651b64736f6c63430008100033496e697469616c697a61626c653a20636f6e747261637420697320616c726561496e697469616c697a61626c653a20636f6e7472616374206973206e6f7420697f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498";

type MintableTestCustomTokenL1ConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: MintableTestCustomTokenL1ConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class MintableTestCustomTokenL1__factory extends ContractFactory {
  constructor(...args: MintableTestCustomTokenL1ConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "MintableTestCustomTokenL1";
  }

  deploy(
    _gateway: string,
    _router: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<MintableTestCustomTokenL1> {
    return super.deploy(
      _gateway,
      _router,
      overrides || {}
    ) as Promise<MintableTestCustomTokenL1>;
  }
  getDeployTransaction(
    _gateway: string,
    _router: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(_gateway, _router, overrides || {});
  }
  attach(address: string): MintableTestCustomTokenL1 {
    return super.attach(address) as MintableTestCustomTokenL1;
  }
  connect(signer: Signer): MintableTestCustomTokenL1__factory {
    return super.connect(signer) as MintableTestCustomTokenL1__factory;
  }
  static readonly contractName: "MintableTestCustomTokenL1";
  public readonly contractName: "MintableTestCustomTokenL1";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): MintableTestCustomTokenL1Interface {
    return new utils.Interface(_abi) as MintableTestCustomTokenL1Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): MintableTestCustomTokenL1 {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as MintableTestCustomTokenL1;
  }
}
