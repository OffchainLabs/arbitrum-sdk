/**
 * ETH bridger functions for ethers v6 users.
 *
 * These functions accept ethers v6 Provider types and return
 * TransactionRequestData that can be passed to signer.sendTransaction().
 *
 * Functions that don't need a provider (getDepositRequest, getWithdrawalRequest,
 * getApproveGasTokenRequest) are re-exported directly from core since their
 * params are provider-agnostic (they only need network + amounts + addresses).
 */

// Direct re-exports — these functions take no provider argument
export {
  getDepositRequest,
  getWithdrawalRequest,
  getApproveGasTokenRequest,
} from '@arbitrum/core'

export type {
  GetDepositRequestParams,
  GetWithdrawalRequestParams,
  GetApproveGasTokenRequestParams,
} from '@arbitrum/core'
