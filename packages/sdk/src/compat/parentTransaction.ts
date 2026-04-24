/**
 * ParentTransaction compat layer.
 *
 * Provides the old SDK's ParentTransactionReceipt, ParentEthDepositTransactionReceipt,
 * ParentContractCallTransactionReceipt classes with the monkey-patch pattern.
 *
 * Internally delegates to @arbitrum/core for event parsing and message creation.
 */
import { BigNumber } from 'ethers'
import type { TransactionReceipt, Log } from '@ethersproject/providers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { ContractTransaction } from '@ethersproject/contracts'
import type { ParsedEventLog } from '@arbitrum/core'
import {
  getMessageDeliveredEvents as coreGetMessageDeliveredEvents,
  getInboxMessageDeliveredEvents as coreGetInboxMessageDeliveredEvents,
  getTokenDepositEvents as coreGetTokenDepositEvents,
  getMessageEvents as coreGetMessageEvents,
  InboxMessageKind,
  getArbitrumNetwork as _coreGetArbitrumNetwork,
  SubmitRetryableMessageDataParser,
  ArbSdkError,
  ARB1_NITRO_GENESIS_L1_BLOCK,
} from '@arbitrum/core'
import { wrapProvider, fromEthersReceipt } from '@arbitrum/ethers5'
import type { Ethers5Provider, Ethers5Receipt } from '@arbitrum/ethers5'
import { getArbitrumNetwork as getArbitrumNetworkOld } from '../lib/dataEntities/networks'
import { toCoreReceipt, toCoreLog, toBigNumber } from './convert'
import { SignerProviderUtils, ParentToChildMessageStatus } from './types'
import type {
  SignerOrProvider,
  RetryableMessageParams,
  ParentToChildMessageWaitForStatusResult,
  EthDepositMessageWaitForStatusResult,
} from './types'
import {
  ParentToChildMessage,
  ParentToChildMessageReader,
  ParentToChildMessageWriter,
  EthDepositMessage,
} from './parentToChildMessage'
import type { ParentToChildMessageReaderOrWriter } from './parentToChildMessage'

// ---------------------------------------------------------------------------
// Transaction type aliases (matching old SDK)
// ---------------------------------------------------------------------------

export interface ParentContractTransaction<
  TReceipt extends ParentTransactionReceipt = ParentTransactionReceipt
> extends ContractTransaction {
  wait(confirmations?: number): Promise<TReceipt>
}

export type ParentEthDepositTransaction =
  ParentContractTransaction<ParentEthDepositTransactionReceipt>

export type ParentContractCallTransaction =
  ParentContractTransaction<ParentContractCallTransactionReceipt>

// ---------------------------------------------------------------------------
// ParentTransactionReceipt
// ---------------------------------------------------------------------------

export class ParentTransactionReceipt implements TransactionReceipt {
  public readonly to: string
  public readonly from: string
  public readonly contractAddress: string
  public readonly transactionIndex: number
  public readonly root?: string
  public readonly gasUsed: BigNumber
  public readonly logsBloom: string
  public readonly blockHash: string
  public readonly transactionHash: string
  public readonly logs: Array<Log>
  public readonly blockNumber: number
  public readonly confirmations: number
  public readonly cumulativeGasUsed: BigNumber
  public readonly effectiveGasPrice: BigNumber
  public readonly byzantium: boolean
  public readonly type: number
  public readonly status?: number

  constructor(tx: TransactionReceipt) {
    this.to = tx.to
    this.from = tx.from
    this.contractAddress = tx.contractAddress
    this.transactionIndex = tx.transactionIndex
    this.root = tx.root
    this.gasUsed = tx.gasUsed
    this.logsBloom = tx.logsBloom
    this.blockHash = tx.blockHash
    this.transactionHash = tx.transactionHash
    this.logs = tx.logs
    this.blockNumber = tx.blockNumber
    this.confirmations = tx.confirmations
    this.cumulativeGasUsed = tx.cumulativeGasUsed
    this.effectiveGasPrice = tx.effectiveGasPrice
    this.byzantium = tx.byzantium
    this.type = tx.type
    this.status = tx.status
  }

