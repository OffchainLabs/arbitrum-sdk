import { JsonRpcProvider, Formatter, BlockTag } from '@ethersproject/providers'
import {
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
} from '../dataEntities/rpc'
import { Formats } from '@ethersproject/providers/lib/formatter'
import { Networkish } from '@ethersproject/networks'

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
 * Arbitrum specific formats
 */
export class ArbitrumProvider extends JsonRpcProvider {
  private static arbFormatter = new ArbFormatter()

  public constructor(provider: JsonRpcProvider, network?: Networkish) {
    super(provider.connection, network)
  }

  static override getFormatter(): Formatter {
    return this.arbFormatter
  }

  public override async getTransactionReceipt(
    transactionHash: string | Promise<string>
  ): Promise<ArbTransactionReceipt> {
    return (await super.getTransactionReceipt(
      transactionHash
    )) as ArbTransactionReceipt
  }

  public override async getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | Promise<BlockTag>
  ): Promise<ArbBlockWithTransactions> {
    return (await super.getBlockWithTransactions(
      blockHashOrBlockTag
    )) as ArbBlockWithTransactions
  }

  public override async getBlock(
    blockHashOrBlockTag: BlockTag | Promise<BlockTag>
  ): Promise<ArbBlock> {
    return (await super.getBlock(blockHashOrBlockTag)) as ArbBlock
  }
}
