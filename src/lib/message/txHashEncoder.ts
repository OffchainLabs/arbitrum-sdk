import { ethers } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { zeroPad } from '@ethersproject/bytes'
import { L1ToL2Message } from './L1ToL2Message'
import { ArbSdkError } from '../dataEntities/errors'

export class TxHashEncoder extends L1ToL2Message {
  /**
   * ArbitrumDepositTx has type 0x64.
   * @param type //type of the tx
   * @param l2ChainId
   * @param fromAddress
   * @param messageNumber
   * @param destAddress
   * @param l1Value
   * @returns
   */
  public static calculateArbitrumDepositTxHash(
    type: number,
    l2ChainId: number,
    fromAddress: string,
    messageNumber: BigNumber,
    destAddress: string,
    l1Value: BigNumber
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 100) {
      throw new ArbSdkError(`This is not an ArbitrumDepositTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      '0x64',
      ethers.utils.RLP.encode([
        formatNumber(chainId),
        zeroPad(formatNumber(msgNum), 32),
        fromAddress,
        destAddress,
        formatNumber(l1Value),
      ]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }

  /**
   * ArbitrumUnsignedTx has type 0x65.
   * @param type //type of the tx
   * @param l2ChainId
   * @param fromAddress
   * @param nonce    //nonce of tx's sender account
   * @param maxFeePerGas
   * @param gasLimit
   * @param destAddress
   * @param l1Value
   * @param data
   * @returns
   */
  public static calculateArbitrumUnsignedTxHash(
    type: number,
    l2ChainId: number,
    fromAddress: string,
    nonce: number,
    maxFeePerGas: BigNumber,
    gasLimit: BigNumber,
    destAddress: string,
    l1Value: BigNumber,
    data: string
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 101) {
      throw new ArbSdkError(`This is not an ArbitrumUnsignedTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const senderNonce = BigNumber.from(nonce)
    const rlpEnc = ethers.utils.hexConcat([
      '0x65',
      ethers.utils.RLP.encode([
        formatNumber(chainId),
        fromAddress,
        senderNonce,
        formatNumber(maxFeePerGas),
        formatNumber(gasLimit),
        destAddress,
        formatNumber(l1Value),
        data,
      ]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }

  /**
   * The ArbitrumContractTx has type 0x66.
   * @param type //type of the tx
   * @param l2ChainId
   * @param messageNumber
   * @param fromAddress
   * @param maxFeePerGas
   * @param gasLimit
   * @param destAddress
   * @param l1Value
   * @param data
   * @returns
   */
  public static calculateArbitrumContractTxHash(
    type: number,
    l2ChainId: number,
    messageNumber: BigNumber,
    fromAddress: string,
    maxFeePerGas: BigNumber,
    gasLimit: BigNumber,
    destAddress: string,
    l1Value: BigNumber,
    data: string
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 102) {
      throw new ArbSdkError(`This is not an ArbitrumContractTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      '0x66',
      ethers.utils.RLP.encode([
        formatNumber(chainId),
        msgNum,
        fromAddress,
        formatNumber(maxFeePerGas),
        formatNumber(gasLimit),
        destAddress,
        formatNumber(l1Value),
        data,
      ]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }
  /**
   * ArbitrumRetryTxType has type 0x68.
   * @param type //type of the tx
   * @param l2ChainId
   * @param nonce
   * @param messageNumber
   * @param fromAddress
   * @param maxFeePerGas
   * @param gasLimit
   * @param destAddress
   * @param l1Value
   * @param data
   * @param ticketId
   * @param refundAddress
   * @returns
   */
  public static calculateArbitrumRetryTxHash(
    type: number,
    l2ChainId: number,
    nonce: number,
    messageNumber: BigNumber,
    fromAddress: string,
    maxFeePerGas: BigNumber,
    gasLimit: BigNumber,
    destAddress: string,
    l1Value: BigNumber,
    data: string,
    ticketID: string,
    maxRefund: BigNumber,
    submissionFeeRefund: BigNumber
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 104) {
      throw new ArbSdkError(`This is not an ArbitrumRetryTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const senderNonce = BigNumber.from(nonce)
    const msgNum = BigNumber.from(messageNumber)
    const ticketId = BigNumber.from(ticketID)
    const rlpEnc = ethers.utils.hexConcat([
      '0x68',
      ethers.utils.RLP.encode([
        formatNumber(chainId),
        senderNonce,
        msgNum,
        fromAddress,
        formatNumber(maxFeePerGas),
        formatNumber(gasLimit),
        destAddress,
        formatNumber(l1Value),
        data,
        ticketId,
        maxRefund,
        submissionFeeRefund,
      ]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }

  /**
   * ArbitrumSubmitRetryableTx has type 0x69.
   * @param type //type of the tx
   * @param l2ChainId
   * @param fromAddress the aliased address that called the L1 inbox as emitted in the bridge event.
   * @param messageNumber
   * @param l1BaseFee
   * @param destAddress
   * @param l2CallValue
   * @param l1Value
   * @param maxSubmissionFee
   * @param excessFeeRefundAddress refund address specified in the retryable creation. Note the L1 inbox aliases this address if it is a L1 smart contract. The user is expected to provide this value already aliased when needed.
   * @param callValueRefundAddress refund address specified in the retryable creation. Note the L1 inbox aliases this address if it is a L1 smart contract. The user is expected to provide this value already aliased when needed.
   * @param gasLimit
   * @param maxFeePerGas
   * @param data
   * @returns
   */
  public static calculateArbitrumSubmitRetryableTxHash(
    type: number,
    l2ChainId: number,
    fromAddress: string,
    messageNumber: BigNumber,
    l1BaseFee: BigNumber,
    destAddress: string,
    l2CallValue: BigNumber,
    l1Value: BigNumber,
    maxSubmissionFee: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    gasLimit: BigNumber,
    maxFeePerGas: BigNumber,
    data: string
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 105) {
      throw new ArbSdkError(`This is not an ArbitrumSubmitRetryableTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const msgNum = BigNumber.from(messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      '0x69',
      ethers.utils.RLP.encode([
        formatNumber(chainId),
        zeroPad(formatNumber(msgNum), 32),
        fromAddress,
        formatNumber(l1BaseFee),
        formatNumber(l1Value),
        formatNumber(maxFeePerGas),
        formatNumber(gasLimit),
        destAddress,
        formatNumber(l2CallValue),
        callValueRefundAddress,
        formatNumber(maxSubmissionFee),
        excessFeeRefundAddress,
        data,
      ]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }

  /**
   * ArbitrumInternalTx has type 0x6A.
   * @param type //type of the tx
   * @param l2ChainId
   * @param data
   * @returns
   */
  public static calculateArbitrumInternalTxHash(
    type: number,
    l2ChainId: number,
    data: string
  ): string {
    const formatNumber = (value: BigNumber): Uint8Array => {
      return ethers.utils.stripZeros(value.toHexString())
    }

    if (type != 106) {
      throw new ArbSdkError(`This is not an ArbitrumSubmitRetryableTx type`)
    }

    const chainId = BigNumber.from(l2ChainId)
    const rlpEnc = ethers.utils.hexConcat([
      '0x6A',
      ethers.utils.RLP.encode([formatNumber(chainId), data]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }
}