  /**
   * Check if is a classic transaction (pre-Nitro on Arbitrum One).
   */
  public async isClassic<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<boolean> {
    const provider = SignerProviderUtils.getProviderOrThrow(
      childSignerOrProvider
    )
    const wrappedProvider = wrapProvider(provider as unknown as Ethers5Provider)
    const network = await getArbitrumNetworkOld(
      await wrappedProvider.getChainId()
    )

    // All networks except Arbitrum One started off with Nitro
    if (network.chainId === 42161) {
      return this.blockNumber < ARB1_NITRO_GENESIS_L1_BLOCK
    }

    return false
  }

  /**
   * Get any MessageDelivered events that were emitted during this transaction.
   * Uses core event parsing on the receipt logs.
   */
  public getMessageDeliveredEvents(): Record<string, unknown>[] {
    const coreLogs = this.logs.map(toCoreLog)
    const events = coreGetMessageDeliveredEvents(coreLogs)
    return events.map(e => ({ ...e, ...(e.args as Record<string, unknown>) }))
  }

  /**
   * Get any InboxMessageDelivered events that were emitted during this transaction.
   */
  public getInboxMessageDeliveredEvents(): Record<string, unknown>[] {
    const coreLogs = this.logs.map(toCoreLog)
    const events = coreGetInboxMessageDeliveredEvents(coreLogs)
    return events.map(e => ({ ...e, ...(e.args as Record<string, unknown>) }))
  }

  /**
   * Get combined data for any InboxMessageDelivered and MessageDelivered events.
   */
  public getMessageEvents(): {
    inboxMessageEvent: ParsedEventLog
    bridgeMessageEvent: ParsedEventLog
  }[] {
    const coreReceipt = toCoreReceipt({
      to: this.to,
      from: this.from,
      contractAddress: this.contractAddress,
      transactionIndex: this.transactionIndex,
      gasUsed: this.gasUsed,
      logsBloom: this.logsBloom,
      blockHash: this.blockHash,
      transactionHash: this.transactionHash,
      logs: this.logs,
      blockNumber: this.blockNumber,
      confirmations: this.confirmations,
      cumulativeGasUsed: this.cumulativeGasUsed,
      effectiveGasPrice: this.effectiveGasPrice,
      byzantium: this.byzantium,
      type: this.type,
      status: this.status,
    })
    return coreGetMessageEvents(coreReceipt)
  }

  /**
   * Get any eth deposit messages created by this transaction.
   */
  public async getEthDeposits(
    childProvider: Provider
  ): Promise<EthDepositMessage[]> {
    const wrappedProvider = wrapProvider(
      childProvider as unknown as Ethers5Provider
    )
    const chainId = await wrappedProvider.getChainId()

    return this.getMessageEvents()
      .filter(
        e =>
          Number(e.bridgeMessageEvent.args.kind) ===
          InboxMessageKind.L1MessageType_ethDeposit
      )
      .map(m =>
        EthDepositMessage.fromEventComponents(
          childProvider,
          chainId,
          BigNumber.from(m.inboxMessageEvent.args.messageNum as bigint),
          m.bridgeMessageEvent.args.sender as string,
          m.inboxMessageEvent.args.data as string
        )
      )
  }

