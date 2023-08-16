import { Provider } from '@ethersproject/abstract-provider'
import { TransactionReceipt, JsonRpcProvider } from '@ethersproject/providers'
import { ArbSdkError } from '../dataEntities/errors'
import { ArbitrumProvider } from './arbProvider'
import { l2Networks } from '../dataEntities/networks'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'

export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

export const getBaseFee = async (provider: Provider) => {
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

/**
 * This function performs a binary search to find the first L2 block that corresponds to a given L1 block number.
 * The function returns a Promise that resolves to an object containing the L2 block number and the corresponding L1 block number.
 *
 * @param {JsonRpcProvider} provider - The L2 provider to use for the search.
 * @param {number} forL1Block - The L1 block number to search for.
 * @param {boolean} [allowGreater=false] - Whether to allow the search to go past the specified `forL1Block`.
 * @param {number|string} [minL2Block='latest'] - The minimum L2 block number to start the search from. Can be a number or `'latest'`. `'latest'` means it will be close to the current block, but not exactly the current block.
 * @param {number|string} [maxL2Block='latest'] - The maximum L2 block number to end the search at. Can be a `number` or `'latest'`. `'latest'` is the current block.
 * @returns {Promise<{ l2Block: number | undefined; forL1Block: number | undefined }>} - A Promise that resolves to an object containing the L2 block number and the corresponding L1 block number.
 */
export async function getFirstBlockForL1Block({
  provider,
  forL1Block,
  allowGreater = false,
  minL2Block = 'latest',
  maxL2Block = 'latest',
}: {
  provider: JsonRpcProvider
  forL1Block: number
  allowGreater?: boolean
  minL2Block?: number | 'latest'
  maxL2Block?: number | 'latest'
}): Promise<{ l2Block: number | undefined; forL1Block: number | undefined }> {
  if (!isArbitrumChain(provider)) {
    throw new Error('Arbitrum provider is required.')
  }

  const arbProvider = new ArbitrumProvider(provider)
  const currentArbBlock = await arbProvider.getBlockNumber()
  const arbitrumChainId = (await arbProvider.getNetwork()).chainId
  const { nitroGenesisBlock } = l2Networks[arbitrumChainId]

  async function getL1Block(forL2Block: number) {
    const l2Block = Math.max(nitroGenesisBlock, forL2Block)
    const { l1BlockNumber } = await arbProvider.getBlock(l2Block)
    return l1BlockNumber
  }

  if (minL2Block === 'latest') {
    minL2Block = Math.floor(currentArbBlock * 0.95)
  }

  if (maxL2Block === 'latest') {
    maxL2Block = currentArbBlock
  }

  if (minL2Block >= maxL2Block) {
    throw new Error(`'minL2Block' must be lower than 'maxL2Block'.`)
  }

  let start = minL2Block
  let end = maxL2Block

  let lastValidL2Block
  let resultForL1Block

  // Adjust the range to ensure it encompasses the target L1 block number.
  // We lower the range in increments if the start of the range exceeds the L1 block number.
  while ((await getL1Block(start)) > forL1Block && start >= 1) {
    // Lowering the range.
    start = Math.max(1, Math.floor(start - currentArbBlock * 0.1))
  }

  while (start <= end) {
    // Calculate the midpoint of the current range.
    const mid = start + Math.floor((end - start) / 2)

    const l1Block = await getL1Block(mid)

    // If the midpoint matches the target, we've found a match.
    // Adjust the range to search for the first or last occurrence.
    if (l1Block === forL1Block) {
      if (allowGreater) {
        start = mid + 1
      } else {
        end = mid - 1
      }
    } else if (l1Block < forL1Block) {
      start = mid + 1
    } else {
      end = mid - 1
    }

    // Stores last valid L2 block correlating to the current L1 block.
    // We store the L1 block too and return them as a pair.
    if (l1Block) {
      const shouldStoreLesser =
        !allowGreater && l1Block < forL1Block && resultForL1Block !== forL1Block

      const shouldStoreGreater =
        allowGreater && l1Block > forL1Block && resultForL1Block !== forL1Block

      if (l1Block === forL1Block || shouldStoreLesser || shouldStoreGreater) {
        lastValidL2Block = mid
        resultForL1Block = l1Block
      }
    }
  }

  return { l2Block: lastValidL2Block, forL1Block: resultForL1Block }
}

export const getBlockRangesForL1Block = async (props: {
  forL1Block: number
  provider: JsonRpcProvider
}) => {
  return await Promise.all([
    getFirstBlockForL1Block({ ...props, allowGreater: false }),
    getFirstBlockForL1Block({ ...props, allowGreater: true }),
  ])
}
