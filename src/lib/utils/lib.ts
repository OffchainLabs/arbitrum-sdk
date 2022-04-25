import { Provider } from '@ethersproject/abstract-provider'
import { ArbTsError } from '../dataEntities/errors'

export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

export const getBaseFee = async (provider: Provider) => {
  const baseFee = (await provider.getBlock('latest')).baseFeePerGas
  if (!baseFee) {
    throw new ArbTsError(
      'Latest block did not contain base fee, ensure provider is connected to a network that supports EIP 1559.'
    )
  }
  return baseFee
}
