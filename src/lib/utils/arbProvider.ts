import { BlockTag, JsonRpcProvider, Networkish } from 'ethers'
import {
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
} from '../dataEntities/rpc'

// class ArbFormatter extends Formatter {
//   readonly formats!: Formats

//   public getDefaultFormats(): Formats {
//     // formats was already initialised in super, so we can just access here
//     const superFormats = super.getDefaultFormats()

//     const bigNumber = this.bigNumber.bind(this)
//     const hash = this.hash.bind(this)
//     const number = this.number.bind(this)

//     const arbBlockProps = {
//       sendRoot: hash,
//       sendCount: bigNumber,
//       l1BlockNumber: number,
//     }

//     const arbReceiptFormat = {
//       ...superFormats.receipt,
//       l1BlockNumber: number,
//       gasUsedForL1: bigNumber,
//     }

//     return {
//       ...superFormats,
//       receipt: arbReceiptFormat,
//       block: { ...superFormats.block, ...arbBlockProps },
//       blockWithTransactions: {
//         ...superFormats.blockWithTransactions,
//         ...arbBlockProps,
//       },
//     }
//   }

//   public receipt(value: any): ArbTransactionReceipt {
//     return super.receipt(value) as ArbTransactionReceipt
//   }

//   public block(block: any): ArbBlock {
//     return super.block(block) as ArbBlock
//   }

//   public blockWithTransactions(block: any): ArbBlock {
//     // ethersjs chose the wrong type for the super - it should have been BlockWithTransactions
//     // but was instead just Block. This means that when we override we cant use ArbBlockWithTransactions
//     // but must instead use just ArbBlock.
//     return super.blockWithTransactions(block) as ArbBlock
//   }
// }

/**
 * Arbitrum specific formats
 */
export class ArbitrumProvider extends JsonRpcProvider {
  /**
   * Arbitrum specific formats
   * @param provider Must be connected to an Arbitrum network
   * @param network Must be an Arbitrum network
   */
  public constructor(provider: JsonRpcProvider, network?: Networkish) {
    // TODO: fix any
    super(provider.send.bind(provider) as any, network)
  }

  public async getTransactionReceipt(
    transactionHash: string | Promise<string>
  ): Promise<ArbTransactionReceipt> {
    return (await super.getTransactionReceipt(
      await transactionHash
    )) as ArbTransactionReceipt
  }

  public async getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | Promise<BlockTag>
  ): Promise<ArbBlockWithTransactions> {
    return (await super.getBlock(
      await blockHashOrBlockTag,
      true
    )) as ArbBlockWithTransactions
  }

  public async getBlock(
    blockHashOrBlockTag: BlockTag | Promise<BlockTag>
  ): Promise<ArbBlock> {
    return (await super.getBlock(await blockHashOrBlockTag)) as ArbBlock
  }
}
