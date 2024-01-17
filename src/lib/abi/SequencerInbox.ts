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
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import { Listener, Provider } from "@ethersproject/providers";
import { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";

export declare namespace ISequencerInbox {
  export type TimeBoundsStruct = {
    minTimestamp: BigNumberish;
    maxTimestamp: BigNumberish;
    minBlockNumber: BigNumberish;
    maxBlockNumber: BigNumberish;
  };

  export type TimeBoundsStructOutput = [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ] & {
    minTimestamp: BigNumber;
    maxTimestamp: BigNumber;
    minBlockNumber: BigNumber;
    maxBlockNumber: BigNumber;
  };

  export type MaxTimeVariationStruct = {
    delayBlocks: BigNumberish;
    futureBlocks: BigNumberish;
    delaySeconds: BigNumberish;
    futureSeconds: BigNumberish;
  };

  export type MaxTimeVariationStructOutput = [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ] & {
    delayBlocks: BigNumber;
    futureBlocks: BigNumber;
    delaySeconds: BigNumber;
    futureSeconds: BigNumber;
  };
}

export interface SequencerInboxInterface extends utils.Interface {
  contractName: "SequencerInbox";
  functions: {
    "DATA_AUTHENTICATED_FLAG()": FunctionFragment;
    "HEADER_LENGTH()": FunctionFragment;
    "addSequencerL2Batch(uint256,bytes,uint256,address,uint256,uint256)": FunctionFragment;
    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)": FunctionFragment;
    "batchCount()": FunctionFragment;
    "bridge()": FunctionFragment;
    "dasKeySetInfo(bytes32)": FunctionFragment;
    "forceInclusion(uint256,uint8,uint64[2],uint256,address,bytes32)": FunctionFragment;
    "getKeysetCreationBlock(bytes32)": FunctionFragment;
    "inboxAccs(uint256)": FunctionFragment;
    "initialize(address,(uint256,uint256,uint256,uint256))": FunctionFragment;
    "invalidateKeysetHash(bytes32)": FunctionFragment;
    "isBatchPoster(address)": FunctionFragment;
    "isValidKeysetHash(bytes32)": FunctionFragment;
    "maxTimeVariation()": FunctionFragment;
    "removeDelayAfterFork()": FunctionFragment;
    "rollup()": FunctionFragment;
    "setIsBatchPoster(address,bool)": FunctionFragment;
    "setMaxTimeVariation((uint256,uint256,uint256,uint256))": FunctionFragment;
    "setValidKeyset(bytes)": FunctionFragment;
    "totalDelayedMessagesRead()": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "DATA_AUTHENTICATED_FLAG",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "HEADER_LENGTH",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "addSequencerL2Batch",
    values: [
      BigNumberish,
      BytesLike,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "addSequencerL2BatchFromOrigin",
    values: [BigNumberish, BytesLike, BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "batchCount",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "bridge", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "dasKeySetInfo",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "forceInclusion",
    values: [
      BigNumberish,
      BigNumberish,
      [BigNumberish, BigNumberish],
      BigNumberish,
      string,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "getKeysetCreationBlock",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "inboxAccs",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "initialize",
    values: [string, ISequencerInbox.MaxTimeVariationStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "invalidateKeysetHash",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "isBatchPoster",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "isValidKeysetHash",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "maxTimeVariation",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "removeDelayAfterFork",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "rollup", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "setIsBatchPoster",
    values: [string, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "setMaxTimeVariation",
    values: [ISequencerInbox.MaxTimeVariationStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "setValidKeyset",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "totalDelayedMessagesRead",
    values?: undefined
  ): string;

  decodeFunctionResult(
    functionFragment: "DATA_AUTHENTICATED_FLAG",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "HEADER_LENGTH",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "addSequencerL2Batch",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "addSequencerL2BatchFromOrigin",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "batchCount", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "bridge", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "dasKeySetInfo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "forceInclusion",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getKeysetCreationBlock",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "inboxAccs", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "invalidateKeysetHash",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "isBatchPoster",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "isValidKeysetHash",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "maxTimeVariation",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "removeDelayAfterFork",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "rollup", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setIsBatchPoster",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setMaxTimeVariation",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setValidKeyset",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "totalDelayedMessagesRead",
    data: BytesLike
  ): Result;

  events: {
    "InboxMessageDelivered(uint256,bytes)": EventFragment;
    "InboxMessageDeliveredFromOrigin(uint256)": EventFragment;
    "InvalidateKeyset(bytes32)": EventFragment;
    "OwnerFunctionCalled(uint256)": EventFragment;
    "SequencerBatchData(uint256,bytes)": EventFragment;
    "SequencerBatchDelivered(uint256,bytes32,bytes32,bytes32,uint256,tuple,uint8)": EventFragment;
    "SetValidKeyset(bytes32,bytes)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "InboxMessageDelivered"): EventFragment;
  getEvent(
    nameOrSignatureOrTopic: "InboxMessageDeliveredFromOrigin"
  ): EventFragment;
  getEvent(nameOrSignatureOrTopic: "InvalidateKeyset"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "OwnerFunctionCalled"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "SequencerBatchData"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "SequencerBatchDelivered"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "SetValidKeyset"): EventFragment;
}

export type InboxMessageDeliveredEvent = TypedEvent<
  [BigNumber, string],
  { messageNum: BigNumber; data: string }
>;

export type InboxMessageDeliveredEventFilter =
  TypedEventFilter<InboxMessageDeliveredEvent>;

export type InboxMessageDeliveredFromOriginEvent = TypedEvent<
  [BigNumber],
  { messageNum: BigNumber }
>;

export type InboxMessageDeliveredFromOriginEventFilter =
  TypedEventFilter<InboxMessageDeliveredFromOriginEvent>;

export type InvalidateKeysetEvent = TypedEvent<
  [string],
  { keysetHash: string }
>;

export type InvalidateKeysetEventFilter =
  TypedEventFilter<InvalidateKeysetEvent>;

export type OwnerFunctionCalledEvent = TypedEvent<
  [BigNumber],
  { id: BigNumber }
>;

export type OwnerFunctionCalledEventFilter =
  TypedEventFilter<OwnerFunctionCalledEvent>;

export type SequencerBatchDataEvent = TypedEvent<
  [BigNumber, string],
  { batchSequenceNumber: BigNumber; data: string }
>;

export type SequencerBatchDataEventFilter =
  TypedEventFilter<SequencerBatchDataEvent>;

export type SequencerBatchDeliveredEvent = TypedEvent<
  [
    BigNumber,
    string,
    string,
    string,
    BigNumber,
    ISequencerInbox.TimeBoundsStructOutput,
    number
  ],
  {
    batchSequenceNumber: BigNumber;
    beforeAcc: string;
    afterAcc: string;
    delayedAcc: string;
    afterDelayedMessagesRead: BigNumber;
    timeBounds: ISequencerInbox.TimeBoundsStructOutput;
    dataLocation: number;
  }
>;

export type SequencerBatchDeliveredEventFilter =
  TypedEventFilter<SequencerBatchDeliveredEvent>;

export type SetValidKeysetEvent = TypedEvent<
  [string, string],
  { keysetHash: string; keysetBytes: string }
>;

export type SetValidKeysetEventFilter = TypedEventFilter<SetValidKeysetEvent>;

export interface SequencerInbox extends BaseContract {
  contractName: "SequencerInbox";
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: SequencerInboxInterface;

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
    DATA_AUTHENTICATED_FLAG(overrides?: CallOverrides): Promise<[string]>;

    HEADER_LENGTH(overrides?: CallOverrides): Promise<[BigNumber]>;

    addSequencerL2Batch(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address,uint256,uint256)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    batchCount(overrides?: CallOverrides): Promise<[BigNumber]>;

    bridge(overrides?: CallOverrides): Promise<[string]>;

    dasKeySetInfo(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<
      [boolean, BigNumber] & {
        isValidKeyset: boolean;
        creationBlock: BigNumber;
      }
    >;

    forceInclusion(
      _totalDelayedMessagesRead: BigNumberish,
      kind: BigNumberish,
      l1BlockAndTime: [BigNumberish, BigNumberish],
      baseFeeL1: BigNumberish,
      sender: string,
      messageDataHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    getKeysetCreationBlock(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    inboxAccs(
      index: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[string]>;

    initialize(
      bridge_: string,
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    invalidateKeysetHash(
      ksHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    isBatchPoster(arg0: string, overrides?: CallOverrides): Promise<[boolean]>;

    isValidKeysetHash(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    maxTimeVariation(
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber, BigNumber, BigNumber] & {
        delayBlocks: BigNumber;
        futureBlocks: BigNumber;
        delaySeconds: BigNumber;
        futureSeconds: BigNumber;
      }
    >;

    removeDelayAfterFork(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    rollup(overrides?: CallOverrides): Promise<[string]>;

    setIsBatchPoster(
      addr: string,
      isBatchPoster_: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setMaxTimeVariation(
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    setValidKeyset(
      keysetBytes: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    totalDelayedMessagesRead(overrides?: CallOverrides): Promise<[BigNumber]>;
  };

  DATA_AUTHENTICATED_FLAG(overrides?: CallOverrides): Promise<string>;

  HEADER_LENGTH(overrides?: CallOverrides): Promise<BigNumber>;

  addSequencerL2Batch(
    sequenceNumber: BigNumberish,
    data: BytesLike,
    afterDelayedMessagesRead: BigNumberish,
    gasRefunder: string,
    prevMessageCount: BigNumberish,
    newMessageCount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)"(
    sequenceNumber: BigNumberish,
    data: BytesLike,
    afterDelayedMessagesRead: BigNumberish,
    gasRefunder: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address,uint256,uint256)"(
    sequenceNumber: BigNumberish,
    data: BytesLike,
    afterDelayedMessagesRead: BigNumberish,
    gasRefunder: string,
    prevMessageCount: BigNumberish,
    newMessageCount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  batchCount(overrides?: CallOverrides): Promise<BigNumber>;

  bridge(overrides?: CallOverrides): Promise<string>;

  dasKeySetInfo(
    arg0: BytesLike,
    overrides?: CallOverrides
  ): Promise<
    [boolean, BigNumber] & { isValidKeyset: boolean; creationBlock: BigNumber }
  >;

  forceInclusion(
    _totalDelayedMessagesRead: BigNumberish,
    kind: BigNumberish,
    l1BlockAndTime: [BigNumberish, BigNumberish],
    baseFeeL1: BigNumberish,
    sender: string,
    messageDataHash: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  getKeysetCreationBlock(
    ksHash: BytesLike,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  inboxAccs(index: BigNumberish, overrides?: CallOverrides): Promise<string>;

  initialize(
    bridge_: string,
    maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  invalidateKeysetHash(
    ksHash: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  isBatchPoster(arg0: string, overrides?: CallOverrides): Promise<boolean>;

  isValidKeysetHash(
    ksHash: BytesLike,
    overrides?: CallOverrides
  ): Promise<boolean>;

  maxTimeVariation(
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, BigNumber, BigNumber, BigNumber] & {
      delayBlocks: BigNumber;
      futureBlocks: BigNumber;
      delaySeconds: BigNumber;
      futureSeconds: BigNumber;
    }
  >;

  removeDelayAfterFork(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  rollup(overrides?: CallOverrides): Promise<string>;

  setIsBatchPoster(
    addr: string,
    isBatchPoster_: boolean,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setMaxTimeVariation(
    maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  setValidKeyset(
    keysetBytes: BytesLike,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  totalDelayedMessagesRead(overrides?: CallOverrides): Promise<BigNumber>;

  callStatic: {
    DATA_AUTHENTICATED_FLAG(overrides?: CallOverrides): Promise<string>;

    HEADER_LENGTH(overrides?: CallOverrides): Promise<BigNumber>;

    addSequencerL2Batch(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      overrides?: CallOverrides
    ): Promise<void>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address,uint256,uint256)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    batchCount(overrides?: CallOverrides): Promise<BigNumber>;

    bridge(overrides?: CallOverrides): Promise<string>;

    dasKeySetInfo(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<
      [boolean, BigNumber] & {
        isValidKeyset: boolean;
        creationBlock: BigNumber;
      }
    >;

    forceInclusion(
      _totalDelayedMessagesRead: BigNumberish,
      kind: BigNumberish,
      l1BlockAndTime: [BigNumberish, BigNumberish],
      baseFeeL1: BigNumberish,
      sender: string,
      messageDataHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    getKeysetCreationBlock(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    inboxAccs(index: BigNumberish, overrides?: CallOverrides): Promise<string>;

    initialize(
      bridge_: string,
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    invalidateKeysetHash(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    isBatchPoster(arg0: string, overrides?: CallOverrides): Promise<boolean>;

    isValidKeysetHash(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<boolean>;

    maxTimeVariation(
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber, BigNumber, BigNumber] & {
        delayBlocks: BigNumber;
        futureBlocks: BigNumber;
        delaySeconds: BigNumber;
        futureSeconds: BigNumber;
      }
    >;

    removeDelayAfterFork(overrides?: CallOverrides): Promise<void>;

    rollup(overrides?: CallOverrides): Promise<string>;

    setIsBatchPoster(
      addr: string,
      isBatchPoster_: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    setMaxTimeVariation(
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    setValidKeyset(
      keysetBytes: BytesLike,
      overrides?: CallOverrides
    ): Promise<void>;

    totalDelayedMessagesRead(overrides?: CallOverrides): Promise<BigNumber>;
  };

  filters: {
    "InboxMessageDelivered(uint256,bytes)"(
      messageNum?: BigNumberish | null,
      data?: null
    ): InboxMessageDeliveredEventFilter;
    InboxMessageDelivered(
      messageNum?: BigNumberish | null,
      data?: null
    ): InboxMessageDeliveredEventFilter;

    "InboxMessageDeliveredFromOrigin(uint256)"(
      messageNum?: BigNumberish | null
    ): InboxMessageDeliveredFromOriginEventFilter;
    InboxMessageDeliveredFromOrigin(
      messageNum?: BigNumberish | null
    ): InboxMessageDeliveredFromOriginEventFilter;

    "InvalidateKeyset(bytes32)"(
      keysetHash?: BytesLike | null
    ): InvalidateKeysetEventFilter;
    InvalidateKeyset(
      keysetHash?: BytesLike | null
    ): InvalidateKeysetEventFilter;

    "OwnerFunctionCalled(uint256)"(
      id?: BigNumberish | null
    ): OwnerFunctionCalledEventFilter;
    OwnerFunctionCalled(
      id?: BigNumberish | null
    ): OwnerFunctionCalledEventFilter;

    "SequencerBatchData(uint256,bytes)"(
      batchSequenceNumber?: BigNumberish | null,
      data?: null
    ): SequencerBatchDataEventFilter;
    SequencerBatchData(
      batchSequenceNumber?: BigNumberish | null,
      data?: null
    ): SequencerBatchDataEventFilter;

    "SequencerBatchDelivered(uint256,bytes32,bytes32,bytes32,uint256,tuple,uint8)"(
      batchSequenceNumber?: BigNumberish | null,
      beforeAcc?: BytesLike | null,
      afterAcc?: BytesLike | null,
      delayedAcc?: null,
      afterDelayedMessagesRead?: null,
      timeBounds?: null,
      dataLocation?: null
    ): SequencerBatchDeliveredEventFilter;
    SequencerBatchDelivered(
      batchSequenceNumber?: BigNumberish | null,
      beforeAcc?: BytesLike | null,
      afterAcc?: BytesLike | null,
      delayedAcc?: null,
      afterDelayedMessagesRead?: null,
      timeBounds?: null,
      dataLocation?: null
    ): SequencerBatchDeliveredEventFilter;

    "SetValidKeyset(bytes32,bytes)"(
      keysetHash?: BytesLike | null,
      keysetBytes?: null
    ): SetValidKeysetEventFilter;
    SetValidKeyset(
      keysetHash?: BytesLike | null,
      keysetBytes?: null
    ): SetValidKeysetEventFilter;
  };

  estimateGas: {
    DATA_AUTHENTICATED_FLAG(overrides?: CallOverrides): Promise<BigNumber>;

    HEADER_LENGTH(overrides?: CallOverrides): Promise<BigNumber>;

    addSequencerL2Batch(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address,uint256,uint256)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    batchCount(overrides?: CallOverrides): Promise<BigNumber>;

    bridge(overrides?: CallOverrides): Promise<BigNumber>;

    dasKeySetInfo(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    forceInclusion(
      _totalDelayedMessagesRead: BigNumberish,
      kind: BigNumberish,
      l1BlockAndTime: [BigNumberish, BigNumberish],
      baseFeeL1: BigNumberish,
      sender: string,
      messageDataHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    getKeysetCreationBlock(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    inboxAccs(
      index: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    initialize(
      bridge_: string,
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    invalidateKeysetHash(
      ksHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    isBatchPoster(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    isValidKeysetHash(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    maxTimeVariation(overrides?: CallOverrides): Promise<BigNumber>;

    removeDelayAfterFork(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    rollup(overrides?: CallOverrides): Promise<BigNumber>;

    setIsBatchPoster(
      addr: string,
      isBatchPoster_: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setMaxTimeVariation(
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    setValidKeyset(
      keysetBytes: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    totalDelayedMessagesRead(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    DATA_AUTHENTICATED_FLAG(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    HEADER_LENGTH(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    addSequencerL2Batch(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    "addSequencerL2BatchFromOrigin(uint256,bytes,uint256,address,uint256,uint256)"(
      sequenceNumber: BigNumberish,
      data: BytesLike,
      afterDelayedMessagesRead: BigNumberish,
      gasRefunder: string,
      prevMessageCount: BigNumberish,
      newMessageCount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    batchCount(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    bridge(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    dasKeySetInfo(
      arg0: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    forceInclusion(
      _totalDelayedMessagesRead: BigNumberish,
      kind: BigNumberish,
      l1BlockAndTime: [BigNumberish, BigNumberish],
      baseFeeL1: BigNumberish,
      sender: string,
      messageDataHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    getKeysetCreationBlock(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    inboxAccs(
      index: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    initialize(
      bridge_: string,
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    invalidateKeysetHash(
      ksHash: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    isBatchPoster(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    isValidKeysetHash(
      ksHash: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    maxTimeVariation(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    removeDelayAfterFork(
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    rollup(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    setIsBatchPoster(
      addr: string,
      isBatchPoster_: boolean,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setMaxTimeVariation(
      maxTimeVariation_: ISequencerInbox.MaxTimeVariationStruct,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    setValidKeyset(
      keysetBytes: BytesLike,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    totalDelayedMessagesRead(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
