/**
 * Admin functions re-exported with the same signatures.
 *
 * These are pure calldata builders — no provider needed.
 */
import {
  getRegisterCustomTokenRequest as coreGetRegisterCustomTokenRequest,
  getSetGatewaysRequest as coreGetSetGatewaysRequest,
} from '@arbitrum/core'
import type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
  TransactionRequestData,
} from '@arbitrum/core'

/**
 * Build a transaction request to register a custom token on the Arbitrum bridge.
 */
export function getRegisterCustomTokenRequest(
  params: GetRegisterCustomTokenRequestParams
): TransactionRequestData {
  return coreGetRegisterCustomTokenRequest(params)
}

/**
 * Build a transaction request to set gateways for tokens on the L1 gateway router.
 */
export function getSetGatewaysRequest(
  params: GetSetGatewaysRequestParams
): TransactionRequestData {
  return coreGetSetGatewaysRequest(params)
}

export type { GetRegisterCustomTokenRequestParams, GetSetGatewaysRequestParams }
