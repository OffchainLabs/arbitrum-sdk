/**
 * Pure functions for computing cross-chain message IDs.
 *
 * - calculateSubmitRetryableId: computes the retryable ticket creation ID
 * - calculateDepositTxId: computes the ETH deposit transaction ID
 *
 * Both use RLP encoding + keccak256, matching the go-ethereum implementation.
 */
import { rlpEncode, type RlpInput } from '../encoding/rlp'
import { keccak256 } from '../encoding/keccak'
import { concat } from '../encoding/hex'
import { getAddress } from '../encoding/address'

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

/**
 * Format a bigint as a hex string with no unnecessary leading zeros.
 * Returns '0x' for zero values (empty byte string in RLP terms).
 */
function formatNumber(value: bigint): string {
  if (value === 0n) return '0x'
  const hex = value.toString(16)
  // Ensure even-length hex
  const padded = hex.length % 2 === 0 ? hex : '0' + hex
  return '0x' + padded
}

/**
 * Zero-pad a hex value to exactly `byteLength` bytes.
 */
function zeroPadHex(hex: string, byteLength: number): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  return '0x' + stripped.padStart(byteLength * 2, '0')
}

export interface SubmitRetryableIdParams {
  /** Child chain ID */
  chainId: number
  /** Sender address on parent chain (with alias applied) */
  fromAddress: string
  /** Sequential message number */
  messageNumber: bigint
  /** Parent chain base fee */
  baseFee: bigint
  /** Destination address on child chain */
  destAddress: string
  /** Call value on child chain */
  l2CallValue: bigint
  /** Value sent on parent chain */
  l1Value: bigint
  /** Max submission fee */
  maxSubmissionFee: bigint
  /** Address to refund excess fee */
  excessFeeRefundAddress: string
  /** Address to refund call value */
  callValueRefundAddress: string
  /** Gas limit for child chain execution */
  gasLimit: bigint
  /** Max fee per gas for child chain execution */
  maxFeePerGas: bigint
  /** Calldata for child chain message */
  data: string
}

/**
 * Calculate the retryable ticket creation ID (transaction hash on child chain).
 *
 * The algorithm:
 * 1. Build an RLP-encodable list of fields in a specific order
 * 2. RLP encode the list
 * 3. Prepend transaction type byte 0x69
 * 4. Keccak256 hash the result
 *
 * Reference: go-ethereum ArbitrumSubmitRetryableTx type
 */
export function calculateSubmitRetryableId(
  params: SubmitRetryableIdParams
): string {
  const fields: RlpInput[] = [
    formatNumber(BigInt(params.chainId)),
    zeroPadHex(formatNumber(params.messageNumber), 32),
    params.fromAddress,
    formatNumber(params.baseFee),
    formatNumber(params.l1Value),
    formatNumber(params.maxFeePerGas),
    formatNumber(params.gasLimit),
    // when destAddress is 0x0, arbos treats that as nil
    params.destAddress.toLowerCase() === ADDRESS_ZERO
      ? '0x'
      : params.destAddress,
    formatNumber(params.l2CallValue),
    params.callValueRefundAddress,
    formatNumber(params.maxSubmissionFee),
    params.excessFeeRefundAddress,
    params.data,
  ]

  // Arbitrum submit retry transactions have type 0x69
  const rlpEncoded = rlpEncode(fields)
  const withType = concat(['0x69', rlpEncoded])

  return keccak256(withType)
}

export interface DepositTxIdParams {
  /** Child chain ID */
  chainId: number
  /** Sequential message number */
  messageNumber: bigint
  /** Sender address */
  fromAddress: string
  /** Recipient address */
  toAddress: string
  /** ETH value */
  value: bigint
}

/**
 * Calculate the ETH deposit transaction ID (transaction hash on child chain).
 *
 * The algorithm:
 * 1. Build an RLP-encodable list of fields
 * 2. RLP encode the list
 * 3. Prepend transaction type byte 0x64
 * 4. Keccak256 hash the result
 *
 * Reference: go-ethereum ArbitrumDepositTx type
 * https://github.com/OffchainLabs/go-ethereum/blob/07e017aa73e32be92aadb52fa327c552e1b7b118/core/types/arb_types.go#L302-L308
 */
export function calculateDepositTxId(params: DepositTxIdParams): string {
  const fields: RlpInput[] = [
    formatNumber(BigInt(params.chainId)),
    zeroPadHex(formatNumber(params.messageNumber), 32),
    getAddress(params.fromAddress),
    getAddress(params.toAddress),
    formatNumber(params.value),
  ]

  // Arbitrum ETH deposit transactions have type 0x64
  const rlpEncoded = rlpEncode(fields)
  const withType = concat(['0x64', rlpEncoded])

  return keccak256(withType)
}
