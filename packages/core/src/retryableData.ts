import { keccak256 } from './encoding/keccak'
import { isDefined } from './utils/lib'

/**
 * Parsed retryable data from a RetryableData error.
 * All numeric fields are bigint.
 */
export interface RetryableData {
  from: string
  /** The address to be called on L2 */
  to: string
  /** The value to call the L2 address with */
  l2CallValue: bigint
  /** The total amount to deposit on L1 to cover L2 gas and L2 call value */
  deposit: bigint
  /** The maximum cost to be paid for submitting the transaction */
  maxSubmissionCost: bigint
  /** The address to return any gas that was not spent on fees */
  excessFeeRefundAddress: string
  /** The address to refund the call value to in the event the retryable is cancelled or expires */
  callValueRefundAddress: string
  /** The L2 gas limit */
  gasLimit: bigint
  /** The max gas price to pay on L2 */
  maxFeePerGas: bigint
  /** The data to call the L2 address with */
  data: string
}

// Error signature: RetryableData(address,address,uint256,uint256,uint256,address,address,uint256,uint256,bytes)
// The 4-byte selector is keccak256 of the canonical signature.
const ERROR_SIGNATURE =
  'RetryableData(address,address,uint256,uint256,uint256,address,address,uint256,uint256,bytes)'

function getErrorSelector(): string {
  const sigHex =
    '0x' +
    Array.from(ERROR_SIGNATURE)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  return keccak256(sigHex).slice(0, 10) // 0x + 8 hex chars
}

const RETRYABLE_DATA_SELECTOR = getErrorSelector()

/**
 * Decode an address from a 32-byte ABI word (hex string, no prefix).
 */
function decodeAddress(word: string): string {
  return '0x' + word.substring(24).toLowerCase()
}

/**
 * Decode a uint256 from a 32-byte ABI word (hex string, no prefix).
 */
function decodeUint256(word: string): bigint {
  return BigInt('0x' + word)
}

/**
 * Parse the ABI-encoded error data for RetryableData.
 * Layout (after the 4-byte selector):
 *   word 0: from (address)
 *   word 1: to (address)
 *   word 2: l2CallValue (uint256)
 *   word 3: deposit (uint256)
 *   word 4: maxSubmissionCost (uint256)
 *   word 5: excessFeeRefundAddress (address)
 *   word 6: callValueRefundAddress (address)
 *   word 7: gasLimit (uint256)
 *   word 8: maxFeePerGas (uint256)
 *   word 9: offset to bytes data (uint256)
 *   ...     bytes length + bytes data
 */
function parseRetryableData(hexData: string): RetryableData | null {
  const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData

  // Need at least 4 bytes selector + 10 words (320 bytes) = 328 bytes = 656 hex chars
  if (data.length < 8 + 640) {
    return null
  }

  const selector = '0x' + data.substring(0, 8)
  if (selector !== RETRYABLE_DATA_SELECTOR) {
    return null
  }

  // Strip selector, work with the remaining data
  const params = data.substring(8)

  const word = (index: number) => params.substring(index * 64, (index + 1) * 64)

  const from = decodeAddress(word(0))
  const to = decodeAddress(word(1))
  const l2CallValue = decodeUint256(word(2))
  const deposit = decodeUint256(word(3))
  const maxSubmissionCost = decodeUint256(word(4))
  const excessFeeRefundAddress = decodeAddress(word(5))
  const callValueRefundAddress = decodeAddress(word(6))
  const gasLimit = decodeUint256(word(7))
  const maxFeePerGas = decodeUint256(word(8))

  // Decode bytes data
  const dataOffset = Number(decodeUint256(word(9)))
  // dataOffset is in bytes from the start of params
  const dataLenHex = params.substring(
    dataOffset * 2,
    dataOffset * 2 + 64
  )
  const dataLen = Number(BigInt('0x' + dataLenHex))
  const bytesData =
    '0x' +
    params.substring(dataOffset * 2 + 64, dataOffset * 2 + 64 + dataLen * 2)

  return {
    from,
    to,
    l2CallValue,
    deposit,
    maxSubmissionCost,
    excessFeeRefundAddress,
    callValueRefundAddress,
    gasLimit,
    maxFeePerGas,
    data: bytesData,
  }
}

/**
 * Tools for parsing retryable data from errors.
 * When calling createRetryableTicket on Inbox.sol special values
 * can be passed for gasLimit and maxFeePerGas. This causes the call to revert
 * with the info needed to estimate the gas needed for a retryable ticket using
 * L1ToL2GasPriceEstimator.
 */
export class RetryableDataTools {
  /**
   * The parameters that should be passed to createRetryableTicket in order to induce
   * a revert with retryable data.
   */
  public static ErrorTriggeringParams = {
    gasLimit: 1n,
    maxFeePerGas: 1n,
  }

  private static isErrorData(
    maybeErrorData: Error | { errorData: string }
  ): maybeErrorData is { errorData: string } {
    return isDefined((maybeErrorData as { errorData: string }).errorData)
  }

  private static tryGetErrorData(
    ethersJsError: Error | { errorData: string }
  ): string | null {
    if (this.isErrorData(ethersJsError)) {
      return ethersJsError.errorData
    }

    const typedError = ethersJsError as {
      data?: string
      error?: {
        error?: {
          body?: string
          data?: string
        }
      }
    }

    if (typedError.data) {
      return typedError.data
    } else if (typedError.error?.error?.body) {
      const maybeData = (
        JSON.parse(typedError.error.error.body) as {
          error?: {
            data?: string
          }
        }
      ).error?.data

      if (!maybeData) return null
      return maybeData
    } else if (typedError.error?.error?.data) {
      return typedError.error.error.data
    }

    return null
  }

  /**
   * Try to parse a retryable data struct from the supplied error or error data string.
   */
  public static tryParseError(
    ethersJsErrorOrData: Error | { errorData: string } | string
  ): RetryableData | null {
    const errorData =
      typeof ethersJsErrorOrData === 'string'
        ? ethersJsErrorOrData
        : this.tryGetErrorData(ethersJsErrorOrData)
    if (!errorData) return null

    try {
      return parseRetryableData(errorData)
    } catch {
      return null
    }
  }
}
