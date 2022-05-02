import { JsonRpcProvider, Formatter } from '@ethersproject/providers'
import {
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
} from '../dataEntities/rpc'
import { Formats } from '@ethersproject/providers/lib/formatter'

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
export async function getArbTransactionReceipt(
  l2Provider: JsonRpcProvider,
  txHash: string,
): Promise<ArbTransactionReceipt | null> {
  const rec = await l2Provider.send('eth_getTransactionReceipt', [txHash])
  if (rec == null) return null
  const arbFormatter = new ArbFormatter()
  return arbFormatter.receipt(rec)
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
    : (arbFormatter.block(l2Block) as unknown as ArbBlockWithTransactions)
}
