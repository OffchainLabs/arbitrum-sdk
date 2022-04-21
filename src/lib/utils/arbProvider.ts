import { JsonRpcProvider, Formatter } from '@ethersproject/providers'
import {
  ArbBlock,
  ArbBlockWithTransactions,
  ArbTransactionReceipt,
  BatchInfo,
} from '../dataEntities/rpc'
import { providers, BigNumber } from 'ethers'
import { Formats, FormatFuncs } from '@ethersproject/providers/lib/formatter'
import { getL1Network, getL2Network, L2Network } from '../..'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { SequencerInbox__factory } from '../abi/factories/SequencerInbox__factory'

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
 * Get batch info for a message of a given sequence number
 * If eventType is "sequencer" only sequencer events will be looked for
 * If eventType is "delayed" only force included events will be looked for
 * @returns
 */
const getBatch = async (
  seqNum: BigNumber,
  l1Provider: providers.Provider,
  l2Network: L2Network,
  startBlock: number,
  endBlock: number,
  eventTypes: 'sequencer' | 'delayed'
): Promise<Omit<BatchInfo, 'confirmations'> | null> => {
  // CHRIS: TODO: reimplement with nitro inbox logic
  // https://github.com/OffchainLabs/nitro/pull/505
  // this should also include delayed messages
  throw new Error('sdk getBatch not implemented')
}

/**
 * Get batch info for a message of a given sequence number
 * Only looks for events created by the sequencer
 * @param seqNum
 * @param l2Txl1BlockNumber The l1BlockNumber that was in the receipt of the l2 transaction. This is the value block.number would have during the execution of that transaciton.
 * @param l1Provider
 * @param l2Network
 * @returns
 */
const getSequencerBatch = async (
  seqNum: BigNumber,
  l2Txl1BlockNumber: number,
  l1Provider: providers.Provider,
  l2Network: L2Network
): Promise<Omit<BatchInfo, 'confirmations'> | null> => {
  const inbox = SequencerInbox__factory.connect(
    l2Network.ethBridge.sequencerInbox,
    l1Provider
  )

  const delayBlocks = (
    await inbox.callStatic.maxTimeVariation()
  ).delayBlocks.toNumber()

  const startBlock = l2Txl1BlockNumber
  const delayedBlockMax = l2Txl1BlockNumber + delayBlocks
  const currentBlock = await l1Provider.getBlockNumber()

  const endBlock = Math.min(delayedBlockMax, currentBlock)

  return await getBatch(
    seqNum,
    l1Provider,
    l2Network,
    startBlock,
    endBlock,
    'sequencer'
  )
}

/**
 * Get batch info for a message of a given sequence number
 * Only looks for force included events
 * @param seqNum
 * @param l2Txl1BlockNumber The l1BlockNumber that was in the receipt of the l2 transaction. This is the value block.number would have during the execution of that transaciton.
 * @param l1Provider
 * @param l2Network
 * @returns
 */
const getDelayedBatch = async (
  seqNum: BigNumber,
  l2Txl1BlockNumber: number,
  l1Provider: providers.Provider,
  l2Network: L2Network
): Promise<Omit<BatchInfo, 'confirmations'> | null> => {
  const inbox = SequencerInbox__factory.connect(
    l2Network.ethBridge.sequencerInbox,
    l1Provider
  )
  const delayBlocks = (
    await inbox.callStatic.maxTimeVariation()
  ).delayBlocks.toNumber()
  const delayedBlockMax = l2Txl1BlockNumber + delayBlocks
  const currentBlock = await l1Provider.getBlockNumber()
  const startBlock = Math.min(delayedBlockMax, currentBlock)
  const endBlock = Math.max(startBlock, currentBlock)

  return await getBatch(
    seqNum,
    l1Provider,
    l2Network,
    startBlock,
    endBlock,
    'delayed'
  )
}

/**
 * Fetch a transaction receipt from an l2Provider
 * If an l1Provider is also provided then info about the l1 data
 * availability of the transaction will also be returned in the l1InboxBatchInfo
 * field
 * @param l2Provider
 * @param txHash
 * @param l1ProviderForBatch
 * @returns
 */
export const getArbTransactionReceipt = async (
  l2Provider: JsonRpcProvider,
  txHash: string,
  l1ProviderForBatch?: JsonRpcProvider
): Promise<ArbTransactionReceipt | null> => {
  const rec = await l2Provider.send('eth_getTransactionReceipt', [txHash])
  if (rec == null) return null
  const arbFormatter = new ArbFormatter()
  const arbTxReceipt = arbFormatter.receipt(rec)

  // if we haven't already got batch info, and it has been requested
  // then we fetch it and append it
  if (!arbTxReceipt.l1InboxBatchInfo && l1ProviderForBatch) {
    const l2Network = await getL2Network(l2Provider)
    const l1Network = await getL1Network(l2Network.partnerChainID)
    SignerProviderUtils.checkNetworkMatches(
      l1ProviderForBatch,
      l1Network.chainID
    )

    const tx = await l2Provider.getTransaction(txHash)
    if (tx) {
      // CHRIS: TODO: these need to updated
      const l1SequenceNumber = BigNumber.from(1) // tx.l1SequencerNumber
      const l1BlockNumber = 1 // tx.blockNumber

      const sequencerBatch = await getSequencerBatch(
        l1SequenceNumber,
        l1BlockNumber,
        l1ProviderForBatch,
        l2Network
      )
      let batch = sequencerBatch

      // we didnt find a sequencer batch, either it hasnt been included
      // yet, or we it was included as a delayed batch
      if (!sequencerBatch) {
        const currentBlock = await l1ProviderForBatch.getBlockNumber()
        const inbox = SequencerInbox__factory.connect(
          l2Network.ethBridge.sequencerInbox,
          l1ProviderForBatch
        )
        const delayBlocks = (
          await inbox.callStatic.maxTimeVariation()
        ).delayBlocks.toNumber()
        const delaySeconds = (
          await inbox.callStatic.maxTimeVariation()
        ).delaySeconds.toNumber()
        const l1Timestamp = (await l1ProviderForBatch.getBlock(l1BlockNumber))
          .timestamp
        const timeNowSec = Date.now() / 1000

        if (
          currentBlock > delayBlocks + l1BlockNumber &&
          timeNowSec > delaySeconds + l1Timestamp
        ) {
          // we've passed the delayed block period, so it's
          // worthwhile to look for delayed batches
          batch = await getDelayedBatch(
            l1SequenceNumber,
            l1BlockNumber,
            l1ProviderForBatch,
            l2Network
          )
        }
      }

      const currentBlock = await l1ProviderForBatch.getBlockNumber()

      arbTxReceipt.l1InboxBatchInfo = batch
        ? { ...batch, confirmations: currentBlock - batch.blockNumber }
        : null
    }
  }

  return arbTxReceipt
}

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
