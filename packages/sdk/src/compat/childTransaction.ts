/**
 * ChildTransaction compat layer.
 *
 * Provides the old SDK's ChildTransactionReceipt class with
 * the monkey-patch pattern.
 *
 * Internally delegates to @arbitrum/core for event parsing.
 */
import { BigNumber } from 'ethers'
import type { TransactionReceipt, Log } from '@ethersproject/providers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { ContractTransaction } from '@ethersproject/contracts'
import type { ParsedEventLog } from '@arbitrum/core'
import {
  getChildToParentEvents as coreGetChildToParentEvents,
  getRedeemScheduledEvents as coreGetRedeemScheduledEvents,
  ArbSdkError,
} from '@arbitrum/core'
import { toCoreLog } from './convert'
import { SignerProviderUtils } from './types'
import type { SignerOrProvider } from './types'
import {
  ChildToParentMessage,
  ChildToParentMessageReader,
  ChildToParentMessageWriter,
} from './childToParentMessage'
import type {
  ChildToParentTransactionEvent,
  ChildToParentMessageReaderOrWriter,
} from './childToParentMessage'

// ---------------------------------------------------------------------------
// Transaction type aliases (matching old SDK)
// ---------------------------------------------------------------------------

export interface ChildContractTransaction extends ContractTransaction {
  wait(confirmations?: number): Promise<ChildTransactionReceipt>
}

export interface RedeemTransaction extends ChildContractTransaction {
  waitForRedeem: () => Promise<TransactionReceipt>
}

// ---------------------------------------------------------------------------
// ChildTransactionReceipt
// ---------------------------------------------------------------------------

export class ChildTransactionReceipt implements TransactionReceipt {
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
   * Get L2ToL1Tx / L2ToL1Transaction events created by this transaction.
   * Returns BigNumber-based event args to match the old SDK.
   */
  public getChildToParentEvents(): ChildToParentTransactionEvent[] {
    const coreLogs = this.logs.map(toCoreLog)
    const coreEvents = coreGetChildToParentEvents(coreLogs)

    return coreEvents.map(e => ({
      caller: e.args.caller as string,
      destination: e.args.destination as string,
      hash: BigNumber.from(e.args.hash as bigint),
      position: BigNumber.from(e.args.position as bigint),
      arbBlockNum: BigNumber.from(e.args.arbBlockNum as bigint),
      ethBlockNum: BigNumber.from(e.args.ethBlockNum as bigint),
      timestamp: BigNumber.from(e.args.timestamp as bigint),
      callvalue: BigNumber.from(e.args.callvalue as bigint),
      data: e.args.data as string,
    }))
  }

  /**
   * Get event data for any redeems that were scheduled in this transaction.
   */
  public getRedeemScheduledEvents(): ParsedEventLog[] {
    const coreLogs = this.logs.map(toCoreLog)
    return coreGetRedeemScheduledEvents(coreLogs)
  }

  /**
   * Get any child-to-parent-messages created by this transaction.
   */
  public async getChildToParentMessages<T extends SignerOrProvider>(
    parentSignerOrProvider: T
  ): Promise<ChildToParentMessageReaderOrWriter<T>[]>
  public async getChildToParentMessages<T extends SignerOrProvider>(
    parentSignerOrProvider: T
  ): Promise<ChildToParentMessageReader[] | ChildToParentMessageWriter[]> {
    const provider = SignerProviderUtils.getProvider(parentSignerOrProvider)
    if (!provider) throw new ArbSdkError('Signer not connected to provider.')

    return this.getChildToParentEvents().map(log =>
      ChildToParentMessage.fromEvent(parentSignerOrProvider, log)
    )
  }

  /**
   * Replaces the wait function with one that returns a ChildTransactionReceipt.
   */
  public static monkeyPatchWait = (
    contractTransaction: ContractTransaction
  ): ChildContractTransaction => {
    const wait = contractTransaction.wait
    contractTransaction.wait = async (_confirmations?: number) => {
      const result = await wait()
      return new ChildTransactionReceipt(result)
    }
    return contractTransaction as ChildContractTransaction
  }

  /**
   * Adds a waitForRedeem function to a redeem transaction.
   */
  public static toRedeemTransaction(
    redeemTx: ChildContractTransaction,
    childProvider: Provider
  ): RedeemTransaction {
    const returnRec = redeemTx as RedeemTransaction
    returnRec.waitForRedeem = async () => {
      const rec = await redeemTx.wait()

      const redeemScheduledEvents = rec.getRedeemScheduledEvents()

      if (redeemScheduledEvents.length !== 1) {
        throw new ArbSdkError(
          `Transaction is not a redeem transaction: ${rec.transactionHash}`
        )
      }

      return (await childProvider.getTransactionReceipt(
        redeemScheduledEvents[0].args.retryTxHash as string
      ))!
    }
    return returnRec
  }
}
