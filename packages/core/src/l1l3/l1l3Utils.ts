/**
 * L1→L3 utility functions.
 *
 * - predictL2ForwarderAddress: predict the L2 forwarder contract address
 * - getL1L3DepositStatus: read-only status tracking across L1→L2→L3 hops
 */
import { ArbitrumContract } from '../contracts/Contract'
import { IL2ForwarderPredictorAbi } from '../abi/IL2ForwarderPredictor'
import type { ArbitrumNetwork } from '../networks'
import type { ArbitrumProvider } from '../interfaces/provider'
import { ParentToChildMessageStatus } from '../message/types'
import { getAddress } from '../encoding/address'
import { ArbSdkError } from '../errors'

// ────────────────────────────────────────────────────────────────────────────
// L2 Forwarder address prediction
// ────────────────────────────────────────────────────────────────────────────

export interface PredictL2ForwarderAddressParams {
  /** The L2 network that has the teleporter contracts. */
  l2Network: ArbitrumNetwork
  /** Owner address (the aliased teleporter caller on L2). */
  owner: string
  /** The L2→L3 router or inbox address. */
  routerOrInbox: string
  /** The destination address on L3. */
  destinationAddress: string
  /**
   * Provider for the L2 chain.
   * If provided, calls l2ForwarderFactory.l2ForwarderAddress().
   */
  l2Provider?: ArbitrumProvider
  /**
   * Provider for the L1 chain.
   * If provided, calls l1Teleporter.l2ForwarderAddress().
   * Exactly one of l1Provider or l2Provider must be provided.
   */
  l1Provider?: ArbitrumProvider
}

/**
 * Predict the L2 forwarder contract address for a given set of parameters.
 *
 * The L2Forwarder is a deterministic CREATE2-deployed contract, so the same
 * inputs always produce the same address.
 *
 * Can be called against either the L1 teleporter (which also implements
 * IL2ForwarderPredictor) or the L2 forwarder factory.
 */
export async function predictL2ForwarderAddress(
  params: PredictL2ForwarderAddressParams
): Promise<string> {
  const { l2Network, owner, routerOrInbox, destinationAddress, l1Provider, l2Provider } = params

  if (!l2Network.teleporter) {
    throw new ArbSdkError(
      `L2 network ${l2Network.name} does not have teleporter contracts`
    )
  }

  if (!l1Provider && !l2Provider) {
    throw new ArbSdkError('Either l1Provider or l2Provider must be provided')
  }

  // Pick the contract address and provider based on which provider was given.
  // The L1Teleporter also implements IL2ForwarderPredictor.l2ForwarderAddress.
  const contractAddress = l1Provider
    ? l2Network.teleporter.l1Teleporter
    : l2Network.teleporter.l2ForwarderFactory
  const provider = (l1Provider ?? l2Provider)!

  const predictor = new ArbitrumContract(
    IL2ForwarderPredictorAbi,
    contractAddress,
    provider
  )

  const [address] = await predictor.read('l2ForwarderAddress', [
    owner,
    routerOrInbox,
    destinationAddress,
  ])

  return getAddress(address as string)
}

// ────────────────────────────────────────────────────────────────────────────
// Deposit status types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Simplified status for an ETH L1→L3 deposit.
 */
export interface L1L3DepositStatus {
  /** Status of the L1→L2 retryable leg. */
  l1l2Retryable: {
    status: ParentToChildMessageStatus
  }
  /** Status of the L2→L3 retryable leg (only present if L1→L2 redeemed). */
  l2l3Retryable?: {
    status: ParentToChildMessageStatus
  }
  /** Whether the full L1→L3 teleportation has completed. */
  completed: boolean
}

/**
 * Simplified status for an ERC-20 L1→L3 teleportation.
 */
export interface Erc20L1L3DepositStatus {
  /** Status of the L1→L2 token bridge retryable. */
  l1l2TokenBridgeRetryableStatus: ParentToChildMessageStatus
  /** Status of the L1→L2 gas token bridge retryable (only for custom fee token L3s). */
  l1l2GasTokenBridgeRetryableStatus: ParentToChildMessageStatus | undefined
  /** Status of the L2 forwarder factory retryable. */
  l2ForwarderFactoryRetryableStatus: ParentToChildMessageStatus
  /** Status of the L2→L3 token bridge retryable (only if forwarder factory redeemed). */
  l2l3TokenBridgeRetryableStatus: ParentToChildMessageStatus | undefined
  /** Whether the full teleportation has completed. */
  completed: boolean
}
