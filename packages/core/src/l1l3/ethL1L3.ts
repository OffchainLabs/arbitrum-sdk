/**
 * ETH L1→L3 deposit functions.
 *
 * Returns TransactionRequestData for depositing ETH from L1 to L3
 * via a double retryable ticket (L1→L2→L3). The SDK never signs or sends.
 *
 * Flow:
 * 1. Build the inner L2→L3 retryable ticket request
 * 2. Wrap it inside an outer L1→L2 retryable ticket
 * 3. Return the outer request (targets the L2 inbox)
 */
import type { ArbitrumNetwork } from '../networks'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { TransactionRequestData } from '../interfaces/types'
import type { GasOverrides } from '../message/gasEstimator'
import { estimateAll } from '../message/gasEstimator'
import { ArbitrumContract } from '../contracts/Contract'
import { IInboxAbi } from '../abi/IInbox'
import { applyAlias } from '../utils/addressAlias'
import { ArbSdkError } from '../errors'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface GetEthL1L3DepositRequestParams {
  /** The L2 network (parent of L3). */
  l2Network: ArbitrumNetwork
  /** The L3 network. Must use ETH as its native token. */
  l3Network: ArbitrumNetwork
  /** Amount of ETH to deposit (wei). */
  amount: bigint
  /** Sender address on L1. */
  from: string
  /** L2 provider. */
  l2Provider: ArbitrumProvider
  /** L3 provider. */
  l3Provider: ArbitrumProvider
  /** Destination address on L3. Defaults to `from`. */
  destinationAddress?: string
  /** Fee refund address on L2. Defaults to `from`. */
  l2RefundAddress?: string
  /** Gas overrides for the L1→L2 retryable. */
  l2TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
  /** Gas overrides for the L2→L3 retryable. */
  l3TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
}

// ────────────────────────────────────────────────────────────────────────────
// Implementation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a transaction request to deposit ETH from L1 to L3 via double retryable.
 *
 * Creates a nested retryable ticket:
 * - Outer ticket: L1→L2, calls createRetryableTicket on L3's inbox
 * - Inner ticket: L2→L3, deposits ETH to the destination
 *
 * The outer ticket targets the L2 network's inbox (the L1→L2 inbox).
 */
export async function getEthL1L3DepositRequest(
  params: GetEthL1L3DepositRequestParams
): Promise<TransactionRequestData> {
  const {
    l2Network,
    l3Network,
    amount,
    from,
    l2Provider,
    l3Provider,
  } = params

  if (
    l3Network.nativeToken &&
    l3Network.nativeToken !== '0x0000000000000000000000000000000000000000'
  ) {
    throw new ArbSdkError(
      `L3 network ${l3Network.name} uses a custom fee token. Use ERC-20 teleporter instead.`
    )
  }

  const destinationAddress = params.destinationAddress ?? from
  const l2RefundAddress = params.l2RefundAddress ?? from

  // The L1→L2 msg sender on L2 is the aliased L1 sender address
  const aliasedFrom = applyAlias(from)

  // Step 1: Estimate gas for the INNER L2→L3 retryable ticket
  const l3Estimates = await estimateAll(
    l2Provider,  // L2 is the "parent" for L2→L3
    l3Provider,  // L3 is the "child"
    l3Network,
    {
      from: aliasedFrom,
      to: destinationAddress,
      l2CallValue: amount,
      excessFeeRefundAddress: destinationAddress,
      callValueRefundAddress: destinationAddress,
      data: '0x',
    },
    params.l3TicketGasOverrides
  )

  // Step 2: Encode the inner retryable ticket creation call
  // This is a call to createRetryableTicket on the L3's inbox (which lives on L2)
  const l3Inbox = new ArbitrumContract(IInboxAbi, l3Network.ethBridge.inbox)
  const innerCalldata = l3Inbox.encodeFunctionData('createRetryableTicket', [
    destinationAddress,            // to
    amount,                        // l2CallValue (ETH to send to L3 dest)
    l3Estimates.maxSubmissionCost,  // maxSubmissionCost
    destinationAddress,            // excessFeeRefundAddress
    destinationAddress,            // callValueRefundAddress
    l3Estimates.gasLimit,          // gasLimit
    l3Estimates.maxFeePerGas,      // maxFeePerGas
    '0x',                          // data
  ])

  // The total value the inner ticket needs on L2
  const innerValue = l3Estimates.deposit

  // Step 3: Estimate gas for the OUTER L1→L2 retryable ticket
  const l2Estimates = await estimateAll(
    l2Provider,  // L2's inbox lives on L1, but we need L2 gas estimates
    l2Provider,  // Using L2 provider for gas estimation
    l2Network,
    {
      from,
      to: l3Network.ethBridge.inbox, // The outer retryable targets the L3 inbox on L2
      l2CallValue: innerValue,        // Carry enough value for the inner ticket
      excessFeeRefundAddress: l2RefundAddress,
      callValueRefundAddress: l2RefundAddress,
      data: innerCalldata,
    },
    params.l2TicketGasOverrides
  )

  // Step 4: Encode the outer retryable ticket creation
  const l2Inbox = new ArbitrumContract(IInboxAbi, l2Network.ethBridge.inbox)
  const outerCalldata = l2Inbox.encodeFunctionData('createRetryableTicket', [
    l3Network.ethBridge.inbox,     // to (L3 inbox on L2)
    innerValue,                    // l2CallValue
    l2Estimates.maxSubmissionCost, // maxSubmissionCost
    l2RefundAddress,               // excessFeeRefundAddress
    l2RefundAddress,               // callValueRefundAddress
    l2Estimates.gasLimit,          // gasLimit
    l2Estimates.maxFeePerGas,      // maxFeePerGas
    innerCalldata,                 // data
  ])

  // Total value = outer deposit (gas + submission + inner value)
  const totalValue = l2Estimates.deposit

  return {
    to: l2Network.ethBridge.inbox,
    data: outerCalldata,
    value: totalValue,
    from,
  }
}
