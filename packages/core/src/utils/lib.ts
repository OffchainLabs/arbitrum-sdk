/**
 * Pure utility functions. No provider/ethers dependencies.
 */

/**
 * Type guard: returns true if val is neither null nor undefined.
 */
export const isDefined = <T>(val: T | null | undefined): val is T =>
  typeof val !== 'undefined' && val !== null

/**
 * Wait for a given number of milliseconds.
 */
export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

/**
 * Scale an amount from 18-decimal representation to a native token's decimal representation.
 *
 * Rounds up if truncation would occur, so the result is never zero for a non-zero input.
 */
export function scaleFrom18DecimalsToNativeTokenDecimals({
  amount,
  decimals,
}: {
  amount: bigint
  decimals: number
}): bigint {
  // identity for 18 decimals
  if (decimals === 18) {
    return amount
  }

  if (decimals < 18) {
    const divisor = 10n ** BigInt(18 - decimals)
    const scaledAmount = amount / divisor
    // round up if there is a remainder
    if (scaledAmount * divisor < amount) {
      return scaledAmount + 1n
    }
    return scaledAmount
  }

  // decimals > 18
  return amount * 10n ** BigInt(decimals - 18)
}

/**
 * Scale an amount from a native token's decimal representation to 18-decimal representation.
 */
export function scaleFromNativeTokenDecimalsTo18Decimals({
  amount,
  decimals,
}: {
  amount: bigint
  decimals: number
}): bigint {
  if (decimals < 18) {
    return amount * 10n ** BigInt(18 - decimals)
  } else if (decimals > 18) {
    return amount / 10n ** BigInt(decimals - 18)
  }

  return amount
}
