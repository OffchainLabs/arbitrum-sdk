/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { Signer } from '@ethersproject/abstract-signer'
import { Block, Provider } from '@ethersproject/abstract-provider'
import { BigNumber, ContractTransaction, ethers, Overrides } from 'ethers'
import { TransactionRequest, JsonRpcProvider } from '@ethersproject/providers'

import { Bridge } from '../abi/Bridge'
import { Bridge__factory } from '../abi/factories/Bridge__factory'
import { SequencerInbox } from '../abi/SequencerInbox'
import { SequencerInbox__factory } from '../abi/factories/SequencerInbox__factory'
import { IInbox__factory } from '../abi/factories/IInbox__factory'
import { RequiredPick } from '../utils/types'
import { MessageDeliveredEvent } from '../abi/Bridge'
import { ArbitrumNetwork } from '../dataEntities/networks'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { FetchedEvent, EventFetcher } from '../utils/eventFetcher'
import { MultiCaller, CallInput } from '../utils/multicall'
import { ArbSdkError } from '../dataEntities/errors'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { InboxMessageKind } from '../dataEntities/message'
import {
  getBlockRangesForL1Block,
  isArbitrumChain,
  isDefined,
} from '../utils/lib'
import { ArbitrumProvider } from '../utils/arbProvider'

type ForceInclusionParams = FetchedEvent<MessageDeliveredEvent> & {
  delayedAcc: string
}

type GasComponentsWithChildPart = {
  gasEstimate: BigNumber
  gasEstimateForL1: BigNumber
  baseFee: BigNumber
  l1BaseFeeEstimate: BigNumber
  gasEstimateForChild: BigNumber
}
type RequiredTransactionRequestType = RequiredPick<
  TransactionRequest,
  'data' | 'value'
>
/**
 * Tools for interacting with the inbox and bridge contracts
 */
export class InboxTools {
  /**
   * Parent chain provider
   */
  private readonly parentProvider: Provider

  constructor(
    private readonly parentSigner: Signer,
    private readonly childChain: ArbitrumNetwork
  ) {
    this.parentProvider = SignerProviderUtils.getProviderOrThrow(
      this.parentSigner
    )
  }

  /**
   * Find the first (or close to first) block whose number
   * is below the provided number, and whose timestamp is below
   * the provided timestamp
   * @param blockNumber
   * @param blockTimestamp
   * @returns
   */
  private async findFirstBlockBelow(
    blockNumber: number,
    blockTimestamp: number
  ): Promise<Block> {
    const isParentChainArbitrum = await isArbitrumChain(this.parentProvider)

    if (isParentChainArbitrum) {
      const nodeInterface = NodeInterface__factory.connect(
        NODE_INTERFACE_ADDRESS,
        this.parentProvider
      )

      try {
        blockNumber = (
          await nodeInterface.l2BlockRangeForL1(blockNumber - 1)
        ).firstBlock.toNumber()
      } catch (e) {
        // l2BlockRangeForL1 reverts if no L2 block exist with the given L1 block number,
        // since l1 block is updated in batch sometimes block can be skipped even when there are activities
        // alternatively we use binary search to get the nearest block
        const _blockNum = (
          await getBlockRangesForL1Block({
            arbitrumProvider: this.parentProvider as JsonRpcProvider,
            forL1Block: blockNumber - 1,
            allowGreater: true,
          })
        )[0]

        if (!_blockNum) {
          throw e
        }

        blockNumber = _blockNum
      }
    }

    const block = await this.parentProvider.getBlock(blockNumber)
    const diff = block.timestamp - blockTimestamp
    if (diff < 0) return block

    // we take a long average block time of 12s
    // and always move at least 10 blocks
    const diffBlocks = Math.max(Math.ceil(diff / 12), 10)

    return await this.findFirstBlockBelow(
      blockNumber - diffBlocks,
      blockTimestamp
    )
  }

  // Check if this request is contract creation or not.
  private isContractCreation(
    childTransactionRequest: TransactionRequest
  ): boolean {
    if (
      childTransactionRequest.to === '0x' ||
      !isDefined(childTransactionRequest.to) ||
      childTransactionRequest.to === ethers.constants.AddressZero
    ) {
      return true
    }
    return false
  }

