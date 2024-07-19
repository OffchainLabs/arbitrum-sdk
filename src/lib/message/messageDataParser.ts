import { getAddress } from '@ethersproject/address'
import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { hexZeroPad } from '@ethersproject/bytes'

export class SubmitRetryableMessageDataParser {
  /**
   * Parse the event data emitted in the InboxMessageDelivered event
   * for messages of type L1MessageType_submitRetryableTx
   * @param eventData The data field in InboxMessageDelivered for messages of kind L1MessageType_submitRetryableTx
   * @returns
   */
  public parse(eventData: string) {
    // decode the data field - is been packed so we cant decode the bytes field this way
    // refer to ArbitrumSubmitRetryableTx here: https://github.com/OffchainLabs/go-ethereum/blob/18256c2dfcce8fd567aa05e03fbc11a4c17aa550/core/types/arb_types.go#L283
    const parsed = defaultAbiCoder.decode(
      [
        'uint256', // RetryTo
        'uint256', // RetryValue
        'uint256', // DepositValue
        'uint256', // MaxSubmissionFee
        'uint256', // FeeRefundAddr
        'uint256', // Beneficiary
        'uint256', // Gas
        'uint256', // GasFeeCap
        'uint256', // data length
      ],
      eventData
    ) as BigNumber[]

    const addressFromBigNumber = (bn: BigNumber) =>
      getAddress(hexZeroPad(bn.toHexString(), 20))

    const retryTo = addressFromBigNumber(parsed[0])
    const retryValue = parsed[1]
    const l1Value = parsed[2]
    const maxSubmissionFee = parsed[3]
    const feeRefundAddr = addressFromBigNumber(parsed[4])
    const beneficiary = addressFromBigNumber(parsed[5])
    const gasLimit = parsed[6]
    const maxFeePerGas = parsed[7]
    const callDataLength = parsed[8]
    const data =
      '0x' +
      eventData.substring(eventData.length - callDataLength.mul(2).toNumber())

    return {
      retryTo,
      retryValue,
      l1Value,
      maxSubmissionFee: maxSubmissionFee,
      feeRefundAddr,
      beneficiary,
      gasLimit,
      maxFeePerGas,
      data,
    }
  }
}
