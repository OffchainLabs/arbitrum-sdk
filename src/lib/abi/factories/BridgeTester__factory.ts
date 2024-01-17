/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { BridgeTester, BridgeTesterInterface } from "../BridgeTester";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "addr",
        type: "address",
      },
    ],
    name: "NotContract",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "NotDelayedInbox",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "NotOutbox",
    type: "error",
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
        name: "rollup",
        type: "address",
      },
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "NotRollupOrOwner",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "outbox",
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
    name: "BridgeCallTriggered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "inbox",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "InboxToggle",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "messageIndex",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "beforeInboxAcc",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "inbox",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "kind",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "messageDataHash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "baseFeeL1",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "timestamp",
        type: "uint64",
      },
    ],
    name: "MessageDelivered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "outbox",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "OutboxToggle",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "newSequencerInbox",
        type: "address",
      },
    ],
    name: "SequencerInboxUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "acceptFundsFromOldBridge",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "activeOutbox",
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
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "allowedDelayedInboxList",
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
        name: "inbox",
        type: "address",
      },
    ],
    name: "allowedDelayedInboxes",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "allowedOutboxList",
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
        name: "outbox",
        type: "address",
      },
    ],
    name: "allowedOutboxes",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "delayedInboxAccs",
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
    name: "delayedMessageCount",
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
        internalType: "uint8",
        name: "kind",
        type: "uint8",
      },
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "messageDataHash",
        type: "bytes32",
      },
    ],
    name: "enqueueDelayedMessage",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "dataHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "afterDelayedMessagesRead",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "prevMessageCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "newMessageCount",
        type: "uint256",
      },
    ],
    name: "enqueueSequencerMessage",
    outputs: [
      {
        internalType: "uint256",
        name: "seqMessageIndex",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "beforeAcc",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "delayedAcc",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "acc",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
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
        name: "value",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "executeCall",
    outputs: [
      {
        internalType: "bool",
        name: "success",
        type: "bool",
      },
      {
        internalType: "bytes",
        name: "returnData",
        type: "bytes",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract IOwnable",
        name: "rollup_",
        type: "address",
      },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "rollup",
    outputs: [
      {
        internalType: "contract IOwnable",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "sequencerInbox",
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
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "sequencerInboxAccs",
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
    name: "sequencerMessageCount",
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
    name: "sequencerReportedSubMessageCount",
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
        name: "inbox",
        type: "address",
      },
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setDelayedInbox",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "outbox",
        type: "address",
      },
      {
        internalType: "bool",
        name: "enabled",
        type: "bool",
      },
    ],
    name: "setOutbox",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_sequencerInbox",
        type: "address",
      },
    ],
    name: "setSequencerInbox",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "batchPoster",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "dataHash",
        type: "bytes32",
      },
    ],
    name: "submitBatchSpendingReport",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];