  /**
   * We should use nodeInterface to get the gas estimate is because we
   * are making a delayed inbox message which doesn't need parent calldata
   * gas fee part.
   */
  private async estimateArbitrumGas(
    childTransactionRequest: RequiredTransactionRequestType,
    childProvider: Provider
  ): Promise<GasComponentsWithChildPart> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      childProvider
    )

    const contractCreation = this.isContractCreation(childTransactionRequest)
    const gasComponents = await nodeInterface.callStatic.gasEstimateComponents(
      childTransactionRequest.to || ethers.constants.AddressZero,
      contractCreation,
      childTransactionRequest.data,
      {
        from: childTransactionRequest.from,
        value: childTransactionRequest.value,
      }
    )
    const gasEstimateForChild: BigNumber = gasComponents.gasEstimate.sub(
      gasComponents.gasEstimateForL1
    )
    return { ...gasComponents, gasEstimateForChild }
  }

  /**
   * Get a range of blocks within messages eligible for force inclusion emitted events
   * @param blockNumberRangeSize
   * @returns
   */
  private async getForceIncludableBlockRange(blockNumberRangeSize: number) {
    let currentL1BlockNumber: number | undefined

    const sequencerInbox = SequencerInbox__factory.connect(
      this.childChain.ethBridge.sequencerInbox,
      this.parentProvider
    )

    const isParentChainArbitrum = await isArbitrumChain(this.parentProvider)

    if (isParentChainArbitrum) {
      const arbProvider = new ArbitrumProvider(
        this.parentProvider as JsonRpcProvider
      )
      const currentArbBlock = await arbProvider.getBlock('latest')
      currentL1BlockNumber = currentArbBlock.l1BlockNumber
    }

    const multicall = await MultiCaller.fromProvider(this.parentProvider)
    const multicallInput: [
      CallInput<Awaited<ReturnType<SequencerInbox['maxTimeVariation']>>>,
      ReturnType<MultiCaller['getBlockNumberInput']>,
      ReturnType<MultiCaller['getCurrentBlockTimestampInput']>
    ] = [
      {
        targetAddr: sequencerInbox.address,
        encoder: () =>
          sequencerInbox.interface.encodeFunctionData('maxTimeVariation'),
        decoder: (returnData: string) =>
          sequencerInbox.interface.decodeFunctionResult(
            'maxTimeVariation',
            returnData
          )[0],
      },
      multicall.getBlockNumberInput(),
      multicall.getCurrentBlockTimestampInput(),
    ]

    const [maxTimeVariation, currentBlockNumber, currentBlockTimestamp] =
      await multicall.multiCall(multicallInput, true)

    const blockNumber = isParentChainArbitrum
      ? currentL1BlockNumber!
      : currentBlockNumber.toNumber()

    const firstEligibleBlockNumber =
      blockNumber - maxTimeVariation.delayBlocks.toNumber()
    const firstEligibleTimestamp =
      currentBlockTimestamp.toNumber() -
      maxTimeVariation.delaySeconds.toNumber()

    const firstEligibleBlock = await this.findFirstBlockBelow(
      firstEligibleBlockNumber,
      firstEligibleTimestamp
    )

    return {
      endBlock: firstEligibleBlock.number,
      startBlock: firstEligibleBlock.number - blockNumberRangeSize,
    }
  }

  /**
   * Look for force includable events in the search range blocks, if no events are found the search range is
   * increased incrementally up to the max search range blocks.
   * @param bridge
   * @param searchRangeBlocks
   * @param maxSearchRangeBlocks
   * @returns
   */
  private async getEventsAndIncreaseRange(
    bridge: Bridge,
    searchRangeBlocks: number,
    maxSearchRangeBlocks: number,
    rangeMultiplier: number
  ): Promise<FetchedEvent<MessageDeliveredEvent>[]> {
    const eFetcher = new EventFetcher(this.parentProvider)

    // events don't become eligible until they pass a delay
    // find a block range which will emit eligible events
    const cappedSearchRangeBlocks = Math.min(
      searchRangeBlocks,
      maxSearchRangeBlocks
    )
    const blockRange = await this.getForceIncludableBlockRange(
      cappedSearchRangeBlocks
    )

    // get all the events in this range
    const events = await eFetcher.getEvents(
      Bridge__factory,
      b => b.filters.MessageDelivered(),
      {
        fromBlock: blockRange.startBlock,
        toBlock: blockRange.endBlock,
        address: bridge.address,
      }
    )

    if (events.length !== 0) return events
    else if (cappedSearchRangeBlocks === maxSearchRangeBlocks) return []
    else {
      return await this.getEventsAndIncreaseRange(
        bridge,
        searchRangeBlocks * rangeMultiplier,
        maxSearchRangeBlocks,
        rangeMultiplier
      )
    }
  }

  /**
   * Find the event of the latest message that can be force include
   * @param maxSearchRangeBlocks The max range of blocks to search in.
   * Defaults to 3 * 6545 ( = ~3 days) prior to the first eligible block
   * @param startSearchRangeBlocks The start range of block to search in.
   * Moves incrementally up to the maxSearchRangeBlocks. Defaults to 100;
   * @param rangeMultiplier The multiplier to use when increasing the block range
   * Defaults to 2.
   * @returns Null if non can be found.
   */
  public async getForceIncludableEvent(
    maxSearchRangeBlocks: number = 3 * 6545,
    startSearchRangeBlocks = 100,
    rangeMultiplier = 2
  ): Promise<ForceInclusionParams | null> {
    const bridge = Bridge__factory.connect(
      this.childChain.ethBridge.bridge,
      this.parentProvider
    )

    // events dont become eligible until they pass a delay
    // find a block range which will emit eligible events
    const events = await this.getEventsAndIncreaseRange(
      bridge,
      startSearchRangeBlocks,
      maxSearchRangeBlocks,
      rangeMultiplier
    )

    // no events appeared within that time period
    if (events.length === 0) return null

    // take the last event - as including this one will include all previous events
    const eventInfo = events[events.length - 1]
    const sequencerInbox = SequencerInbox__factory.connect(
      this.childChain.ethBridge.sequencerInbox,
      this.parentProvider
    )
    // has the sequencer inbox already read this latest message
    const totalDelayedRead = await sequencerInbox.totalDelayedMessagesRead()
    if (totalDelayedRead.gt(eventInfo.event.messageIndex)) {
      // nothing to read - more delayed messages have been read than this current index
      return null
    }

    const delayedAcc = await bridge.delayedInboxAccs(
      eventInfo.event.messageIndex
    )

    return { ...eventInfo, delayedAcc: delayedAcc }
  }

  /**
   * Force includes all eligible messages in the delayed inbox.
   * The inbox contract doesn't allow a message to be force-included
   * until after a delay period has been completed.
   * @param messageDeliveredEvent Provide this to include all messages up to this one. Responsibility is on the caller to check the eligibility of this event.
   * @returns The force include transaction, or null if no eligible message were found for inclusion
   */
  public async forceInclude<T extends ForceInclusionParams | undefined>(
    messageDeliveredEvent?: T,
    overrides?: Overrides
  ): Promise<
    // if a message delivered event was supplied then we'll definitely return
    // a contract transaction or throw an error. If one isnt supplied then we may
    // find no eligible events, and so return null
    T extends ForceInclusionParams
      ? ContractTransaction
      : ContractTransaction | null
  >
  public async forceInclude<T extends ForceInclusionParams | undefined>(
    messageDeliveredEvent?: T,
    overrides?: Overrides
  ): Promise<ContractTransaction | null> {
    const sequencerInbox = SequencerInbox__factory.connect(
      this.childChain.ethBridge.sequencerInbox,
      this.parentSigner
    )
    const eventInfo =
      messageDeliveredEvent || (await this.getForceIncludableEvent())

    if (!eventInfo) return null
    const block = await this.parentProvider.getBlock(eventInfo.blockHash)

    return await sequencerInbox.functions.forceInclusion(
      eventInfo.event.messageIndex.add(1),
      eventInfo.event.kind,
      [eventInfo.blockNumber, block.timestamp],
      eventInfo.event.baseFeeL1,
      eventInfo.event.sender,
      eventInfo.event.messageDataHash,
      // we need to pass in {} because if overrides is undefined it thinks we've provided too many params
      overrides || {}
    )
  }

  /**
   * Send Child Chain signed tx using delayed inbox, which won't alias the sender's address
   * It will be automatically included by the sequencer on Chain, if it isn't included
   * within 24 hours, you can force include it
   * @param signedTx A signed transaction which can be sent directly to chain,
   * you can call inboxTools.signChainMessage to get.
   * @returns The parent delayed inbox's transaction itself.
   */
  public async sendChildSignedTx(
    signedTx: string
  ): Promise<ContractTransaction | null> {
    const delayedInbox = IInbox__factory.connect(
      this.childChain.ethBridge.inbox,
      this.parentSigner
    )

    const sendData = ethers.utils.solidityPack(
      ['uint8', 'bytes'],
      [ethers.utils.hexlify(InboxMessageKind.L2MessageType_signedTx), signedTx]
    )

    return await delayedInbox.functions.sendL2Message(sendData)
  }

  /**
   * Assemble a transaction with msg.to, msg.value and msg.data.
   * This is used right below to provide a transaction to signChildTx and sendChildTx.
   * @param txRequest A signed transaction which can be sent directly to chain,
   * tx.to, tx.data, tx.value must be provided when not contract creation, if
   * contractCreation is true, no need provide tx.to. tx.gasPrice and tx.nonce
   * can be overrided. (You can also send contract creation transaction by set tx.to
   * to zero address or null)
   * @param childSigner ethers Signer type, used to sign Chain transaction
   * @returns The parent delayed inbox's transaction signed data.
   */
  public async assembleChildTx(
    txRequest: RequiredTransactionRequestType,
    childSigner: Signer
  ): Promise<RequiredTransactionRequestType> {
    const tx: RequiredTransactionRequestType = { ...txRequest }
    const contractCreation = this.isContractCreation(tx)

    if (!isDefined(tx.nonce)) {
      tx.nonce = await childSigner.getTransactionCount()
    }

    //check transaction type (if no transaction type or gasPrice provided, use eip1559 type)
    if (tx.type === 1 || tx.gasPrice) {
      if (tx.gasPrice) {
        tx.gasPrice = await childSigner.getGasPrice()
      }
    } else {
      if (!isDefined(tx.maxFeePerGas)) {
        const feeData = await childSigner.getFeeData()
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas!
        tx.maxFeePerGas = feeData.maxFeePerGas!
      }
      tx.type = 2
    }

    tx.from = await childSigner.getAddress()
    tx.chainId = await childSigner.getChainId()

    // if this is contract creation, user might not input the to address,
    // however, it is needed when we call to estimateArbitrumGas, so
    // we add a zero address here.
    if (!isDefined(tx.to)) {
      tx.to = ethers.constants.AddressZero
    }

    //estimate gas on child chain
    try {
      tx.gasLimit = (
        await this.estimateArbitrumGas(tx, childSigner.provider!)
      ).gasEstimateForChild
    } catch (error) {
      throw new ArbSdkError('execution failed (estimate gas failed)')
    }
    if (contractCreation) {
      delete tx.to
    }
    return tx
  }

  /**
   * Sign a transaction with msg.to, msg.value and msg.data.
   * You can use this as a helper to call inboxTools.sendChainSignedMessage
   * above.
   * @param txRequest A signed transaction which can be sent directly to chain,
   * tx.to, tx.data, tx.value must be provided when not contract creation, if
   * contractCreation is true, no need provide tx.to. tx.gasPrice and tx.nonce
   * can be overrided. (You can also send contract creation transaction by set tx.to
   * to zero address or null)
   * @param childSigner ethers Signer type, used to sign Chain transaction
   * @returns The parent delayed inbox's transaction signed data.
   */
  public async signChildTx(
    txRequest: RequiredTransactionRequestType,
    childSigner: Signer
  ): Promise<string> {
    const tx: RequiredTransactionRequestType = await this.assembleChildTx(
      txRequest,
      childSigner
    )
    return await childSigner.signTransaction(tx)
  }

  /**
   * Sign a transaction with msg.to, msg.value and msg.data.
   * A copy of `signChildTx` above but that instead of just signing also sends the transaction.
   * This is a workaround wallets in browsers not supporting signing only.
   * @param txRequest A signed transaction which can be sent directly to chain,
   * tx.to, tx.data, tx.value must be provided when not contract creation, if
   * contractCreation is true, no need provide tx.to. tx.gasPrice and tx.nonce
   * can be overrided. (You can also send contract creation transaction by set tx.to
   * to zero address or null)
   * @param childSigner ethers Signer type, used to sign and send Chain transaction
   * @returns The parent delayed inbox's transaction signed data.
   */
  public async sendChildTx(
    txRequest: RequiredTransactionRequestType,
    childSigner: Signer
  ): Promise<string> {
    const tx: RequiredTransactionRequestType = await this.assembleChildTx(
      txRequest,
      childSigner
    )
    return (await childSigner.sendTransaction(tx)).hash
  }
}
