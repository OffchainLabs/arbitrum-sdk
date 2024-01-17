/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  IERC20BridgeCreator,
  IERC20BridgeCreatorInterface,
} from "../IERC20BridgeCreator";

const _abi = [
  {
    inputs: [],
    name: "bridgeTemplate",
    outputs: [
      {
        internalType: "contract IBridge",
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
        name: "adminProxy",
        type: "address",
      },
      {
        internalType: "address",
        name: "rollup",
        type: "address",
      },
      {
        internalType: "address",
        name: "nativeToken",
        type: "address",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "delayBlocks",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "futureBlocks",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "delaySeconds",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "futureSeconds",
            type: "uint256",
          },
        ],
        internalType: "struct ISequencerInbox.MaxTimeVariation",
        name: "maxTimeVariation",
        type: "tuple",
      },
    ],
    name: "createBridge",
    outputs: [
      {
        internalType: "contract IBridge",
        name: "",
        type: "address",
      },
      {
        internalType: "contract SequencerInbox",
        name: "",
        type: "address",
      },
      {
        internalType: "contract IInboxBase",
        name: "",
        type: "address",
      },
      {
        internalType: "contract IRollupEventInbox",
        name: "",
        type: "address",
      },
      {
        internalType: "contract Outbox",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "inboxTemplate",
    outputs: [
      {
        internalType: "contract IInboxBase",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "outboxTemplate",
    outputs: [
      {
        internalType: "contract Outbox",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rollupEventInboxTemplate",
    outputs: [
      {
        internalType: "contract IRollupEventInbox",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "sequencerInboxTemplate",
    outputs: [
      {
        internalType: "contract SequencerInbox",
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
        name: "_bridgeTemplate",
        type: "address",
      },
      {
        internalType: "address",
        name: "_sequencerInboxTemplate",
        type: "address",
      },
      {
        internalType: "address",
        name: "_inboxTemplate",
        type: "address",
      },
      {
        internalType: "address",
        name: "_rollupEventInboxTemplate",
        type: "address",
      },
      {
        internalType: "address",
        name: "_outboxTemplate",
        type: "address",
      },
    ],
    name: "updateTemplates",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class IERC20BridgeCreator__factory {
  static readonly abi = _abi;
  static createInterface(): IERC20BridgeCreatorInterface {
    return new utils.Interface(_abi) as IERC20BridgeCreatorInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IERC20BridgeCreator {
    return new Contract(address, _abi, signerOrProvider) as IERC20BridgeCreator;
  }
}
