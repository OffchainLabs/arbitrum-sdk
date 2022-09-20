import { ethers } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { zeroPad } from '@ethersproject/bytes'

/**
 * Creating an ArbTxType enum for different Arbitrum specific tx types.
 */
enum ArbTxType {
  Deposit = 100,
  Unsigned = 101,
  Contract = 102,
  Retry = 104,
  SubmitRetryable = 105,
  Internal = 106,
}

/**
 * Creating an interface for each Arbitrum specific tx type.
 */
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
   * @returns Uint8Array
   */
  private static formatNumber(value: BigNumber): Uint8Array {
    return ethers.utils.stripZeros(value.toHexString())
  }

  /**
   * Return the hex encoding of Arbitrum specific tx types.
   * @param ArbTxType
   * @returns Hex encoding of ArbTxType
   */
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

  /**
   * Accept the Arbitrum specific tx type and call the right function for creating the custom hash.
   * @param ArbTxType
   * @returns
   */
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
   * Accept ArbTxType.Deposit and return its custom hash.
   * @param DepositTx
   * @returns Custom hash for Deposit tx
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
   * Accept ArbTxType.UnsignedTx and return its custom hash.
   * @param UnsignedTx
   * @returns Custom hash for Unsigned tx
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
   * Accept ArbTxType.ContractTx and return its custom hash.
   * @param ContractTx
   * @returns Custom hash for Contract tx
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
   * Accept ArbTxType.RetryTx and return its custom hash.
   * @param RetryTx
   * @returns Custom hash for Retry tx
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
   * Accept ArbTxType.SubmitRetryableTx and return its custom hash.
   * @param SubmitRetryableTx
   * @returns Custom hash for SubmitRetryable tx
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
   * Accept ArbTxType.InternalTx and return its custom hash.
   * @param InternalTx
   * @returns Custom hash for Internal tx
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
