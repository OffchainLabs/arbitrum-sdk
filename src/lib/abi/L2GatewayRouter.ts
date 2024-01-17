/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PayableOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export interface L2GatewayRouterInterface extends utils.Interface {
  contractName: "L2GatewayRouter";
  functions: {
    "calculateL2TokenAddress(address)": FunctionFragment;
    "counterpartGateway()": FunctionFragment;
    "defaultGateway()": FunctionFragment;
    "finalizeInboundTransfer(address,address,address,uint256,bytes)": FunctionFragment;
    "getGateway(address)": FunctionFragment;
    "getOutboundCalldata(address,address,address,uint256,bytes)": FunctionFragment;
    "initialize(address,address)": FunctionFragment;
    "l1TokenToGateway(address)": FunctionFragment;
    "outboundTransfer(address,address,uint256,bytes)": FunctionFragment;
    "postUpgradeInit()": FunctionFragment;
    "router()": FunctionFragment;
    "setDefaultGateway(address)": FunctionFragment;
    "setGateway(address[],address[])": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "calculateL2TokenAddress",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "counterpartGateway",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "defaultGateway",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "finalizeInboundTransfer",
    values: [string, string, string, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "getGateway", values: [string]): string;
  encodeFunctionData(
    functionFragment: "getOutboundCalldata",
    values: [string, string, string, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "initialize",
    values: [string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "l1TokenToGateway",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "outboundTransfer",
    values: [string, string, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "postUpgradeInit",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "router", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "setDefaultGateway",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "setGateway",
    values: [string[], string[]]
  ): string;

  decodeFunctionResult(
    functionFragment: "calculateL2TokenAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "counterpartGateway",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "defaultGateway",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "finalizeInboundTransfer",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getGateway", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getOutboundCalldata",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "l1TokenToGateway",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "outboundTransfer",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "postUpgradeInit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "router", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setDefaultGateway",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "setGateway", data: BytesLike): Result;

  events: {
    "DefaultGatewayUpdated(address)": EventFragment;
    "GatewaySet(address,address)": EventFragment;
    "TransferRouted(address,address,address,address)": EventFragment;
    "TxToL1(address,address,uint256,bytes)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "DefaultGatewayUpdated"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GatewaySet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "TransferRouted"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "TxToL1"): EventFragment;
}

export type DefaultGatewayUpdatedEvent = TypedEvent<
  [string],
  { newDefaultGateway: string }
>;

export type DefaultGatewayUpdatedEventFilter =
  TypedEventFilter<DefaultGatewayUpdatedEvent>;

export type GatewaySetEvent = TypedEvent<
  [string, string],
  { l1Token: string; gateway: string }
>;

export type GatewaySetEventFilter = TypedEventFilter<GatewaySetEvent>;

export type TransferRoutedEvent = TypedEvent<
  [string, string, string, string],
  { token: string; _userFrom: string; _userTo: string; gateway: string }
>;

export type TransferRoutedEventFilter = TypedEventFilter<TransferRoutedEvent>;

export type TxToL1Event = TypedEvent<
  [string, string, BigNumber, string],
  { _from: string; _to: string; _id: BigNumber; _data: string }
>;

export type TxToL1EventFilter = TypedEventFilter<TxToL1Event>;

export interface L2GatewayRouter extends BaseContract {
  contractName: "L2GatewayRouter";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: L2GatewayRouterInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    calculateL2TokenAddress(
      l1ERC20: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    counterpartGateway(overrides?: CallOverrides): Promise<[string]>;

    defaultGateway(overrides?: CallOverrides): Promise<[string]>;

    finalizeInboundTransfer(
      arg0: string,
      arg1: string,
      arg2: string,
      arg3: BigNumberish,
      arg4: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    getGateway(
      _token: string,
      overrides?: CallOverrides
    ): Promise<[string] & { gateway: string }>;

    getOutboundCalldata(
      _token: string,
      _from: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<[string]>;

    initialize(
      _counterpartGateway: string,
      _defaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    l1TokenToGateway(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    "outboundTransfer(address,address,uint256,bytes)"(
      _l1Token: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    "outboundTransfer(address,address,uint256,uint256,uint256,bytes)"(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      _maxGas: BigNumberish,
      _gasPriceBid: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    postUpgradeInit(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    router(overrides?: CallOverrides): Promise<[string]>;

    setDefaultGateway(
      newL2DefaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setGateway(
      _l1Token: string[],
      _gateway: string[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  calculateL2TokenAddress(
    l1ERC20: string,
    overrides?: CallOverrides
  ): Promise<string>;

  counterpartGateway(overrides?: CallOverrides): Promise<string>;

  defaultGateway(overrides?: CallOverrides): Promise<string>;

  finalizeInboundTransfer(
    arg0: string,
    arg1: string,
    arg2: string,
    arg3: BigNumberish,
    arg4: BytesLike,
    overrides?: PayableOverrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  getGateway(_token: string, overrides?: CallOverrides): Promise<string>;

  getOutboundCalldata(
    _token: string,
    _from: string,
    _to: string,
    _amount: BigNumberish,
    _data: BytesLike,
    overrides?: CallOverrides
  ): Promise<string>;

  initialize(
    _counterpartGateway: string,
    _defaultGateway: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  l1TokenToGateway(arg0: string, overrides?: CallOverrides): Promise<string>;

  "outboundTransfer(address,address,uint256,bytes)"(
    _l1Token: string,
    _to: string,
    _amount: BigNumberish,
    _data: BytesLike,
    overrides?: PayableOverrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  "outboundTransfer(address,address,uint256,uint256,uint256,bytes)"(
    _token: string,
    _to: string,
    _amount: BigNumberish,
    _maxGas: BigNumberish,
    _gasPriceBid: BigNumberish,
    _data: BytesLike,
    overrides?: PayableOverrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  postUpgradeInit(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  router(overrides?: CallOverrides): Promise<string>;

  setDefaultGateway(
    newL2DefaultGateway: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setGateway(
    _l1Token: string[],
    _gateway: string[],
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    calculateL2TokenAddress(
      l1ERC20: string,
      overrides?: CallOverrides
    ): Promise<string>;

    counterpartGateway(overrides?: CallOverrides): Promise<string>;

    defaultGateway(overrides?: CallOverrides): Promise<string>;

    finalizeInboundTransfer(
      arg0: string,
      arg1: string,
      arg2: string,
      arg3: BigNumberish,
      arg4: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    getGateway(_token: string, overrides?: CallOverrides): Promise<string>;

    getOutboundCalldata(
      _token: string,
      _from: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    initialize(
      _counterpartGateway: string,
      _defaultGateway: string,
      overrides?: CallOverrides
    ): Promise<void>;

    l1TokenToGateway(arg0: string, overrides?: CallOverrides): Promise<string>;

    "outboundTransfer(address,address,uint256,bytes)"(
      _l1Token: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    "outboundTransfer(address,address,uint256,uint256,uint256,bytes)"(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      _maxGas: BigNumberish,
      _gasPriceBid: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<string>;

    postUpgradeInit(overrides?: CallOverrides): Promise<void>;

    router(overrides?: CallOverrides): Promise<string>;

    setDefaultGateway(
      newL2DefaultGateway: string,
      overrides?: CallOverrides
    ): Promise<void>;

    setGateway(
      _l1Token: string[],
      _gateway: string[],
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "DefaultGatewayUpdated(address)"(
      newDefaultGateway?: null
    ): DefaultGatewayUpdatedEventFilter;
    DefaultGatewayUpdated(
      newDefaultGateway?: null
    ): DefaultGatewayUpdatedEventFilter;

    "GatewaySet(address,address)"(
      l1Token?: string | null,
      gateway?: string | null
    ): GatewaySetEventFilter;
    GatewaySet(
      l1Token?: string | null,
      gateway?: string | null
    ): GatewaySetEventFilter;

    "TransferRouted(address,address,address,address)"(
      token?: string | null,
      _userFrom?: string | null,
      _userTo?: string | null,
      gateway?: null
    ): TransferRoutedEventFilter;
    TransferRouted(
      token?: string | null,
      _userFrom?: string | null,
      _userTo?: string | null,
      gateway?: null
    ): TransferRoutedEventFilter;

    "TxToL1(address,address,uint256,bytes)"(
      _from?: string | null,
      _to?: string | null,
      _id?: BigNumberish | null,
      _data?: null
    ): TxToL1EventFilter;
    TxToL1(
      _from?: string | null,
      _to?: string | null,
      _id?: BigNumberish | null,
      _data?: null
    ): TxToL1EventFilter;
  };

  estimateGas: {
    calculateL2TokenAddress(
      l1ERC20: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    counterpartGateway(overrides?: CallOverrides): Promise<BigNumber>;

    defaultGateway(overrides?: CallOverrides): Promise<BigNumber>;

    finalizeInboundTransfer(
      arg0: string,
      arg1: string,
      arg2: string,
      arg3: BigNumberish,
      arg4: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    getGateway(_token: string, overrides?: CallOverrides): Promise<BigNumber>;

    getOutboundCalldata(
      _token: string,
      _from: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    initialize(
      _counterpartGateway: string,
      _defaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    l1TokenToGateway(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    "outboundTransfer(address,address,uint256,bytes)"(
      _l1Token: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    "outboundTransfer(address,address,uint256,uint256,uint256,bytes)"(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      _maxGas: BigNumberish,
      _gasPriceBid: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    postUpgradeInit(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    router(overrides?: CallOverrides): Promise<BigNumber>;

    setDefaultGateway(
      newL2DefaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setGateway(
      _l1Token: string[],
      _gateway: string[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    calculateL2TokenAddress(
      l1ERC20: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    counterpartGateway(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    defaultGateway(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    finalizeInboundTransfer(
      arg0: string,
      arg1: string,
      arg2: string,
      arg3: BigNumberish,
      arg4: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    getGateway(
      _token: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getOutboundCalldata(
      _token: string,
      _from: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    initialize(
      _counterpartGateway: string,
      _defaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    l1TokenToGateway(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "outboundTransfer(address,address,uint256,bytes)"(
      _l1Token: string,
      _to: string,
      _amount: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    "outboundTransfer(address,address,uint256,uint256,uint256,bytes)"(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      _maxGas: BigNumberish,
      _gasPriceBid: BigNumberish,
      _data: BytesLike,
      overrides?: PayableOverrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    postUpgradeInit(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    router(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    setDefaultGateway(
      newL2DefaultGateway: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setGateway(
      _l1Token: string[],
      _gateway: string[],
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
