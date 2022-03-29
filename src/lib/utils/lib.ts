import { BigNumber } from 'ethers'

export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

export const toBigNumber = (input: BigNumber | number) => {
  return typeof input === 'number' ? BigNumber.from(input) : input
}
