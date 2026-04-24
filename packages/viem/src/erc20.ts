/**
 * ERC-20 bridging functions with viem-native type signatures.
 *
 * Functions that need a provider accept viem PublicClient and wrap it
 * internally via the adapter.
 */
import {
  getApproveTokenRequest as coreGetApproveTokenRequest,
  getErc20DepositRequest as coreGetErc20DepositRequest,
  getErc20WithdrawalRequest as coreGetErc20WithdrawalRequest,
  getParentGatewayAddress as coreGetParentGatewayAddress,
  getChildGatewayAddress as coreGetChildGatewayAddress,
  getChildErc20Address as coreGetChildErc20Address,
  getParentErc20Address as coreGetParentErc20Address,
} from '@arbitrum/core'
import type {
  GetErc20WithdrawalRequestParams,
  TransactionRequestData,
  ArbitrumNetwork,
  GasOverrides,
  GasEstimateResult,
} from '@arbitrum/core'
import { wrapPublicClient, type ViemPublicClient } from './adapter'

/**
 * Params for getApproveTokenRequest — uses viem PublicClient instead of ArbitrumProvider.
 */
export interface ViemGetApproveTokenRequestParams {
  network: ArbitrumNetwork
  erc20ParentAddress: string
  from: string
  parentProvider: ViemPublicClient
  amount?: bigint
}

/**
 * Params for getErc20DepositRequest — uses viem PublicClient instead of ArbitrumProvider.
 */
export interface ViemGetErc20DepositRequestParams {
  network: ArbitrumNetwork
  erc20ParentAddress: string
  amount: bigint
  from: string
  destinationAddress?: string
  parentProvider: ViemPublicClient
  childProvider: ViemPublicClient
  excessFeeRefundAddress?: string
  callValueRefundAddress?: string
  retryableGasOverrides?: GasOverrides
}

/**
 * Build a transaction request to approve an ERC-20 token for deposit.
 * Accepts a viem PublicClient for gateway resolution.
 */
export async function getApproveTokenRequest(
  params: ViemGetApproveTokenRequestParams
): Promise<TransactionRequestData> {
  return coreGetApproveTokenRequest({
    ...params,
    parentProvider: wrapPublicClient(params.parentProvider),
  })
}

/**
 * Build a transaction request to deposit ERC-20 tokens.
 * Accepts viem PublicClients for both parent and child chains.
 */
export async function getErc20DepositRequest(
  params: ViemGetErc20DepositRequestParams
): Promise<TransactionRequestData & { gasEstimates: GasEstimateResult }> {
  return coreGetErc20DepositRequest({
    ...params,
    parentProvider: wrapPublicClient(params.parentProvider),
    childProvider: wrapPublicClient(params.childProvider),
  })
}

/**
 * Build a transaction request for withdrawing ERC-20 tokens.
 * This is a pure calldata builder — no provider needed.
 */
export function getErc20WithdrawalRequest(
  params: GetErc20WithdrawalRequestParams
): TransactionRequestData {
  return coreGetErc20WithdrawalRequest(params)
}

/**
 * Get the parent gateway address for a given ERC-20 token.
 * Accepts a viem PublicClient.
 */
export async function getParentGatewayAddress(
  erc20ParentAddress: string,
  parentProvider: ViemPublicClient,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetParentGatewayAddress(
    erc20ParentAddress,
    wrapPublicClient(parentProvider),
    network
  )
}

/**
 * Get the child gateway address for a given ERC-20 token.
 * Accepts a viem PublicClient.
 */
export async function getChildGatewayAddress(
  erc20ParentAddress: string,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetChildGatewayAddress(
    erc20ParentAddress,
    wrapPublicClient(childProvider),
    network
  )
}

/**
 * Get the child chain ERC-20 address for a given parent chain token.
 * Accepts a viem PublicClient.
 */
export async function getChildErc20Address(
  erc20ParentAddress: string,
  parentProvider: ViemPublicClient,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetChildErc20Address(
    erc20ParentAddress,
    wrapPublicClient(parentProvider),
    network
  )
}

/**
 * Get the parent chain ERC-20 address for a given child chain token.
 * Accepts a viem PublicClient.
 */
export async function getParentErc20Address(
  erc20ChildAddress: string,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork
): Promise<string> {
  return coreGetParentErc20Address(
    erc20ChildAddress,
    wrapPublicClient(childProvider),
    network
  )
}

export type { GetErc20WithdrawalRequestParams }
