import { Provider } from '@ethersproject/abstract-provider'
import { TransactionReceipt } from '@ethersproject/providers'
import { ArbSdkError } from '../dataEntities/errors'

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
  timeout = 900000
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