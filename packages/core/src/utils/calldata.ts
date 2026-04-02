/**
 * Calldata decode utility for ERC-20 deposit transactions.
 *
 * Extracts the parent chain token address from outboundTransfer or
 * outboundTransferCustomRefund calldata.
 */
import type { TransactionRequestData } from '../interfaces/types'
import { getFunctionSelector } from '../encoding/abi'

/**
 * ABI for the outboundTransfer function selector.
 */
const outboundTransferAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransfer',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

/**
 * ABI for the outboundTransferCustomRefund function selector.
 */
const outboundTransferCustomRefundAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransferCustomRefund',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_refundTo', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

// Pre-compute selectors
const OUTBOUND_TRANSFER_SELECTOR = getFunctionSelector(
  outboundTransferAbi,
  'outboundTransfer'
)
const OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR = getFunctionSelector(
  outboundTransferCustomRefundAbi,
  'outboundTransferCustomRefund'
)

/**
 * Extract the ERC-20 parent chain token address from a deposit transaction request.
 *
 * Works with both `outboundTransfer` and `outboundTransferCustomRefund` calldata.
 * The token address is always the first parameter in both function signatures.
 *
 * @param txRequest - The transaction request containing the deposit calldata
 * @returns The parent chain ERC-20 token address
 * @throws If the calldata does not match either deposit method signature
 */
export function getErc20ParentAddressFromParentToChildTxRequest(
  txRequest: Pick<TransactionRequestData, 'data'>
): string {
  const { data } = txRequest

  if (!data || data.length < 10) {
    throw new Error('data signature not matching deposit methods')
  }

  const selector = data.slice(0, 10)

  // Both outboundTransfer and outboundTransferCustomRefund have the token
  // address as the first parameter. The first ABI-encoded word after the
  // 4-byte selector is the address (right-padded in a 32-byte word).
  if (
    selector === OUTBOUND_TRANSFER_SELECTOR ||
    selector === OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR
  ) {
    // Extract the first 32-byte word after the selector
    const addressWord = data.slice(10, 10 + 64)
    // Address is the last 40 hex chars of the 64-char word
    return '0x' + addressWord.slice(24)
  }

  throw new Error('data signature not matching deposit methods')
}
