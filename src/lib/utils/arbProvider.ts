import { JsonRpcProvider, Formatter } from '@ethersproject/providers'
import {
  ArbBatchConfirmations,
  ArbBatchNumber,
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
  BatchInfo,
} from '../dataEntities/rpc'
import { BigNumber, Contract } from 'ethers'
import { Formats, FormatFuncs } from '@ethersproject/providers/lib/formatter'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { Interface } from 'ethers/lib/utils'

type ArbFormats = Formats & {
  batchInfo: FormatFuncs
}

class ArbFormatter extends Formatter {
  readonly formats!: ArbFormats

  public getDefaultFormats(): ArbFormats {
    // formats was already initialised in super, so we can just access here
    const superFormats = super.getDefaultFormats()

    const address = this.address.bind(this)
    const bigNumber = this.bigNumber.bind(this)
    const data = this.data.bind(this)
    const hash = this.hash.bind(this)
    const number = this.number.bind(this)
    const batchInfo = this.batchInfo.bind(this)

    const arbBlockProps = {
      sendRoot: hash,
      sendCount: bigNumber,
      l1BlockNumber: number,
    }

    const arbReceiptFormat = {
      ...superFormats.receipt,
      batchInfo: Formatter.allowNull(batchInfo, null),
      l1BlockNumber: number,
      gasUsedForL1: bigNumber,
    }

    const batchInfoFormat = {
      confirmations: number,
      blockNumber: number,
      logAddress: address,
      logTopics: Formatter.arrayOf(hash),
      logData: data,
    }

    return {
      ...superFormats,
      receipt: arbReceiptFormat,
      batchInfo: batchInfoFormat,
      block: { ...superFormats.block, ...arbBlockProps },
      blockWithTransactions: {
        ...superFormats.blockWithTransactions,
        ...arbBlockProps,
      },
    }
  }

  public batchInfo(batchInfo: any): BatchInfo {
    return Formatter.check(this.formats.batchInfo, batchInfo)
  }

  public receipt(value: any): ArbTransactionReceipt {
    return super.receipt(value) as ArbTransactionReceipt
  }

  public block(block: any): ArbBlock {
    return super.block(block) as ArbBlock
  }

  public blockWithTransactions(block: any): ArbBlock {
    return super.blockWithTransactions(block) as ArbBlock
  }
}

/**
 * Fetch a transaction receipt from an l2Provider
 * Additional batch info is also returned if requested
 * @param l2Provider
 * @param txHash
 * @returns
 */
export async function getArbTransactionReceipt<
  TBatch extends boolean = false,
  TConfirmations extends boolean = false
>(
  l2Provider: JsonRpcProvider,
  txHash: string,
  fetchBatchNumber?: TBatch,
  fetchBatchConfirmations?: TConfirmations
): Promise<
  | (ArbTransactionReceipt &
      (TBatch extends true ? ArbBatchNumber : {}) &
      (TConfirmations extends true ? ArbBatchConfirmations : {}))
  | null
>
export async function getArbTransactionReceipt<
  TBatch extends boolean = false,
  TConfirmations extends boolean = false
>(
  l2Provider: JsonRpcProvider,
  txHash: string,
  fetchBatchNumber?: TBatch,
  fetchBatchConfirmations?: TConfirmations
): Promise<
  | (ArbTransactionReceipt & Partial<ArbBatchConfirmations & ArbBatchNumber>)
  | null
> {
  const rec = await l2Provider.send('eth_getTransactionReceipt', [txHash])
  if (rec == null) return null
  const arbFormatter = new ArbFormatter()
  const arbTxReceipt: ArbTransactionReceipt &
    Partial<ArbBatchConfirmations & ArbBatchNumber> = arbFormatter.receipt(rec)

  // CHRIS: TODO: update interface from nitro
  const iface = new Interface([
    'function findBatchContainingBlock(uint64 block) external view returns (uint64 batch)',
    'function getL1Confirmations(bytes32 blockHash) external view returns (uint64 confirmations)',
  ])
  const nodeInterface = new Contract(NODE_INTERFACE_ADDRESS, iface, l2Provider)
  if (fetchBatchNumber) {
    // CHRIS: TODO: update nitro with this comment and the other below
    // findBatchContainingBlock errors if block number does not exist
    try {
      const res = (
        await nodeInterface.functions['findBatchContainingBlock'](
          arbTxReceipt.blockNumber
        )
      )[0] as BigNumber
      arbTxReceipt.l1BatchNumber = res.toNumber()
    } catch (err) {
      // do nothing - errors are expected here
    }
  }

  if (fetchBatchConfirmations) {
    // getL1Confirmations returns 0 if block has does not exist
    const res = (
      await nodeInterface.functions['getL1Confirmations'](
        arbTxReceipt.blockHash
      )
    )[0] as BigNumber
    arbTxReceipt.l1BatchConfirmations = res.toNumber()
  }

  return arbTxReceipt
}

/**
 * Fetch a block for the provided hash, and include some additional arbitrum specific fields
 * @param l2Provider
 * @param blockHash
 * @param includeTransactions
 */
export async function getArbBlockByHash<T extends boolean = false>(
  l2Provider: JsonRpcProvider,
  blockHash: string,
  includeTransactions?: T
): Promise<T extends true ? ArbBlockWithTransactions | null : ArbBlock | null>
export async function getArbBlockByHash<T extends boolean = false>(
  l2Provider: JsonRpcProvider,
  blockHash: string,
  includeTransactions?: T
): Promise<ArbBlock | ArbBlockWithTransactions | null> {
  const l2Block = await l2Provider.send('eth_getBlockByHash', [
    blockHash,
    includeTransactions,
  ])
  if (l2Block === null) return null
  const arbFormatter = new ArbFormatter()

  return includeTransactions
    ? arbFormatter.blockWithTransactions(l2Block)
    : ((arbFormatter.block(l2Block) as unknown) as ArbBlockWithTransactions)
}