  /**
   * Get any parent-to-child messages created by this transaction.
   */
  public async getParentToChildMessages<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<ParentToChildMessageReaderOrWriter<T>[]>
  public async getParentToChildMessages<T extends SignerOrProvider>(
    childSignerOrProvider: T
  ): Promise<ParentToChildMessageReader[] | ParentToChildMessageWriter[]> {
    const provider = SignerProviderUtils.getProviderOrThrow(
      childSignerOrProvider
    )
    const wrappedProvider = wrapProvider(provider as unknown as Ethers5Provider)
    const network = await getArbitrumNetworkOld(
      await wrappedProvider.getChainId()
    )
    const chainId = network.chainId

    const isClassic = await this.isClassic(provider)
    if (isClassic) {
      throw new Error(
        "This method is only for nitro transactions. Use 'getParentToChildMessagesClassic' for classic transactions."
      )
    }

    const events = this.getMessageEvents()
    const parser = new SubmitRetryableMessageDataParser()

    return events
      .filter(
        e =>
          Number(e.bridgeMessageEvent.args.kind) ===
            InboxMessageKind.L1MessageType_submitRetryableTx &&
          (e.bridgeMessageEvent.args.inbox as string).toLowerCase() ===
            network.ethBridge.inbox.toLowerCase()
      )
      .map(mn => {
        const inboxMessageData = parser.parse(
          mn.inboxMessageEvent.args.data as string
        )

        // Convert core RetryableMessageParams (bigint) to compat (BigNumber)
        const compatMessageData: RetryableMessageParams = {
          destAddress: inboxMessageData.destAddress,
          l2CallValue: BigNumber.from(inboxMessageData.l2CallValue),
          l1Value: BigNumber.from(inboxMessageData.l1Value),
          maxSubmissionFee: BigNumber.from(inboxMessageData.maxSubmissionFee),
          excessFeeRefundAddress: inboxMessageData.excessFeeRefundAddress,
          callValueRefundAddress: inboxMessageData.callValueRefundAddress,
          gasLimit: BigNumber.from(inboxMessageData.gasLimit),
          maxFeePerGas: BigNumber.from(inboxMessageData.maxFeePerGas),
          data: inboxMessageData.data,
        }

        return ParentToChildMessage.fromEventComponents(
          childSignerOrProvider,
          chainId,
          mn.bridgeMessageEvent.args.sender as string,
          BigNumber.from(mn.inboxMessageEvent.args.messageNum as bigint),
          BigNumber.from(mn.bridgeMessageEvent.args.baseFeeL1 as bigint),
          compatMessageData
        )
      })
  }

  /**
   * Get any token deposit events created by this transaction.
   */
  public getTokenDepositEvents(): ParsedEventLog[] {
    const coreLogs = this.logs.map(toCoreLog)
    return coreGetTokenDepositEvents(coreLogs)
  }

  /**
   * Replaces the wait function with one that returns a ParentTransactionReceipt.
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): ParentContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentTransactionReceipt(result)
    }
    return contractTransaction as ParentContractTransaction
  }

  /**
   * Replaces the wait function with one that returns a ParentEthDepositTransactionReceipt.
   */
  public static monkeyPatchEthDepositWait = (
    contractTransaction: ContractTransaction
  ): ParentEthDepositTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentEthDepositTransactionReceipt(result)
    }
    return contractTransaction as ParentEthDepositTransaction
  }

  /**
   * Replaces the wait function with one that returns a ParentContractCallTransactionReceipt.
   */
  public static monkeyPatchContractCallWait = (
    contractTransaction: ContractTransaction
  ): ParentContractCallTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (confirmations?: number) => {
      const result = await wait(confirmations)
      return new ParentContractCallTransactionReceipt(result)
    }
    return contractTransaction as ParentContractCallTransaction
  }
}

// ---------------------------------------------------------------------------
// ParentEthDepositTransactionReceipt
// ---------------------------------------------------------------------------

export class ParentEthDepositTransactionReceipt extends ParentTransactionReceipt {
  /**
   * Wait for the funds to arrive on the child chain.
   */
  public async waitForChildTransactionReceipt(
    childProvider: Provider,
    confirmations?: number,
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: EthDepositMessage
    } & EthDepositMessageWaitForStatusResult
  > {
    const message = (await this.getEthDeposits(childProvider))[0]
    if (!message) {
      throw new ArbSdkError('Unexpected missing Eth Deposit message.')
    }
    const res = await message.wait(confirmations, timeout)

    return {
      complete: res !== null,
      childTxReceipt: res,
      message,
    }
  }
}

// ---------------------------------------------------------------------------
// ParentContractCallTransactionReceipt
// ---------------------------------------------------------------------------

export class ParentContractCallTransactionReceipt extends ParentTransactionReceipt {
  /**
   * Wait for the transaction to arrive and be executed on the child chain.
   */
  public async waitForChildTransactionReceipt<T extends SignerOrProvider>(
    childSignerOrProvider: T,
    confirmations?: number,
    timeout?: number
  ): Promise<
    {
      complete: boolean
      message: ParentToChildMessageReaderOrWriter<T>
    } & ParentToChildMessageWaitForStatusResult
  > {
    const message = (
      await this.getParentToChildMessages(childSignerOrProvider)
    )[0]
    if (!message) {
      throw new ArbSdkError('Unexpected missing Parent-to-child message.')
    }
    const res = await message.waitForStatus(confirmations, timeout)

    return {
      complete: res.status === ParentToChildMessageStatus.REDEEMED,
      ...res,
      message,
    }
  }
}
