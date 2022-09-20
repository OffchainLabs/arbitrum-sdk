import { ethers } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { zeroPad } from '@ethersproject/bytes'

enum ArbTxType {
  Deposit = 100,
  Unsigned = 101,
  Contract = 102,
  Retry = 104,
  SubmitRetryable = 105,
  Internal = 106,
}

interface DepositTx {
  type: ArbTxType.Deposit
  l2ChainId: number
  fromAddress: string
  messageNumber: BigNumber
  destAddress: string
  l1Value: BigNumber
}

interface UnsignedTx {
  type: ArbTxType.Unsigned
  l2ChainId: number
  fromAddress: string
  nonce: number
  maxFeePerGas: BigNumber
  gasLimit: BigNumber
  destAddress: string
  l1Value: BigNumber
  data: string
}

interface ContractTx {
  type: ArbTxType.Contract
  l2ChainId: number
  messageNumber: BigNumber
  fromAddress: string
  maxFeePerGas: BigNumber
  gasLimit: BigNumber
  destAddress: string
  l1Value: BigNumber
  data: string
}

interface RetryTx {
  type: ArbTxType.Retry
  l2ChainId: number
  nonce: number
  messageNumber: BigNumber
  fromAddress: string
  maxFeePerGas: BigNumber
  gasLimit: BigNumber
  destAddress: string
  l1Value: BigNumber
  data: string
  ticketID: string
  maxRefund: BigNumber
  submissionFeeRefund: BigNumber
}

interface SubmitRetryableTx {
  type: ArbTxType.SubmitRetryable
  l2ChainId: number
  fromAddress: string
  messageNumber: BigNumber
  l1BaseFee: BigNumber
  destAddress: string
  l2CallValue: BigNumber
  l1Value: BigNumber
  maxSubmissionFee: BigNumber
  excessFeeRefundAddress: string
  callValueRefundAddress: string
  gasLimit: BigNumber
  maxFeePerGas: BigNumber
  data: string
}

interface InternalTx {
  type: ArbTxType.Internal
  l2ChainId: number
  data: string
}

export class ArbTxHasher {
  /**
   * Parse the input data into Uint8Array format
   * @param BigNumber
   * @returns input value formatted into Uint8Array
   */
  private static formatNumber(value: BigNumber): Uint8Array {
    return ethers.utils.stripZeros(value.toHexString())
  }

  private static arbTxTypeToHex(txType: ArbTxType) {
    switch (txType) {
      case ArbTxType.Deposit:
        return '0x64'
      case ArbTxType.Unsigned:
        return '0x65'
      case ArbTxType.Contract:
        return '0x66'
      case ArbTxType.Retry:
        return '0x68'
      case ArbTxType.SubmitRetryable:
        return '0x69'
      case ArbTxType.Internal:
        return '0x6A'
    }
  }

  public static hash(
    tx:
      | DepositTx
      | UnsignedTx
      | ContractTx
      | RetryTx
      | SubmitRetryableTx
      | InternalTx
  ) {
    switch (tx.type) {
      case ArbTxType.Deposit:
        this.hashDepositTx(tx)
        break
      case ArbTxType.Unsigned:
        this.hashUnsignedTx(tx)
        break
      case ArbTxType.Contract:
        this.hashContractTx(tx)
        break
      case ArbTxType.Retry:
        this.hashRetryTx(tx)
        break
      case ArbTxType.SubmitRetryable:
        this.hashSubmitRetryableTx(tx)
        break
      case ArbTxType.Internal:
        this.hashInternalTx(tx)
        break
    }
  }

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
  private static hashDepositTx(tx: DepositTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const msgNum = BigNumber.from(tx.messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Deposit),
      ethers.utils.RLP.encode([
        this.formatNumber(chainId),
        zeroPad(this.formatNumber(msgNum), 32),
        tx.fromAddress,
        tx.destAddress,
        this.formatNumber(tx.l1Value),
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
  public static hashUnsignedTx(tx: UnsignedTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const senderNonce = BigNumber.from(tx.nonce)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Unsigned),
      ethers.utils.RLP.encode([
        this.formatNumber(chainId),
        tx.fromAddress,
        senderNonce,
        this.formatNumber(tx.maxFeePerGas),
        this.formatNumber(tx.gasLimit),
        tx.destAddress,
        this.formatNumber(tx.l1Value),
        tx.data,
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
  public static hashContractTx(tx: ContractTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const msgNum = BigNumber.from(tx.messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Contract),
      ethers.utils.RLP.encode([
        this.formatNumber(chainId),
        msgNum,
        tx.fromAddress,
        this.formatNumber(tx.maxFeePerGas),
        this.formatNumber(tx.gasLimit),
        tx.destAddress,
        this.formatNumber(tx.l1Value),
        tx.data,
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
  public static hashRetryTx(tx: RetryTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const senderNonce = BigNumber.from(tx.nonce)
    const msgNum = BigNumber.from(tx.messageNumber)
    const ticketId = BigNumber.from(tx.ticketID)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Retry),
      ethers.utils.RLP.encode([
        this.formatNumber(chainId),
        senderNonce,
        msgNum,
        tx.fromAddress,
        this.formatNumber(tx.maxFeePerGas),
        this.formatNumber(tx.gasLimit),
        tx.destAddress,
        this.formatNumber(tx.l1Value),
        tx.data,
        ticketId,
        tx.maxRefund,
        tx.submissionFeeRefund,
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
  public static hashSubmitRetryableTx(tx: SubmitRetryableTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const msgNum = BigNumber.from(tx.messageNumber)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.SubmitRetryable),
      ethers.utils.RLP.encode([
        this.formatNumber(chainId),
        zeroPad(this.formatNumber(msgNum), 32),
        tx.fromAddress,
        this.formatNumber(tx.l1BaseFee),
        this.formatNumber(tx.l1Value),
        this.formatNumber(tx.maxFeePerGas),
        this.formatNumber(tx.gasLimit),
        tx.destAddress,
        this.formatNumber(tx.l2CallValue),
        tx.callValueRefundAddress,
        this.formatNumber(tx.maxSubmissionFee),
        tx.excessFeeRefundAddress,
        tx.data,
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
  public static hashInternalTx(tx: InternalTx): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Internal),
      ethers.utils.RLP.encode([this.formatNumber(chainId), tx.data]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }
}
