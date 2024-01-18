import { Interface } from '@ethersproject/abi'
import { BigNumber } from 'ethers'
import { isDefined } from '../utils/lib'

// TODO: add typechain support
const errorInterface = new Interface([
  'error RetryableData(address from, address to, uint256 l2CallValue, uint256 deposit, uint256 maxSubmissionCost, address excessFeeRefundAddress, address callValueRefundAddress, uint256 gasLimit, uint256 maxFeePerGas, bytes data)',
])
// CAUTION: this type mirrors the error type above
// The property names must exactly match those above
export interface RetryableData {
  from: string
  /**
   * The address to be called on L2
   */
  to: string
  /**
   * The value to call the L2 address with
   */
  l2CallValue: BigNumber
  /**
   * The total amount to deposit on L1 to cover L2 gas and L2 call value
   */
  deposit: BigNumber
  /**
   * The maximum cost to be paid for submitting the transaction
   */
  maxSubmissionCost: BigNumber
  /**
   * The address to return the any gas that was not spent on fees
   */
  excessFeeRefundAddress: string
  /**
   * The address to refund the call value to in the event the retryable is cancelled, or expires
   */
  callValueRefundAddress: string
  /**
   * The L2 gas limit
   */
  gasLimit: BigNumber
  /**
   * The max gas price to pay on L2
   */
  maxFeePerGas: BigNumber
  /**
   * The data to call the L2 address with
   */
  data: string
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
   * a revert with retryable data
   */
  public static ErrorTriggeringParams = {
    gasLimit: BigNumber.from(1),
    maxFeePerGas: BigNumber.from(1),
  }

  private static isErrorData(
    maybeErrorData: Error | { errorData: string }
  ): maybeErrorData is { errorData: string } {
    return isDefined((maybeErrorData as { errorData: string }).errorData)
  }

  private static tryGetErrorData(ethersJsError: Error | { errorData: string }) {
    if (this.isErrorData(ethersJsError)) {
      return ethersJsError.errorData
    } else {
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
          JSON.parse(typedError.error?.error?.body) as {
            error?: {
              data?: string
            }
          }
        ).error?.data

        if (!maybeData) return null
        return maybeData
      } else if (typedError.error?.error?.data) {
        return typedError.error?.error?.data
      } else {
        return null
      }
    }
  }

  /**
   * Try to parse a retryable data struct from the supplied ethersjs error, or any explicitly supplied error data
   * @param ethersJsErrorOrData
   * @returns
   */
  public static tryParseError(
    ethersJsErrorOrData: Error | { errorData: string } | string
  ): RetryableData | null {
    const errorData =
      typeof ethersJsErrorOrData === 'string'
        ? ethersJsErrorOrData
        : this.tryGetErrorData(ethersJsErrorOrData)
    if (!errorData) return null
    return errorInterface.parseError(errorData).args as unknown as RetryableData
  }
}