const _bytecode =
  "0x60a06040523060805234801561001457600080fd5b5060805161134661002d600039600050506113466000f3fe60806040526004361061012d5760003560e01c80639e5d4c49116100ab578063cee3d7281161006f578063cee3d7281461038e578063d5719dc2146103ae578063e76f5c8d146103ce578063e77145f4146101e9578063eca067ad146103ee578063ee35f3271461040357600080fd5b80639e5d4c49146102ce578063ab5d8943146102fc578063ae60bd1314610311578063c4d66de81461034e578063cb23bcb51461036e57600080fd5b80635fca4a16116100f25780635fca4a161461020b5780637a88b1071461022157806386598a56146102445780638db5993b1461028e578063945e1147146102a157600080fd5b806284120c1461013957806316bf55791461015d578063413b35bd1461017d57806347fb24c5146101c95780634f61f850146101eb57600080fd5b3661013457005b600080fd5b34801561014557600080fd5b506009545b6040519081526020015b60405180910390f35b34801561016957600080fd5b5061014a610178366004611005565b610423565b34801561018957600080fd5b506101b9610198366004611036565b6001600160a01b031660009081526002602052604090206001015460ff1690565b6040519015158152602001610154565b3480156101d557600080fd5b506101e96101e436600461105a565b610444565b005b3480156101f757600080fd5b506101e9610206366004611036565b61074f565b34801561021757600080fd5b5061014a600a5481565b34801561022d57600080fd5b5061014a61023c366004611098565b600092915050565b34801561025057600080fd5b5061026e61025f3660046110c4565b50600093849350839250829150565b604080519485526020850193909352918301526060820152608001610154565b61014a61029c3660046110f6565b610874565b3480156102ad57600080fd5b506102c16102bc366004611005565b6108bf565b604051610154919061113d565b3480156102da57600080fd5b506102ee6102e9366004611151565b6108e9565b6040516101549291906111da565b34801561030857600080fd5b506102c1610a41565b34801561031d57600080fd5b506101b961032c366004611036565b6001600160a01b03166000908152600160208190526040909120015460ff1690565b34801561035a57600080fd5b506101e9610369366004611036565b610a6e565b34801561037a57600080fd5b506006546102c1906001600160a01b031681565b34801561039a57600080fd5b506101e96103a936600461105a565b610b54565b3480156103ba57600080fd5b5061014a6103c9366004611005565b610e56565b3480156103da57600080fd5b506102c16103e9366004611005565b610e66565b3480156103fa57600080fd5b5060085461014a565b34801561040f57600080fd5b506007546102c1906001600160a01b031681565b6009818154811061043357600080fd5b600091825260209091200154905081565b6006546001600160a01b0316331461051c5760065460408051638da5cb5b60e01b815290516000926001600160a01b031691638da5cb5b916004808301926020929190829003018186803b15801561049b57600080fd5b505afa1580156104af573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104d39190611239565b9050336001600160a01b0382161461051a57600654604051630739600760e01b81526105119133916001600160a01b03909116908490600401611256565b60405180910390fd5b505b6001600160a01b0382166000818152600160208181526040928390209182015492518515158152919360ff90931692917f6675ce8882cb71637de5903a193d218cc0544be9c0650cb83e0955f6aa2bf521910160405180910390a28080156105815750825b80610593575080158015610593575082155b1561059e5750505050565b821561062c57604080518082018252600380548252600160208084018281526001600160a01b038a166000818152928490529582209451855551938201805460ff1916941515949094179093558154908101825591527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b0180546001600160a01b0319169091179055610748565b6003805461063c90600190611279565b8154811061064c5761064c61129e565b6000918252602090912001548254600380546001600160a01b0390931692909190811061067b5761067b61129e565b9060005260206000200160006101000a8154816001600160a01b0302191690836001600160a01b0316021790555081600001546001600060038560000154815481106106c9576106c961129e565b60009182526020808320909101546001600160a01b0316835282019290925260400190205560038054806106ff576106ff6112b4565b60008281526020808220830160001990810180546001600160a01b03191690559092019092556001600160a01b03861682526001908190526040822091825501805460ff191690555b50505b5050565b6006546001600160a01b0316331461081e5760065460408051638da5cb5b60e01b815290516000926001600160a01b031691638da5cb5b916004808301926020929190829003018186803b1580156107a657600080fd5b505afa1580156107ba573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107de9190611239565b9050336001600160a01b0382161461081c57600654604051630739600760e01b81526105119133916001600160a01b03909116908490600401611256565b505b600780546001600160a01b0319166001600160a01b0383161790556040517f8c1e6003ed33ca6748d4ad3dd4ecc949065c89dceb31fdf546a5289202763c6a9061086990839061113d565b60405180910390a150565b3360009081526001602081905260408220015460ff166108a9573360405163b6c60ea360e01b8152600401610511919061113d565b6108b7848443424887610e76565b949350505050565b600481815481106108cf57600080fd5b6000918252602090912001546001600160a01b0316905081565b3360009081526002602052604081206001015460609060ff1661092157336040516332ea82ab60e01b8152600401610511919061113d565b821580159061093857506001600160a01b0386163b155b15610958578560405163b5cf5b8f60e01b8152600401610511919061113d565b600580546001600160a01b0319811633179091556040516001600160a01b0391821691881690879061098d90889088906112ca565b60006040518083038185875af1925050503d80600081146109ca576040519150601f19603f3d011682016040523d82523d6000602084013e6109cf565b606091505b50600580546001600160a01b0319166001600160a01b038581169190911790915560405192955090935088169033907f2d9d115ef3e4a606d698913b1eae831a3cdfe20d9a83d48007b0526749c3d46690610a2f908a908a908a906112da565b60405180910390a35094509492505050565b6005546000906001600160a01b039081161415610a5e5750600090565b506005546001600160a01b031690565b600054610100900460ff16610a895760005460ff1615610a8d565b303b155b610af05760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b6064820152608401610511565b600054610100900460ff16158015610b12576000805461ffff19166101011790555b600580546001600160a01b036001600160a01b0319918216811790925560068054909116918416919091179055801561074b576000805461ff00191690555050565b6006546001600160a01b03163314610c235760065460408051638da5cb5b60e01b815290516000926001600160a01b031691638da5cb5b916004808301926020929190829003018186803b158015610bab57600080fd5b505afa158015610bbf573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610be39190611239565b9050336001600160a01b03821614610c2157600654604051630739600760e01b81526105119133916001600160a01b03909116908490600401611256565b505b6001600160a01b038216600081815260026020908152604091829020600181015492518515158152909360ff90931692917f49477e7356dbcb654ab85d7534b50126772d938130d1350e23e2540370c8dffa910160405180910390a2808015610c895750825b80610c9b575080158015610c9b575082155b15610ca65750505050565b8215610d3557604080518082018252600480548252600160208084018281526001600160a01b038a16600081815260029093529582209451855551938201805460ff1916941515949094179093558154908101825591527f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b0180546001600160a01b0319169091179055610748565b60048054610d4590600190611279565b81548110610d5557610d5561129e565b6000918252602090912001548254600480546001600160a01b03909316929091908110610d8457610d8461129e565b9060005260206000200160006101000a8154816001600160a01b0302191690836001600160a01b031602179055508160000154600260006004856000015481548110610dd257610dd261129e565b60009182526020808320909101546001600160a01b031683528201929092526040019020556004805480610e0857610e086112b4565b60008281526020808220830160001990810180546001600160a01b03191690559092019092556001600160a01b03861682526002905260408120908155600101805460ff1916905550505050565b6008818154811061043357600080fd5b600381815481106108cf57600080fd5b600854604080516001600160f81b031960f88a901b166020808301919091526bffffffffffffffffffffffff1960608a901b1660218301526001600160c01b031960c089811b8216603585015288901b16603d830152604582018490526065820186905260858083018690528351808403909101815260a590920190925280519101206000919060008215610f30576008610f12600185611279565b81548110610f2257610f2261129e565b906000526020600020015490505b6040805160208082018490528183018590528251808303840181526060830180855281519190920120600880546001810182556000919091527ff3f7a9fe364faab93b216da50a3214154f22a0a2b415b23a84c8169e8b636ee3015533905260ff8c1660808201526001600160a01b038b1660a082015260c0810187905260e0810188905267ffffffffffffffff89166101008201529051829185917f5e3c1311ea442664e8b1611bfabef659120ea7a0a2cfc0667700bebc69cbffe1918190036101200190a3509098975050505050505050565b60006020828403121561101757600080fd5b5035919050565b6001600160a01b038116811461103357600080fd5b50565b60006020828403121561104857600080fd5b81356110538161101e565b9392505050565b6000806040838503121561106d57600080fd5b82356110788161101e565b91506020830135801515811461108d57600080fd5b809150509250929050565b600080604083850312156110ab57600080fd5b82356110b68161101e565b946020939093013593505050565b600080600080608085870312156110da57600080fd5b5050823594602084013594506040840135936060013592509050565b60008060006060848603121561110b57600080fd5b833560ff8116811461111c57600080fd5b9250602084013561112c8161101e565b929592945050506040919091013590565b6001600160a01b0391909116815260200190565b6000806000806060858703121561116757600080fd5b84356111728161101e565b935060208501359250604085013567ffffffffffffffff8082111561119657600080fd5b818701915087601f8301126111aa57600080fd5b8135818111156111b957600080fd5b8860208285010111156111cb57600080fd5b95989497505060200194505050565b821515815260006020604081840152835180604085015260005b81811015611210578581018301518582016060015282016111f4565b81811115611222576000606083870101525b50601f01601f191692909201606001949350505050565b60006020828403121561124b57600080fd5b81516110538161101e565b6001600160a01b0393841681529183166020830152909116604082015260600190565b60008282101561129957634e487b7160e01b600052601160045260246000fd5b500390565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052603160045260246000fd5b8183823760009101908152919050565b83815260406020820152816040820152818360608301376000818301606090810191909152601f909201601f191601019291505056fea26469706673582212205413682d61846acb7d741b9ffb1063d17057a3bf1a2ba7e0f3223d7bc4ec415464736f6c63430008090033";

type BridgeTesterConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: BridgeTesterConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class BridgeTester__factory extends ContractFactory {
  constructor(...args: BridgeTesterConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "BridgeTester";
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<BridgeTester> {
    return super.deploy(overrides || {}) as Promise<BridgeTester>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): BridgeTester {
    return super.attach(address) as BridgeTester;
  }
  connect(signer: Signer): BridgeTester__factory {
    return super.connect(signer) as BridgeTester__factory;
  }
  static readonly contractName: "BridgeTester";
  public readonly contractName: "BridgeTester";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): BridgeTesterInterface {
    return new utils.Interface(_abi) as BridgeTesterInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): BridgeTester {
    return new Contract(address, _abi, signerOrProvider) as BridgeTester;
  }
}
