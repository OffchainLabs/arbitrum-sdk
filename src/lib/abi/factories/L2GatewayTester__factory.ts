/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  L2GatewayTester,
  L2GatewayTesterInterface,
} from "../L2GatewayTester";

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
    inputs: [],
    name: "beaconProxyFactory",
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
    name: "cloneableProxyHash",
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
        name: "l1ERC20",
        type: "address",
      },
    ],
    name: "getUserSalt",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "pure",
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
      {
        internalType: "address",
        name: "_beaconProxyFactory",
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
    inputs: [
      {
        internalType: "address",
        name: "_stubValue",
        type: "address",
      },
    ],
    name: "setStubAddressOracleReturn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "stubAddressOracleReturn",
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
    name: "triggerTxToL1",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5061195e806100206000396000f3fe6080604052600436106100d35760003560e01c806397881f8d1161007a57806397881f8d1461035b578063a0c76a9614610370578063a7e28d4814610449578063b8f41ee41461047c578063c05e6a9514610491578063c0c53b8b146104a6578063d2ce7d65146104eb578063f887ea4014610585576100d3565b8063015234ab146100d85780632db09c1c146100ff5780632e567b361461013057806355e47ee8146101c8578063569f26ff146101dd5780637b3a3c8b1461021057806386f1b3f71461031357806395fcea7814610346575b600080fd5b3480156100e457600080fd5b506100ed61059a565b60408051918252519081900360200190f35b34801561010b57600080fd5b506101146105a0565b604080516001600160a01b039092168252519081900360200190f35b6101c6600480360360a081101561014657600080fd5b6001600160a01b03823581169260208101358216926040820135909216916060820135919081019060a081016080820135600160201b81111561018857600080fd5b82018360208201111561019a57600080fd5b803590602001918460018302840111600160201b831117156101bb57600080fd5b5090925090506105af565b005b3480156101d457600080fd5b50610114610859565b3480156101e957600080fd5b506100ed6004803603602081101561020057600080fd5b50356001600160a01b0316610868565b61029e6004803603608081101561022657600080fd5b6001600160a01b03823581169260208101359091169160408201359190810190608081016060820135600160201b81111561026057600080fd5b82018360208201111561027257600080fd5b803590602001918460018302840111600160201b8311171561029357600080fd5b509092509050610899565b6040805160208082528351818301528351919283929083019185019080838360005b838110156102d85781810151838201526020016102c0565b50505050905090810190601f1680156103055780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561031f57600080fd5b506101c66004803603602081101561033657600080fd5b50356001600160a01b03166108b5565b34801561035257600080fd5b506101c66108d7565b34801561036757600080fd5b506100ed610934565b34801561037c57600080fd5b5061029e600480360360a081101561039357600080fd5b6001600160a01b03823581169260208101358216926040820135909216916060820135919081019060a081016080820135600160201b8111156103d557600080fd5b8201836020820111156103e757600080fd5b803590602001918460018302840111600160201b8311171561040857600080fd5b91908080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152509295506109b6945050505050565b34801561045557600080fd5b506101146004803603602081101561046c57600080fd5b50356001600160a01b0316610aae565b34801561048857600080fd5b506101c6610ae3565b34801561049d57600080fd5b50610114610cc4565b3480156104b257600080fd5b506101c6600480360360608110156104c957600080fd5b506001600160a01b038135811691602081013582169160409091013516610cd3565b61029e600480360360c081101561050157600080fd5b6001600160a01b0382358116926020810135909116916040820135916060810135916080820135919081019060c0810160a0820135600160201b81111561054757600080fd5b82018360208201111561055957600080fd5b803590602001918460018302840111600160201b8311171561057a57600080fd5b509092509050610d4d565b34801561059157600080fd5b50610114610fa7565b60035481565b6001546001600160a01b031681565b6001546001600160a01b03163314806105e357506001546001600160a01b03166105d833610fb6565b6001600160a01b0316145b61062f576040805162461bcd60e51b81526020600482015260186024820152774f4e4c595f434f554e544552504152545f4741544557415960401b604482015290519081900360640190fd5b60608061063c8484610fc5565b91509150805160001461065a57506040805160208101909152600081525b600061066589610aae565b9050610679816001600160a01b03166110ef565b6106a057600061068d8a838b8b8b896110f5565b9050801561069e5750505050610851565b505b60408051600481526024810182526020810180516001600160e01b031663c2eeeebd60e01b178152915181516000936060936001600160a01b038716939092909182918083835b602083106107065780518252601f1990920191602091820191016106e7565b6001836020036101000a038019825116818451168082178552505050505050905001915050600060405180830381855afa9150503d8060008114610766576040519150601f19603f3d011682016040523d82523d6000602084013e61076b565b606091505b50915091506000821580610780575060208251105b1561078d575060016107bc565b600061079a83600c61129f565b90508c6001600160a01b0316816001600160a01b0316146107ba57600191505b505b80156107ea576107de8c308d8c604051806020016040528060008152506112ff565b50505050505050610851565b5050506107f881888861137f565b866001600160a01b0316886001600160a01b03168a6001600160a01b03167fc7f2e9c55c40a50fbc217dfc70cd39a222940dfa62145aa0ca49eb9535d4fcb2896040518082815260200191505060405180910390a45050505b505050505050565b6005546001600160a01b031681565b604080516001600160a01b03831660208083019190915282518083038201815291830190925280519101205b919050565b60606108ab8686866000808888610d4d565b9695505050505050565b600580546001600160a01b0319166001600160a01b0392909216919091179055565b60006108e16113f3565b9050336001600160a01b03821614610931576040805162461bcd60e51b815260206004820152600e60248201526d2727aa2fa32927a6afa0a226a4a760911b604482015290519081900360640190fd5b50565b6000600460009054906101000a90046001600160a01b03166001600160a01b03166397881f8d6040518163ffffffff1660e01b815260040160206040518083038186803b15801561098457600080fd5b505afa158015610998573d6000803e3d6000fd5b505050506040513d60208110156109ae57600080fd5b505190505b90565b6060632e567b3660e01b868686866109d060035488611418565b6040516001600160a01b0380871660248301908152868216604484015290851660648301526084820184905260a060a48301908152835160c484015283519192909160e490910190602085019080838360005b83811015610a3b578181015183820152602001610a23565b50505050905090810190601f168015610a685780820380516001836020036101000a031916815260200191505b5060408051601f198184030181529190526020810180516001600160e01b03166001600160e01b0319909a16999099179098525095965050505050505095945050505050565b6005546000906001600160a01b031615610ad457506005546001600160a01b0316610894565b610add826114ab565b92915050565b6000805481906000198101908110610af757fe5b6000918252602091829020600391909102018054600180830154600280850180546040805161010096831615969096026000190190911692909204601f81018890048802850188019092528184529496506001600160a01b039093169490936060939091830182828015610bac5780601f10610b8157610100808354040283529160200191610bac565b820191906000526020600020905b815481529060010190602001808311610b8f57829003601f168201915b505050505090506000805480610bbe57fe5b60008281526020812060036000199093019283020180546001600160a01b03191681556001810182905590610bf6600283018261184c565b5050905560006060846001600160a01b031684846040518082805190602001908083835b60208310610c395780518252601f199092019160209182019101610c1a565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d8060008114610c9b576040519150601f19603f3d011682016040523d82523d6000602084013e610ca0565b606091505b50915091508160008114610cb357610cbb565b815160208301fd5b50505050505050565b6004546001600160a01b031681565b610cdd8383611548565b6001600160a01b038116610d29576040805162461bcd60e51b815260206004820152600e60248201526d24a72b20a624a22fa122a0a1a7a760911b604482015290519081900360640190fd5b600480546001600160a01b0319166001600160a01b03929092169190911790555050565b60603415610d8d576040805162461bcd60e51b81526020600482015260086024820152674e4f5f56414c554560c01b604482015290519081900360640190fd5b60006060610d9a3361159e565b15610db357610da985856115b2565b9092509050610df0565b33915084848080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152509293505050505b805115610e3a576040805162461bcd60e51b8152602060048201526013602482015272115615149057d110551057d11254d050931151606a1b604482015290519081900360640190fd5b600080610e468c610aae565b9050610e5a816001600160a01b03166110ef565b610ea0576040805162461bcd60e51b81526020600482015260126024820152711513d2d15397d393d517d111541313d6515160721b604482015290519081900360640190fd5b8b6001600160a01b0316816001600160a01b031663c2eeeebd6040518163ffffffff1660e01b815260040160206040518083038186803b158015610ee357600080fd5b505afa158015610ef7573d6000803e3d6000fd5b505050506040513d6020811015610f0d57600080fd5b50516001600160a01b031614610f62576040805162461bcd60e51b81526020600482015260156024820152742727aa2fa2ac2822a1aa22a22fa618afaa27a5a2a760591b604482015290519081900360640190fd5b610f6d81858c6115f0565b9950610f7c8c858d8d876112ff565b6040805160208082019390935281518082039093018352810190529c9b505050505050505050505050565b6002546001600160a01b031681565b61111061111160901b01190190565b60608083836040811015610fd857600080fd5b810190602081018135600160201b811115610ff257600080fd5b82018360208201111561100457600080fd5b803590602001918460018302840111600160201b8311171561102557600080fd5b91908080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152509295949360208101935035915050600160201b81111561107757600080fd5b82018360208201111561108957600080fd5b803590602001918460018302840111600160201b831117156110aa57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250969b929a509198505050505050505050565b3b151590565b60008061110188610868565b60048054604080516329a5c5cf60e01b8152928301849052519293506000926001600160a01b03909116916329a5c5cf91602480830192602092919082900301818787803b15801561115257600080fd5b505af1158015611166573d6000803e3d6000fd5b505050506040513d602081101561117c57600080fd5b505160408051630c4edbe960e11b81526001600160a01b038c811660048301908152602483019384528851604484015288519495509085169363189db7d2938e938a9392606490910190602085019080838360005b838110156111e95781810151838201526020016111d1565b50505050905090810190601f1680156112165780820380516001836020036101000a031916815260200191505b509350505050600060405180830381600087803b15801561123657600080fd5b505af115801561124a573d6000803e3d6000fd5b50505050876001600160a01b0316816001600160a01b03161415611273576000925050506108ab565b61128f89308988604051806020016040528060008152506112ff565b5060019998505050505050505050565b600081601401835110156112ef576040805162461bcd60e51b815260206004820152601260248201527152656164206f7574206f6620626f756e647360701b604482015290519081900360640190fd5b500160200151600160601b900490565b6003546000908161131d87866113188b838b848b6109b6565b611662565b604080516001600160a01b038b811682526020820186905281830189905291519293508392828a16928b16917f3073a74ecb728d10be779fe19a74a1428e20468f5b4d167bf9c73d9067847d73919081900360600190a4979650505050505050565b826001600160a01b0316638c2a993e83836040518363ffffffff1660e01b815260040180836001600160a01b03166001600160a01b0316815260200182815260200192505050600060405180830381600087803b1580156113df57600080fd5b505af1158015610cbb573d6000803e3d6000fd5b7fb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d61035490565b606082826040516020018083815260200180602001828103825283818151815260200191508051906020019080838360005b8381101561146257818101518382015260200161144a565b50505050905090810190601f16801561148f5780820380516001836020036101000a031916815260200191505b5060408051601f19818403018152919052979650505050505050565b6004546000906001600160a01b031663e75b2141306114c985610868565b6040518363ffffffff1660e01b815260040180836001600160a01b03166001600160a01b031681526020018281526020019250505060206040518083038186803b15801561151657600080fd5b505afa15801561152a573d6000803e3d6000fd5b505050506040513d602081101561154057600080fd5b505192915050565b6115528282611691565b6001600160a01b03811661159a576040805162461bcd60e51b815260206004820152600a6024820152692120a22fa927aaaa22a960b11b604482015290519081900360640190fd5b5050565b6002546001600160a01b0390811691161490565b60006060838360408110156115c657600080fd5b6001600160a01b038235169190810190604081016020820135600160201b81111561107757600080fd5b604080516374f4f54760e01b81526001600160a01b0384811660048301526024820184905291516000928616916374f4f547916044808301928692919082900301818387803b15801561164257600080fd5b505af1158015611656573d6000803e3d6000fd5b50939695505050505050565b6003805460019081019091555460009061168990829086906001600160a01b03168561175d565b949350505050565b6001600160a01b0382166116e2576040805162461bcd60e51b81526020600482015260136024820152721253959053125117d0d3d55395115494105495606a1b604482015290519081900360640190fd5b6001546001600160a01b03161561172f576040805162461bcd60e51b815260206004820152600c60248201526b1053149150511657d253925560a21b604482015290519081900360640190fd5b600180546001600160a01b039384166001600160a01b03199182161790915560028054929093169116179055565b600061176b85858585611774565b95945050505050565b604080516060810182526001600160a01b03848116825260208083018881529383018581526000805460018101825581805285517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563600390920291820180546001600160a01b0319169190961617855595517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e564870155905180519195611841937f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e56590910192910190611890565b505050949350505050565b50805460018160011615610100020316600290046000825580601f106118725750610931565b601f016020900490600052602060002090810190610931919061190e565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106118d157805160ff19168380011785556118fe565b828001600101855582156118fe579182015b828111156118fe5782518255916020019190600101906118e3565b5061190a92915061190e565b5090565b6109b391905b8082111561190a576000815560010161191456fea264697066735822122088e0fc636dddc987efffd60759a0b8a2df69a5ea029ccff57bb2c066bf2b782264736f6c634300060b0033";

type L2GatewayTesterConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: L2GatewayTesterConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class L2GatewayTester__factory extends ContractFactory {
  constructor(...args: L2GatewayTesterConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "L2GatewayTester";
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<L2GatewayTester> {
    return super.deploy(overrides || {}) as Promise<L2GatewayTester>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): L2GatewayTester {
    return super.attach(address) as L2GatewayTester;
  }
  connect(signer: Signer): L2GatewayTester__factory {
    return super.connect(signer) as L2GatewayTester__factory;
  }
  static readonly contractName: "L2GatewayTester";
  public readonly contractName: "L2GatewayTester";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): L2GatewayTesterInterface {
    return new utils.Interface(_abi) as L2GatewayTesterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): L2GatewayTester {
    return new Contract(address, _abi, signerOrProvider) as L2GatewayTester;
  }
}
