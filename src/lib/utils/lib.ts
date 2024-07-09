import { Provider } from '@ethersproject/abstract-provider'
import { TransactionReceipt, JsonRpcProvider } from '@ethersproject/providers'
import { ArbSdkError } from '../dataEntities/errors'
import { ArbitrumProvider } from './arbProvider'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { getNitroGenesisBlock } from '../dataEntities/networks'
import { BigNumber } from 'ethers'

export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

export const getBaseFee = async (provider: Provider): Promise<BigNumber> => {
  const baseFee = (await provider.getBlock('latest')).baseFeePerGas
  if (!baseFee) {
    throw new ArbSdkError(
      'Latest block did not contain base fee, ensure provider is connected to a network that supports EIP 1559.'
    )
  }
  return baseFee
}

/**
 * Waits for a transaction receipt if confirmations or timeout is provided
 * Otherwise tries to fetch straight away.
 * @param provider
 * @param txHash
 * @param confirmations
 * @param timeout
 * @returns
 */
export const getTransactionReceipt = async (
  provider: Provider,
  txHash: string,
  confirmations?: number,
  timeout?: number
): Promise<TransactionReceipt | null> => {
  if (confirmations || timeout) {
    try {
      const receipt = await provider.waitForTransaction(
        txHash,
        confirmations,
        timeout
      )
      return receipt || null
    } catch (err) {
      if ((err as Error).message.includes('timeout exceeded')) {
        // return null
        return null
      } else throw err
    }
  } else {
    const receipt = await provider.getTransactionReceipt(txHash)
    return receipt || null
  }
}

export const isDefined = <T>(val: T | null | undefined): val is T =>
  typeof val !== 'undefined' && val !== null

export const isArbitrumChain = async (provider: Provider): Promise<boolean> => {
  try {
    await ArbSys__factory.connect(ARB_SYS_ADDRESS, provider).arbOSVersion()
  } catch (error) {
    return false
  }
  return true
}

type GetFirstBlockForL1BlockProps = {
  arbitrumProvider: JsonRpcProvider
  forL1Block: number
  allowGreater?: boolean
  minArbitrumBlock?: number
  maxArbitrumBlock?: number | 'latest'
}

/**
 * This function performs a binary search to find the first Arbitrum block that corresponds to a given L1 block number.
 * The function returns a Promise that resolves to a number if a block is found, or undefined otherwise.
 *
 * @param {JsonRpcProvider} arbitrumProvider - The Arbitrum provider to use for the search.
 * @param {number} forL1Block - The L1 block number to search for.
 * @param {boolean} [allowGreater=false] - Whether to allow the search to go past the specified `forL1Block`.
 * @param {number|string} minArbitrumBlock - The minimum Arbitrum block number to start the search from. Cannot be below the network's Nitro genesis block.
 * @param {number|string} [maxArbitrumBlock='latest'] - The maximum Arbitrum block number to end the search at. Can be a `number` or `'latest'`. `'latest'` is the current block.
 * @returns {Promise<number | undefined>} - A Promise that resolves to a number if a block is found, or undefined otherwise.
 */
export async function getFirstBlockForL1Block({
  arbitrumProvider,
  forL1Block,
  allowGreater = false,
  minArbitrumBlock,
  maxArbitrumBlock = 'latest',
}: GetFirstBlockForL1BlockProps): Promise<number | undefined> {
  if (!(await isArbitrumChain(arbitrumProvider))) {
    // Provider is L1.
    return forL1Block
  }

  const arbProvider = new ArbitrumProvider(arbitrumProvider)
  const currentArbBlock = await arbProvider.getBlockNumber()
  const arbitrumChainId = (await arbProvider.getNetwork()).chainId
  const nitroGenesisBlock = getNitroGenesisBlock(arbitrumChainId)

  async function getL1Block(forL2Block: number) {
    const { l1BlockNumber } = await arbProvider.getBlock(forL2Block)
    return l1BlockNumber
  }

  if (!minArbitrumBlock) {
    minArbitrumBlock = nitroGenesisBlock
  }

  if (maxArbitrumBlock === 'latest') {
    maxArbitrumBlock = currentArbBlock
  }

  if (minArbitrumBlock >= maxArbitrumBlock) {
    throw new Error(
      `'minArbitrumBlock' (${minArbitrumBlock}) must be lower than 'maxArbitrumBlock' (${maxArbitrumBlock}).`
    )
  }

  if (minArbitrumBlock < nitroGenesisBlock) {
    throw new Error(
      `'minArbitrumBlock' (${minArbitrumBlock}) cannot be below the Nitro genesis block, which is ${nitroGenesisBlock} for the current network.`
    )
  }

  let start = minArbitrumBlock
  let end = maxArbitrumBlock

  let resultForTargetBlock
  let resultForGreaterBlock

  while (start <= end) {
    // Calculate the midpoint of the current range.
    const mid = start + Math.floor((end - start) / 2)

    const l1Block = await getL1Block(mid)

    // If the midpoint matches the target, we've found a match.
    // Adjust the range to search for the first occurrence.
    if (l1Block === forL1Block) {
      end = mid - 1
    } else if (l1Block < forL1Block) {
      start = mid + 1
    } else {
      end = mid - 1
    }

    // Stores last valid Arbitrum block corresponding to the current, or greater, L1 block.
    if (l1Block) {
      if (l1Block === forL1Block) {
        resultForTargetBlock = mid
      }
      if (allowGreater && l1Block > forL1Block) {
        resultForGreaterBlock = mid
      }
    }
  }

  return resultForTargetBlock ?? resultForGreaterBlock
}

export const getBlockRangesForL1Block = async (
  props: GetFirstBlockForL1BlockProps
) => {
  const arbProvider = new ArbitrumProvider(props.arbitrumProvider)
  const currentArbitrumBlock = await arbProvider.getBlockNumber()

  if (!props.maxArbitrumBlock || props.maxArbitrumBlock === 'latest') {
    props.maxArbitrumBlock = currentArbitrumBlock
  }

  const result = await Promise.all([
    getFirstBlockForL1Block({ ...props, allowGreater: false }),
    getFirstBlockForL1Block({
      ...props,
      forL1Block: props.forL1Block + 1,
      allowGreater: true,
    }),
  ])

  if (!result[0]) {
    // If there's no start of the range, there won't be the end either.
    return [undefined, undefined]
  }

  if (result[0] && result[1]) {
    // If both results are defined, we can assume that the previous Arbitrum block for the end of the range will be for 'forL1Block'.
    return [result[0], result[1] - 1]
  }

  return [result[0], props.maxArbitrumBlock]
}
