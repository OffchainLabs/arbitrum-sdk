/**
 * ERC-20 bridger functions for ethers v5 users.
 *
 * Functions that require a provider accept ethers v5 Provider and wrap it
 * internally. Functions that don't need a provider are re-exported directly.
 */
import type { providers } from 'ethers'
import {
  getApproveTokenRequest as coreGetApproveTokenRequest,
  getErc20DepositRequest as coreGetErc20DepositRequest,
  getParentGatewayAddress as coreGetParentGatewayAddress,
  getChildGatewayAddress as coreGetChildGatewayAddress,
  getChildErc20Address as coreGetChildErc20Address,
  getParentErc20Address as coreGetParentErc20Address,
  type ArbitrumNetwork,
  type TransactionRequestData,
  type GasOverrides,
  type GasEstimateResult,
} from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

// ---------------------------------------------------------------------------
// Re-export withdrawal (no provider needed)
// ---------------------------------------------------------------------------

export { getErc20WithdrawalRequest } from '@arbitrum/core'
export type { GetErc20WithdrawalRequestParams } from '@arbitrum/core'

// ---------------------------------------------------------------------------
// Wrapper types with ethers v5 Provider
// ---------------------------------------------------------------------------

export interface GetApproveTokenRequestParams {
  network: ArbitrumNetwork
  erc20ParentAddress: string
  from: string
  parentProvider: providers.Provider
  amount?: bigint
}

export interface GetErc20DepositRequestParams {
  network: ArbitrumNetwork
  erc20ParentAddress: string
  amount: bigint
  from: string
  destinationAddress?: string
  parentProvider: providers.Provider
  childProvider: providers.Provider
  excessFeeRefundAddress?: string
  callValueRefundAddress?: string
  retryableGasOverrides?: GasOverrides
}

// ---------------------------------------------------------------------------
// Wrapped functions
// ---------------------------------------------------------------------------

/**
 * Build a transaction request to approve an ERC-20 token for deposit.
 * Accepts ethers v5 Provider.
 */
export async function getApproveTokenRequest(
  params: GetApproveTokenRequestParams
): Promise<TransactionRequestData> {
  return coreGetApproveTokenRequest({
    ...params,
    parentProvider: wrapProvider(params.parentProvider as unknown as Ethers5Provider),
  })
}

/**
 * Build a transaction request to deposit ERC-20 tokens.
 * Accepts ethers v5 Providers for both parent and child chains.
 */
export async function getErc20DepositRequest(
  params: GetErc20DepositRequestParams
): Promise<TransactionRequestData & { gasEstimates: GasEstimateResult }> {
  return coreGetErc20DepositRequest({
    ...params,
    parentProvider: wrapProvider(params.parentProvider as unknown as Ethers5Provider),
    childProvider: wrapProvider(params.childProvider as unknown as Ethers5Provider),
  })
}

/**
 * Get the parent gateway address for a given ERC-20 token.
 * Accepts ethers v5 Provider.
 */
export async function getParentGatewayAddress(
  erc20ParentAddress: string,
  parentProvider: providers.Provider,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetParentGatewayAddress(
    erc20ParentAddress,
    wrapProvider(parentProvider as unknown as Ethers5Provider),
    network
  )
}

/**
 * Get the child gateway address for a given ERC-20 token.
 * Accepts ethers v5 Provider.
 */
export async function getChildGatewayAddress(
  erc20ParentAddress: string,
  childProvider: providers.Provider,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetChildGatewayAddress(
    erc20ParentAddress,
    wrapProvider(childProvider as unknown as Ethers5Provider),
    network
  )
}

/**
 * Get the child chain ERC-20 address for a given parent chain token.
 * Accepts ethers v5 Provider.
 */
export async function getChildErc20Address(
  erc20ParentAddress: string,
  parentProvider: providers.Provider,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetChildErc20Address(
    erc20ParentAddress,
    wrapProvider(parentProvider as unknown as Ethers5Provider),
    network
  )
}

/**
 * Get the parent chain ERC-20 address for a given child chain token.
 * Accepts ethers v5 Provider.
 */
export async function getParentErc20Address(
  erc20ChildAddress: string,
  childProvider: providers.Provider,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetParentErc20Address(
    erc20ChildAddress,
    wrapProvider(childProvider as unknown as Ethers5Provider),
    network
  )
}
