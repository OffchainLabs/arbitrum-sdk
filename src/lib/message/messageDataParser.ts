import { getAddress } from 'ethers'
import { AbiCoder } from 'ethers'

import { zeroPadValue } from 'ethers'

export class SubmitRetryableMessageDataParser {
  /**
   * Parse the event data emitted in the InboxMessageDelivered event
   * for messages of type L1MessageType_submitRetryableTx
   * @param eventData The data field in InboxMessageDelivered for messages of kind L1MessageType_submitRetryableTx
   * @returns
   */
  public parse(eventData: string) {
    // decode the data field - is been packed so we cant decode the bytes field this way
    const parsed = AbiCoder.defaultAbiCoder().decode(
      [
        'uint256', // dest
        'uint256', // l2 call balue
        'uint256', // msg val
        'uint256', // max submission
        'uint256', // excess fee refund addr
        'uint256', // call value refund addr
        'uint256', // max gas
        'uint256', // gas price bid
        'uint256', // data length
      ],
      eventData
    ) as BigInt[]

    const addressFromBigInt = (bn: bigint) =>
      getAddress(zeroPadValue(bn.toString(16), 20))

    const destAddress = addressFromBigInt(parsed[0])
    const l2CallValue = parsed[1]
    const l1Value = parsed[2]
    const maxSubmissionFee = parsed[3]
    const excessFeeRefundAddress = addressFromBigInt(parsed[4])
    const callValueRefundAddress = addressFromBigInt(parsed[5])
    const gasLimit = parsed[6]
    const maxFeePerGas = parsed[7]
    const callDataLength = parsed[8]
    const data =
      '0x' +
      eventData.substring(eventData.length - (callDataLength * 2).toNumber())

    return {
      destAddress,
      l2CallValue,
      l1Value,
      maxSubmissionFee: maxSubmissionFee,
      excessFeeRefundAddress,
      callValueRefundAddress,
      gasLimit,
      maxFeePerGas,
      data,
    }
  }
}
