/**
 * ETH bridging functions with viem-native type signatures.
 *
 * These re-export core functions, accepting viem PublicClient where
 * core expects ArbitrumProvider.
 */
import {
  getDepositRequest as coreGetDepositRequest,
  getWithdrawalRequest as coreGetWithdrawalRequest,
  getApproveGasTokenRequest as coreGetApproveGasTokenRequest,
} from '@arbitrum/core'
import type {
  GetDepositRequestParams,
  GetWithdrawalRequestParams,
  GetApproveGasTokenRequestParams,
  TransactionRequestData,
} from '@arbitrum/core'

/**
 * These core ETH functions don't actually require a provider — they are
 * pure calldata builders. We re-export them directly with the same signature.
 */
export function getDepositRequest(
  params: GetDepositRequestParams
): TransactionRequestData {
  return coreGetDepositRequest(params)
}

export function getWithdrawalRequest(
  params: GetWithdrawalRequestParams
): TransactionRequestData {
  return coreGetWithdrawalRequest(params)
}

export function getApproveGasTokenRequest(
  params: GetApproveGasTokenRequestParams
): TransactionRequestData {
  return coreGetApproveGasTokenRequest(params)
}

export type { GetDepositRequestParams, GetWithdrawalRequestParams, GetApproveGasTokenRequestParams }
