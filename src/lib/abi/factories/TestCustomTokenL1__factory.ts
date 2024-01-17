/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  TestCustomTokenL1,
  TestCustomTokenL1Interface,
} from "../TestCustomTokenL1";

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
  "0x60806040523480156200001157600080fd5b5060405162001ffe38038062001ffe833981016040819052620000349162000517565b600054610100900460ff1615808015620000555750600054600160ff909116105b806200008557506200007230620001c960201b6200094d1760201c565b15801562000085575060005460ff166001145b620000dd5760405162461bcd60e51b815260206004820152602e602482015260008051602062001f9e83398151915260448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084015b60405180910390fd5b6000805460ff19166001179055801562000101576000805461ff0019166101001790555b801562000137576000805461ff00191690556040516001815260008051602062001fde8339815191529060200160405180910390a15b5060cc80546001600160a01b038085166001600160a01b03199283161790925560cd805492841692909116919091179055604080518082018252600f81526e2a32b9ba21bab9ba37b6aa37b5b2b760891b6020808301919091528251808401909352600483526321a0a92160e11b83820152620001c192906012906200095c620001d8821b17901c565b5050620006c0565b6001600160a01b03163b151590565b600054610100900460ff1615808015620001f95750600054600160ff909116105b806200022957506200021630620001c960201b6200094d1760201c565b15801562000229575060005460ff166001145b6200027d5760405162461bcd60e51b815260206004820152602e602482015260008051602062001f9e83398151915260448201526d191e481a5b9a5d1a585b1a5e995960921b6064820152608401620000d4565b6000805460ff191660011790558015620002a1576000805461ff0019166101001790555b620002ac8462000303565b620002b884846200038d565b6038805460ff191660ff84161790558015620002fd576000805461ff00191690556040516001815260008051602062001fde8339815191529060200160405180910390a15b50505050565b600054610100900460ff166200035f5760405162461bcd60e51b815260206004820152602b602482015260008051602062001fbe83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d4565b6200038a81604051806040016040528060018152602001603160f81b815250620003f960201b60201c565b50565b600054610100900460ff16620003e95760405162461bcd60e51b815260206004820152602b602482015260008051602062001fbe83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d4565b620003f582826200046f565b5050565b600054610100900460ff16620004555760405162461bcd60e51b815260206004820152602b602482015260008051602062001fbe83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d4565b815160209283012081519190920120606591909155606655565b600054610100900460ff16620004cb5760405162461bcd60e51b815260206004820152602b602482015260008051602062001fbe83398151915260448201526a6e697469616c697a696e6760a81b6064820152608401620000d4565b6036620004d98382620005f4565b506037620004e88282620005f4565b50506038805460ff1916601217905550565b80516001600160a01b03811681146200051257600080fd5b919050565b600080604083850312156200052b57600080fd5b6200053683620004fa565b91506200054660208401620004fa565b90509250929050565b634e487b7160e01b600052604160045260246000fd5b600181811c908216806200057a57607f821691505b6020821081036200059b57634e487b7160e01b600052602260045260246000fd5b50919050565b601f821115620005ef57600081815260208120601f850160051c81016020861015620005ca5750805b601f850160051c820191505b81811015620005eb57828155600101620005d6565b5050505b505050565b81516001600160401b038111156200061057620006106200054f565b620006288162000621845462000565565b84620005a1565b602080601f831160018114620006605760008415620006475750858301515b600019600386901b1c1916600185901b178555620005eb565b600085815260208120601f198616915b82811015620006915788860151825594840194600190910190840162000670565b5085821015620006b05787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b6118ce80620006d06000396000f3fe60806040526004361061011f5760003560e01c806370a08231116100a0578063a9059cbb11610064578063a9059cbb14610312578063d505accf14610332578063dd62ed3e14610352578063f887ea4014610372578063fc792d8e1461039257600080fd5b806370a08231146102885780637ecebe00146102a85780638e5f5ad1146102c857806395d89b41146102dd578063a457c2d7146102f257600080fd5b806323b872dd116100e757806323b872dd146101ed578063313ce5671461020d5780633644e5151461023357806339509351146102485780634000aea01461026857600080fd5b806306fdde0314610124578063095ea7b31461014f578063116191b61461017f5780631249c58b146101b757806318160ddd146101ce575b600080fd5b34801561013057600080fd5b506101396103a5565b604051610146919061138d565b60405180910390f35b34801561015b57600080fd5b5061016f61016a3660046113c3565b610437565b6040519015158152602001610146565b34801561018b57600080fd5b5060cc5461019f906001600160a01b031681565b6040516001600160a01b039091168152602001610146565b3480156101c357600080fd5b506101cc610451565b005b3480156101da57600080fd5b506035545b604051908152602001610146565b3480156101f957600080fd5b5061016f6102083660046113ed565b610461565b34801561021957600080fd5b5060385460ff165b60405160ff9091168152602001610146565b34801561023f57600080fd5b506101df610476565b34801561025457600080fd5b5061016f6102633660046113c3565b610485565b34801561027457600080fd5b5061016f61028336600461143f565b6104a7565b34801561029457600080fd5b506101df6102a336600461150a565b61051d565b3480156102b457600080fd5b506101df6102c336600461150a565b61053b565b3480156102d457600080fd5b50610221610559565b3480156102e957600080fd5b506101396105b4565b3480156102fe57600080fd5b5061016f61030d3660046113c3565b6105c3565b34801561031e57600080fd5b5061016f61032d3660046113c3565b610649565b34801561033e57600080fd5b506101cc61034d366004611525565b610657565b34801561035e57600080fd5b506101df61036d366004611598565b6107bb565b34801561037e57600080fd5b5060cd5461019f906001600160a01b031681565b6101cc6103a03660046115cb565b6107e6565b6060603680546103b490611642565b80601f01602080910402602001604051908101604052809291908181526020018280546103e090611642565b801561042d5780601f106104025761010080835404028352916020019161042d565b820191906000526020600020905b81548152906001019060200180831161041057829003601f168201915b5050505050905090565b600033610445818585610a91565b60019150505b92915050565b61045f336302faf080610bb5565b565b600061046e848484610c77565b949350505050565b6000610480610c90565b905090565b60003361044581858561049883836107bb565b6104a29190611676565b610a91565b60006104b38484610649565b50836001600160a01b0316336001600160a01b03167fe19260aff97b920c7df27010903aeb9c8d2be5d310a2c67824cf3f15396e4c1685856040516104f9929190611697565b60405180910390a3833b1561051357610513848484610d0b565b5060019392505050565b6001600160a01b03811660009081526033602052604081205461044b565b6001600160a01b03811660009081526099602052604081205461044b565b60cd54600090600160a01b900460ff166105ae5760405162461bcd60e51b81526020600482015260116024820152701393d517d156141150d5115117d0d05313607a1b60448201526064015b60405180910390fd5b5060b190565b6060603780546103b490611642565b600033816105d182866107bb565b9050838110156106315760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084016105a5565b61063e8286868403610a91565b506001949350505050565b600033610445818585610d75565b834211156106a75760405162461bcd60e51b815260206004820152601d60248201527f45524332305065726d69743a206578706972656420646561646c696e6500000060448201526064016105a5565b60007f6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c98888886106d68c610f20565b6040805160208101969096526001600160a01b0394851690860152929091166060840152608083015260a082015260c0810186905260e001604051602081830303815290604052805190602001209050600061073182610f48565b9050600061074182878787610f96565b9050896001600160a01b0316816001600160a01b0316146107a45760405162461bcd60e51b815260206004820152601e60248201527f45524332305065726d69743a20696e76616c6964207369676e6174757265000060448201526064016105a5565b6107af8a8a8a610a91565b50505050505050505050565b6001600160a01b03918216600090815260346020908152604080832093909416825291909152205490565b600060cd60149054906101000a900460ff169050600160cd60146101000a81548160ff02191690831515021790555060cc60009054906101000a90046001600160a01b03166001600160a01b031663ca346d4a858c8a898e886040518763ffffffff1660e01b815260040161085f9594939291906116b0565b60206040518083038185885af115801561087d573d6000803e3d6000fd5b50505050506040513d601f19601f820116820180604052508101906108a291906116e0565b5060cd5460cc54604051632d67b72d60e01b81526001600160a01b0392831692632d67b72d9287926108e292909116908b908b908f908a906004016116b0565b60206040518083038185885af1158015610900573d6000803e3d6000fd5b50505050506040513d601f19601f8201168201806040525081019061092591906116e0565b5060cd8054911515600160a01b0260ff60a01b19909216919091179055505050505050505050565b6001600160a01b03163b151590565b600054610100900460ff161580801561097c5750600054600160ff909116105b8061099d575061098b3061094d565b15801561099d575060005460ff166001145b610a005760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016105a5565b6000805460ff191660011790558015610a23576000805461ff0019166101001790555b610a2c84610fbe565b610a36848461100b565b6038805460ff191660ff84161790558015610a8b576000805461ff0019169055604051600181527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b50505050565b6001600160a01b038316610af35760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b60648201526084016105a5565b6001600160a01b038216610b545760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b60648201526084016105a5565b6001600160a01b0383811660008181526034602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6001600160a01b038216610c0b5760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f20616464726573730060448201526064016105a5565b8060356000828254610c1d9190611676565b90915550506001600160a01b0382166000818152603360209081526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35b5050565b600033610c85858285611041565b61063e858585610d75565b60006104807f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f610cbf60655490565b6066546040805160208101859052908101839052606081018290524660808201523060a082015260009060c0016040516020818303038152906040528051906020012090509392505050565b604051635260769b60e11b815283906001600160a01b0382169063a4c0ed3690610d3d903390879087906004016116f9565b600060405180830381600087803b158015610d5757600080fd5b505af1158015610d6b573d6000803e3d6000fd5b5050505050505050565b6001600160a01b038316610dd95760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b60648201526084016105a5565b6001600160a01b038216610e3b5760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b60648201526084016105a5565b6001600160a01b03831660009081526033602052604090205481811015610eb35760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b60648201526084016105a5565b6001600160a01b0380851660008181526033602052604080822086860390559286168082529083902080548601905591517fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90610f139086815260200190565b60405180910390a3610a8b565b6001600160a01b03811660009081526099602052604090208054600181018255905b50919050565b600061044b610f55610c90565b8360405161190160f01b6020820152602281018390526042810182905260009060620160405160208183030381529060405280519060200120905092915050565b6000806000610fa7878787876110b5565b91509150610fb48161116f565b5095945050505050565b600054610100900460ff16610fe55760405162461bcd60e51b81526004016105a590611729565b61100881604051806040016040528060018152602001603160f81b8152506112b4565b50565b600054610100900460ff166110325760405162461bcd60e51b81526004016105a590611729565b610c7382826112f5565b505050565b600061104d84846107bb565b90506000198114610a8b57818110156110a85760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e636500000060448201526064016105a5565b610a8b8484848403610a91565b6000806fa2a8918ca85bafe22016d0b997e4df60600160ff1b038311156110e25750600090506003611166565b6040805160008082526020820180845289905260ff881692820192909252606081018690526080810185905260019060a0016020604051602081039080840390855afa158015611136573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b03811661115f57600060019250925050611166565b9150600090505b94509492505050565b600081600481111561118357611183611774565b0361118b5750565b600181600481111561119f5761119f611774565b036111e75760405162461bcd60e51b815260206004820152601860248201527745434453413a20696e76616c6964207369676e617475726560401b60448201526064016105a5565b60028160048111156111fb576111fb611774565b036112485760405162461bcd60e51b815260206004820152601f60248201527f45434453413a20696e76616c6964207369676e6174757265206c656e6774680060448201526064016105a5565b600381600481111561125c5761125c611774565b036110085760405162461bcd60e51b815260206004820152602260248201527f45434453413a20696e76616c6964207369676e6174757265202773272076616c604482015261756560f01b60648201526084016105a5565b600054610100900460ff166112db5760405162461bcd60e51b81526004016105a590611729565b815160209283012081519190920120606591909155606655565b600054610100900460ff1661131c5760405162461bcd60e51b81526004016105a590611729565b603661132883826117d8565b50603761133582826117d8565b50506038805460ff1916601217905550565b6000815180845260005b8181101561136d57602081850181015186830182015201611351565b506000602082860101526020601f19601f83011685010191505092915050565b6020815260006113a06020830184611347565b9392505050565b80356001600160a01b03811681146113be57600080fd5b919050565b600080604083850312156113d657600080fd5b6113df836113a7565b946020939093013593505050565b60008060006060848603121561140257600080fd5b61140b846113a7565b9250611419602085016113a7565b9150604084013590509250925092565b634e487b7160e01b600052604160045260246000fd5b60008060006060848603121561145457600080fd5b61145d846113a7565b925060208401359150604084013567ffffffffffffffff8082111561148157600080fd5b818601915086601f83011261149557600080fd5b8135818111156114a7576114a7611429565b604051601f8201601f19908116603f011681019083821181831017156114cf576114cf611429565b816040528281528960208487010111156114e857600080fd5b8260208601602083013760006020848301015280955050505050509250925092565b60006020828403121561151c57600080fd5b6113a0826113a7565b600080600080600080600060e0888a03121561154057600080fd5b611549886113a7565b9650611557602089016113a7565b95506040880135945060608801359350608088013560ff8116811461157b57600080fd5b9699959850939692959460a0840135945060c09093013592915050565b600080604083850312156115ab57600080fd5b6115b4836113a7565b91506115c2602084016113a7565b90509250929050565b60008060008060008060008060006101208a8c0312156115ea57600080fd5b6115f38a6113a7565b985060208a0135975060408a0135965060608a0135955060808a0135945060a08a0135935060c08a0135925060e08a013591506116336101008b016113a7565b90509295985092959850929598565b600181811c9082168061165657607f821691505b602082108103610f4257634e487b7160e01b600052602260045260246000fd5b8082018082111561044b57634e487b7160e01b600052601160045260246000fd5b82815260406020820152600061046e6040830184611347565b6001600160a01b039586168152602081019490945260408401929092526060830152909116608082015260a00190565b6000602082840312156116f257600080fd5b5051919050565b60018060a01b03841681528260208201526060604082015260006117206060830184611347565b95945050505050565b6020808252602b908201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960408201526a6e697469616c697a696e6760a81b606082015260800190565b634e487b7160e01b600052602160045260246000fd5b601f82111561103c57600081815260208120601f850160051c810160208610156117b15750805b601f850160051c820191505b818110156117d0578281556001016117bd565b505050505050565b815167ffffffffffffffff8111156117f2576117f2611429565b611806816118008454611642565b8461178a565b602080601f83116001811461183b57600084156118235750858301515b600019600386901b1c1916600185901b1785556117d0565b600085815260208120601f198616915b8281101561186a5788860151825594840194600190910190840161184b565b50858210156118885787850151600019600388901b60f8161c191681555b5050505050600190811b0190555056fea2646970667358221220520f15bfb656240ff528c02ba44e950568c4a5bc8b8af0ad43122ef494dea13c64736f6c63430008100033496e697469616c697a61626c653a20636f6e747261637420697320616c726561496e697469616c697a61626c653a20636f6e7472616374206973206e6f7420697f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498";

type TestCustomTokenL1ConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: TestCustomTokenL1ConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class TestCustomTokenL1__factory extends ContractFactory {
  constructor(...args: TestCustomTokenL1ConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "TestCustomTokenL1";
  }

  deploy(
    _gateway: string,
    _router: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<TestCustomTokenL1> {
    return super.deploy(
      _gateway,
      _router,
      overrides || {}
    ) as Promise<TestCustomTokenL1>;
  }
  getDeployTransaction(
    _gateway: string,
    _router: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(_gateway, _router, overrides || {});
  }
  attach(address: string): TestCustomTokenL1 {
    return super.attach(address) as TestCustomTokenL1;
  }
  connect(signer: Signer): TestCustomTokenL1__factory {
    return super.connect(signer) as TestCustomTokenL1__factory;
  }
  static readonly contractName: "TestCustomTokenL1";
  public readonly contractName: "TestCustomTokenL1";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TestCustomTokenL1Interface {
    return new utils.Interface(_abi) as TestCustomTokenL1Interface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TestCustomTokenL1 {
    return new Contract(address, _abi, signerOrProvider) as TestCustomTokenL1;
  }
}
