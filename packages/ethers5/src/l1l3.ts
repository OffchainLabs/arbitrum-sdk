/**
 * L1→L3 teleportation functions for ethers v5 users.
 *
 * Functions that require a provider accept ethers v5 Provider and wrap it
 * internally. Pure functions are re-exported directly from core.
 */
import type { providers } from 'ethers'
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
import { wrapProvider, type Ethers5Provider } from './adapter'

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
// Wrapper types with ethers v5 Provider
// ---------------------------------------------------------------------------

export interface GetEthL1L3DepositRequestParams {
  l2Network: ArbitrumNetwork
  l3Network: ArbitrumNetwork
  amount: bigint
  from: string
  l2Provider: providers.Provider
  l3Provider: providers.Provider
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
  l1Provider: providers.Provider
  l2Provider: providers.Provider
  l3Provider: providers.Provider
  destinationAddress?: string
  gasParams: TeleporterRetryableGasParams
  l3FeeTokenL1Addr?: string
}

export interface PredictL2ForwarderAddressParams {
  l2Network: ArbitrumNetwork
  owner: string
  routerOrInbox: string
  destinationAddress: string
  l2Provider?: providers.Provider
  l1Provider?: providers.Provider
}

// ---------------------------------------------------------------------------
// Wrapped functions
// ---------------------------------------------------------------------------

/**
 * Build a transaction request to deposit ETH from L1 to L3 via double retryable.
 * Accepts ethers v5 Providers.
 */
export async function getEthL1L3DepositRequest(
  params: GetEthL1L3DepositRequestParams
): Promise<TransactionRequestData> {
  return coreGetEthL1L3DepositRequest({
    ...params,
    l2Provider: wrapProvider(params.l2Provider as unknown as Ethers5Provider),
    l3Provider: wrapProvider(params.l3Provider as unknown as Ethers5Provider),
  })
}

/**
 * Build a transaction request for teleporting ERC-20 tokens from L1 to L3.
 * Accepts ethers v5 Providers.
 */
export async function getErc20L1L3DepositRequest(
  params: GetErc20L1L3DepositRequestParams
): Promise<Erc20L1L3DepositRequestResult> {
  return coreGetErc20L1L3DepositRequest({
    ...params,
    l1Provider: wrapProvider(params.l1Provider as unknown as Ethers5Provider),
    l2Provider: wrapProvider(params.l2Provider as unknown as Ethers5Provider),
    l3Provider: wrapProvider(params.l3Provider as unknown as Ethers5Provider),
  })
}

/**
 * Predict the L2 forwarder contract address.
 * Accepts ethers v5 Providers.
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
    coreParams.l2Provider = wrapProvider(
      params.l2Provider as unknown as Ethers5Provider
    )
  }
  if (params.l1Provider) {
    coreParams.l1Provider = wrapProvider(
      params.l1Provider as unknown as Ethers5Provider
    )
  }
  return corePredictL2ForwarderAddress(coreParams)
}
