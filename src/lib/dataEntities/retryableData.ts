import { Interface } from '@ethersproject/abi'
import { BigNumber } from 'ethers'

export interface RetryableData {
  from: string
  to: string
  l2CallValue: BigNumber
  deposit: BigNumber
  maxSubmissionCost: BigNumber
  excessFeeRefundAddress: string
  callValueRefundAddress: string
  gasLimit: BigNumber
  maxFeePerGas: BigNumber
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
    return (maybeErrorData as { errorData: string }).errorData != undefined
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
    ethersJsErrorOrData: Error | { errorData: string }
  ): RetryableData | null {
    const errorData = this.tryGetErrorData(ethersJsErrorOrData)
    if (!errorData) return null

    const errorInterface = new Interface([
      'error RetryableData(address from, address to, uint256 l2CallValue, uint256 deposit, uint256 maxSubmissionCost, address excessFeeRefundAddress, address callValueRefundAddress, uint256 gasLimit, uint256 maxFeePerGas, bytes data)',
    ])

    return errorInterface.parseError(errorData).args as unknown as RetryableData
  }
}
