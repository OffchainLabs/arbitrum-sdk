/**
 * SubmitRetryableMessageDataParser — parses the data field from
 * InboxMessageDelivered events for L1MessageType_submitRetryableTx messages.
 *
 * The data is ABI-encoded (packed for the last bytes field):
 *   uint256 dest, uint256 l2CallValue, uint256 l1Value, uint256 maxSubmissionFee,
 *   uint256 excessFeeRefundAddress, uint256 callValueRefundAddress,
 *   uint256 gasLimit, uint256 maxFeePerGas, uint256 dataLength
 *   followed by `dataLength` bytes of calldata
 *
 * All numeric fields are bigint in the core package.
 */
import { getAddress } from '../encoding/address'
import { zeroPad } from '../encoding/hex'
import type { RetryableMessageParams } from './types'

/**
 * Convert a bigint representing an address (uint256) to a checksummed address string.
 * Pads to 20 bytes (40 hex chars).
 */
function addressFromBigInt(value: bigint): string {
  const hex = '0x' + value.toString(16).padStart(40, '0')
  return getAddress(hex)
}

export class SubmitRetryableMessageDataParser {
  /**
   * Parse the event data emitted in the InboxMessageDelivered event
   * for messages of type L1MessageType_submitRetryableTx.
   *
   * @param eventData - The hex-encoded data field from InboxMessageDelivered
   * @returns Parsed retryable message parameters with bigint amounts
   */
  parse(eventData: string): RetryableMessageParams {
    const hex = eventData.startsWith('0x') ? eventData.slice(2) : eventData

    // Each uint256 is 32 bytes = 64 hex chars
    // The first 9 fields are packed uint256 values
    const readUint256 = (offset: number): bigint => {
      const word = hex.substring(offset * 2, offset * 2 + 64)
      return BigInt('0x' + word)
    }

    const destAddress = addressFromBigInt(readUint256(0))
    const l2CallValue = readUint256(32)
    const l1Value = readUint256(64)
    const maxSubmissionFee = readUint256(96)
    const excessFeeRefundAddress = addressFromBigInt(readUint256(128))
    const callValueRefundAddress = addressFromBigInt(readUint256(160))
    const gasLimit = readUint256(192)
    const maxFeePerGas = readUint256(224)
    const callDataLength = readUint256(256)

    // The calldata bytes are appended at the end of the data
    const callDataLengthNum = Number(callDataLength)
    const data =
      callDataLengthNum === 0
        ? '0x'
        : '0x' + hex.substring(hex.length - callDataLengthNum * 2)

    return {
      destAddress,
      l2CallValue,
      l1Value,
      maxSubmissionFee,
      excessFeeRefundAddress,
      callValueRefundAddress,
      gasLimit,
      maxFeePerGas,
      data,
    }
  }
}
