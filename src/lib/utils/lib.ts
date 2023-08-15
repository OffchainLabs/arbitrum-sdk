import { BigNumber } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { TransactionReceipt, JsonRpcProvider } from '@ethersproject/providers'
import { ArbSdkError } from '../dataEntities/errors'
import { ArbitrumProvider } from './arbProvider'
import { l2Networks } from '../dataEntities/networks'

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

export const getBlockRangesForL1Block = async ({
  targetL1BlockNumber,
  provider,
}: {
  targetL1BlockNumber: number
  provider: JsonRpcProvider
}) => {
  const arbitrumProvider = new ArbitrumProvider(provider)
  const currentArbBlock = await arbitrumProvider.getBlockNumber()

  const arbitrumChainId = (await arbitrumProvider.getNetwork()).chainId
  const { nitroGenesisBlock } = l2Networks[arbitrumChainId]

  // Define the starting point to be closer to the current block for efficiency.
  let startArbBlock = Math.floor(currentArbBlock * 0.95)
  let endArbBlock = currentArbBlock

  async function getL1Block(forL2Block: number) {
    const l2Block = Math.max(nitroGenesisBlock, forL2Block)
    const { l1BlockNumber } = await arbitrumProvider.getBlock(l2Block)
    return l1BlockNumber
  }

  // Binary search to find the starting Arbitrum block that corresponds to the L1 block number.
  async function getL2StartBlock() {
    let result
    let start = startArbBlock
    let end = endArbBlock

    while (start <= end) {
      // Calculate the midpoint of the current range.
      const mid = start + Math.floor((end - start) / 2)

      const l1Block = await getL1Block(mid)

      // If the midpoint matches the target, we've found a match.
      // Adjust the range to search for the first occurrence.
      if (l1Block === targetL1BlockNumber) {
        result = mid
        end = mid - 1
      } else if (l1Block < targetL1BlockNumber) {
        // If the L1 block number is less than the target, adjust the range to the upper half.
        start = mid + 1
      } else {
        // If the L1 block number is greater than the target, adjust the range to the lower half.
        end = mid - 1
      }
    }

    if (typeof result === 'undefined') {
      throw new Error(`No L2 range found for L1 block: ${targetL1BlockNumber}`)
    }

    return BigNumber.from(result)
  }

  // Binary search to find the ending Arbitrum block that corresponds to the L1 block number.
  async function getL2EndBlock() {
    let result
    let start = startArbBlock
    let end = endArbBlock

    while (start <= end) {
      // Calculate the midpoint of the current range.
      const mid = start + Math.floor((end - start) / 2)

      const l1Block = await getL1Block(mid)

      // If the midpoint matches the target, we've found a match.
      // Adjust the range to search for the last occurrence.
      if (l1Block === targetL1BlockNumber) {
        result = mid
        start = mid + 1
      } else if (l1Block < targetL1BlockNumber) {
        // If the L1 block number is less than the target, adjust the range to the upper half.
        start = mid + 1
      } else {
        // If the L1 block number is greater than the target, adjust the range to the lower half.
        end = mid - 1
      }
    }

    if (typeof result === 'undefined') {
      throw new Error(`No L2 range found for L1 block: ${targetL1BlockNumber}`)
    }

    return BigNumber.from(result)
  }

  // Adjust the range to ensure it encompasses the target L1 block number.
  // We lower the range in increments if the start of the range exceeds the L1 block number.
  while (
    (await getL1Block(startArbBlock)) > targetL1BlockNumber &&
    startArbBlock >= 1
  ) {
    // Lowering the range.
    endArbBlock = startArbBlock
    startArbBlock = Math.max(
      1,
      Math.floor(startArbBlock - currentArbBlock * 0.2)
    )
  }

  return await Promise.all([getL2StartBlock(), getL2EndBlock()])
}
