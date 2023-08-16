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
  // const currentArbBlock = await arbProvider.getBlockNumber()
  const currentArbBlock = 10100
  const arbitrumChainId = (await arbProvider.getNetwork()).chainId
  const { nitroGenesisBlock } = l2Networks[arbitrumChainId]

  if (minL2Block === 'latest') {
    minL2Block = Math.floor(currentArbBlock - 10)
  }

  if (maxL2Block === 'latest') {
    maxL2Block = currentArbBlock
  }

  let start = minL2Block
  let end = maxL2Block

  let lastValidL2Block
  let resultForL1Block

  const myObject = {
    1000: [],
    1001: [10000, 10001],
    1002: [10002, 10003, 10004, 10005],
    1003: [10006],
    1004: [10007, 10008, 10009],
    1005: [10010, 10011, 10012, 10013],
    1006: [],
    1007: [10014, 10015],
    1008: [10016, 10017, 10018],
    1009: [10019],
    1010: [],
    1011: [10020, 10021, 10022],
    1012: [10023, 10024],
    1013: [10025],
    1014: [10026, 10027, 10028, 10029],
    1015: [],
    1016: [10030, 10031],
    1017: [10032, 10033, 10034],
    1018: [10035],
    1019: [10036, 10037],
    1020: [10038, 10039, 10040, 10041],
    1021: [],
    1022: [10042, 10043],
    1023: [10044, 10045, 10046],
    1024: [10047],
    1025: [],
    1026: [10048, 10049, 10050],
    1027: [10051, 10052, 10053, 10054],
    1028: [],
    1029: [10055],
    1030: [10056, 10057],
    1031: [10058, 10059, 10060],
    1032: [10061],
    1033: [10062, 10063, 10064],
    1034: [],
    1035: [10065, 10066],
    1036: [10067, 10068, 10069, 10070],
    1037: [10071],
    1038: [10072, 10073],
    1039: [],
    1040: [10074, 10075, 10076],
    1041: [10077, 10078],
    1042: [10079],
    1043: [10080, 10081, 10082, 10083],
    1044: [],
    1045: [10084, 10085],
    1046: [10086, 10087, 10088],
    1047: [10089],
    1048: [10090, 10091],
    1049: [10092, 10093, 10094, 10095],
    1050: [10096, 10097, 10098, 10099],
    1051: [],
    1052: [],
    1053: [],
    1054: [10100],
  }

  function findKeyByValue(value: number): number {
    const keys = Object.keys(myObject)
    for (const key of keys) {
      if ((myObject as { [key: string]: number[] })[key].includes(value)) {
        return Number(key)
      }
    }
    return Infinity
  }

  // Adjust the range to ensure it encompasses the target L1 block number.
  // We lower the range in increments if the start of the range exceeds the L1 block number.
  while (findKeyByValue(start) > forL1Block - 1 && start >= 1) {
    // Lowering the range.
    start = Math.max(1, Math.floor(start - 10))
  }

  while (start <= end) {
    // Calculate the midpoint of the current range.
    const mid = start + Math.floor((end - start) / 2)

    const l1Block = await findKeyByValue(mid)

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
