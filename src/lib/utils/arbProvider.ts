import { JsonRpcProvider, Formatter } from '@ethersproject/providers'
import {
  ArbBatchConfirmations,
  ArbBatchNumber,
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
} from '../dataEntities/rpc'
import { BigNumber, Contract } from 'ethers'
import { Formats } from '@ethersproject/providers/lib/formatter'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { Interface } from 'ethers/lib/utils'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

class ArbFormatter extends Formatter {
  readonly formats!: Formats

  public getDefaultFormats(): Formats {
    // formats was already initialised in super, so we can just access here
    const superFormats = super.getDefaultFormats()

    const bigNumber = this.bigNumber.bind(this)
    const hash = this.hash.bind(this)
    const number = this.number.bind(this)

    const arbBlockProps = {
      sendRoot: hash,
      sendCount: bigNumber,
      l1BlockNumber: number,
    }

    const arbReceiptFormat = {
      ...superFormats.receipt,
      l1BlockNumber: number,
      gasUsedForL1: bigNumber,
    }

    return {
      ...superFormats,
      receipt: arbReceiptFormat,
      block: { ...superFormats.block, ...arbBlockProps },
      blockWithTransactions: {
        ...superFormats.blockWithTransactions,
        ...arbBlockProps,
      },
    }
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
      (TBatch extends true ? ArbBatchNumber : Record<string, never>) &
      (TConfirmations extends true
        ? ArbBatchConfirmations
        : Record<string, never>))
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

  const nodeInterface = NodeInterface__factory.connect(
    NODE_INTERFACE_ADDRESS,
    l2Provider
  )
  if (fetchBatchNumber) {
    // findBatchContainingBlock errors if block number does not exist
    try {
      const res = await nodeInterface.findBatchContainingBlock(
        arbTxReceipt.blockNumber
      )
      arbTxReceipt.l1BatchNumber = res.toNumber()
    } catch (err) {
      // do nothing - errors are expected here
    }
  }

  if (fetchBatchConfirmations) {
    // getL1Confirmations returns 0 if block has does not exist
    const res = await nodeInterface.getL1Confirmations(arbTxReceipt.blockHash)
    arbTxReceipt.l1BatchConfirmations = res.toNumber()
  }

  return arbTxReceipt
}

/**
 * Fetch a block for the provided hash, including additional arbitrum specific fields
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
