import { ethers } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'
import { zeroPad } from '@ethersproject/bytes'

/**
 * Creating an ArbTxType enum for different Arbitrum specific tx types.
 */
export enum ArbTxType {
  Deposit = 100,
  Unsigned = 101,
  Contract = 102,
  Retry = 104,
  SubmitRetryable = 105,
  Internal = 106,
}

interface Transaction {
  type: number
  l2ChainId: number
  fromAddress: string
  messageNumber: BigNumber
  destAddress: string
  l1Value: BigNumber
  nonce: number
  maxFeePerGas: BigNumber
  gasLimit: BigNumber
  data: string
  ticketID: string
  maxRefund: BigNumber
  submissionFeeRefund: BigNumber
  l1BaseFee: BigNumber
  l2CallValue: BigNumber
  maxSubmissionFee: BigNumber
  excessFeeRefundAddress: string
  callValueRefundAddress: string
}

// Function returning never must have unreachable end point
function error(message: string): never {
  throw new Error(message)
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
    return `0x${txType.toString(16)}`
  }

  /**
   * Accept the Arbitrum specific tx type and call the right function for creating the custom hash.
   * @param Transaction
   * @returns
   */
  public static hash(tx: Transaction): string {
    switch (tx.type) {
      case ArbTxType.Deposit:
        return this.hashDepositTx(tx)

      case ArbTxType.Unsigned:
        return this.hashUnsignedTx(tx)

      case ArbTxType.Contract:
        return this.hashContractTx(tx)

      case ArbTxType.Retry:
        return this.hashRetryTx(tx)

      case ArbTxType.SubmitRetryable:
        return this.hashSubmitRetryableTx(tx)

      case ArbTxType.Internal:
        return this.hashInternalTx(tx)
    }
    return error('Not an Arb transactiion type!')
  }

  /**
   * Accept ArbitrumDepositTx and return its hash.
   * ArbitrumDepositTx is Arb-specific transaction type that represents a user deposit from L1 to L2.
   * This increases the user's balance by the amount deposited on L1.
   * @param ArbitrumDepositTx
   * @returns Custom hash for the tx
   */
  private static hashDepositTx(tx: Transaction): string {
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
   * Accept ArbitrumUnsignedTx and return its hash.
   * ArbitrumUnsignedTx Provides a mechanism for a user on L1 to message a contract on L2.
   * This uses the bridge for authentication rather than requiring the user's signature.
   * Note, the user's acting address will be remapped on L2 to distinguish them from a normal L2 caller.
   * @param ArbitrumUnsignedTx
   * @returns Custom hash for the tx
   */
  public static hashUnsignedTx(tx: Transaction): string {
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
   * Accept ArbitrumContractTx  and return its hash.
   * ArbitrumContractTx  is like an ArbitrumUnsignedTx but is intended for smart contracts.
   * This uses the bridge's unique, sequential nonce rather than requiring the caller specify their own.
   * An L1 contract may still use an ArbitrumUnsignedTx, but doing so may necessitate tracking the nonce in L1 state.
   * @param ArbitrumContractTx
   * @returns Custom hash for the tx
   */
  public static hashContractTx(tx: Transaction): string {
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
   * Accept ArbitrumRetryTx and return its hash.
   * These txs are scheduled by calls to the 'redeem' precompile method and via retryable auto-redemption.
   * @param ArbitrumRetryTx
   * @returns Custom hash for the tx
   */
  public static hashRetryTx(tx: Transaction): string {
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
   * Accept ArbitrumSubmitRetryableTx and return its hash.
   * Represents a retryable submission and may schedule an ArbitrumRetryTx if provided enough gas.
   * @param ArbitrumSubmitRetryableTx
   * @returns Custom hash for the tx
   */
  public static hashSubmitRetryableTx(tx: Transaction): string {
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
   * Accept ArbitrumInternalTx and return its hash.
   * Because tracing support requires ArbOS's state-changes happen inside a transaction, ArbOS may create a tx of this type to update its state in-between user-generated transactions.
   * Such a tx has a Type field signifying the state it will update, though currently this is just future-proofing as there's only one value it may have.
   * @param ArbitrumInternalTx
   * @returns Custom hash for the tx
   */
  public static hashInternalTx(tx: Transaction): string {
    const chainId = BigNumber.from(tx.l2ChainId)
    const rlpEnc = ethers.utils.hexConcat([
      this.arbTxTypeToHex(ArbTxType.Internal),
      ethers.utils.RLP.encode([this.formatNumber(chainId), tx.data]),
    ])
    return ethers.utils.keccak256(rlpEnc)
  }
}
