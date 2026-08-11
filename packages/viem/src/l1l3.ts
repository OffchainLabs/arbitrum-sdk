/**
 * L1→L3 teleportation functions for viem users.
 *
 * Functions that require a provider accept viem PublicClient and wrap it
 * internally. Pure functions are re-exported directly from core.
 */
import {
  getEthL1L3DepositRequest as coreGetEthL1L3DepositRequest,
  getErc20L1L3DepositRequest as coreGetErc20L1L3DepositRequest,
  getErc20L1L3ApproveTokenRequest,
  getErc20L1L3ApproveGasTokenRequest,
  predictL2ForwarderAddress as corePredictL2ForwarderAddress,
} from '@arbitrum/core'
import type {
  ArbitrumNetwork,
  TransactionRequestData,
  GasOverrides,
  GetErc20L1L3ApproveTokenRequestParams,
  GetErc20L1L3ApproveGasTokenRequestParams,
  TeleporterRetryableGasParams,
  Erc20L1L3DepositRequestResult,
  PredictL2ForwarderAddressParams as CorePredictL2ForwarderAddressParams,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
} from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

// ---------------------------------------------------------------------------
// Re-export pure functions (no provider needed)
// ---------------------------------------------------------------------------

export { getErc20L1L3ApproveTokenRequest, getErc20L1L3ApproveGasTokenRequest }

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type {
  GetErc20L1L3ApproveTokenRequestParams,
  GetErc20L1L3ApproveGasTokenRequestParams,
  TeleporterRetryableGasParams,
  Erc20L1L3DepositRequestResult,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
}

// ---------------------------------------------------------------------------
// Wrapper types with viem PublicClient
// ---------------------------------------------------------------------------

export interface GetEthL1L3DepositRequestParams {
  l2Network: ArbitrumNetwork
  l3Network: ArbitrumNetwork
  amount: bigint
  from: string
  l2Provider: ViemPublicClient
  l3Provider: ViemPublicClient
  destinationAddress?: string
  l2RefundAddress?: string
  l2TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
  l3TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
}

export interface GetErc20L1L3DepositRequestParams {
  l2Network: ArbitrumNetwork
  l3Network: ArbitrumNetwork
  erc20L1Address: string
  amount: bigint
  from: string
  l1Provider: ViemPublicClient
  l2Provider: ViemPublicClient
  l3Provider: ViemPublicClient
  destinationAddress?: string
  gasParams: TeleporterRetryableGasParams
  l3FeeTokenL1Addr?: string
}

export interface PredictL2ForwarderAddressParams {
  l2Network: ArbitrumNetwork
  owner: string
  routerOrInbox: string
  destinationAddress: string
  l2Provider?: ViemPublicClient
  l1Provider?: ViemPublicClient
}

// ---------------------------------------------------------------------------
// Wrapped functions
// ---------------------------------------------------------------------------

/**
 * Build a transaction request to deposit ETH from L1 to L3 via double retryable.
 * Accepts viem PublicClients.
 */
export async function getEthL1L3DepositRequest(
  params: GetEthL1L3DepositRequestParams
): Promise<TransactionRequestData> {
  return coreGetEthL1L3DepositRequest({
    ...params,
    l2Provider: wrapPublicClient(params.l2Provider),
    l3Provider: wrapPublicClient(params.l3Provider),
  })
}

/**
 * Build a transaction request for teleporting ERC-20 tokens from L1 to L3.
 * Accepts viem PublicClients.
 */
export async function getErc20L1L3DepositRequest(
  params: GetErc20L1L3DepositRequestParams
): Promise<Erc20L1L3DepositRequestResult> {
  return coreGetErc20L1L3DepositRequest({
    ...params,
    l1Provider: wrapPublicClient(params.l1Provider),
    l2Provider: wrapPublicClient(params.l2Provider),
    l3Provider: wrapPublicClient(params.l3Provider),
  })
}

/**
 * Predict the L2 forwarder contract address.
 * Accepts viem PublicClients.
 */
export async function predictL2ForwarderAddress(
  params: PredictL2ForwarderAddressParams
): Promise<string> {
  const coreParams: CorePredictL2ForwarderAddressParams = {
    l2Network: params.l2Network,
    owner: params.owner,
    routerOrInbox: params.routerOrInbox,
    destinationAddress: params.destinationAddress,
  }
  if (params.l2Provider) {
    coreParams.l2Provider = wrapPublicClient(params.l2Provider)
  }
  if (params.l1Provider) {
    coreParams.l1Provider = wrapPublicClient(params.l1Provider)
  }
  return corePredictL2ForwarderAddress(coreParams)
}
