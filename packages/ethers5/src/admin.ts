/**
 * Admin functions for ethers v5 users.
 *
 * These functions are provider-agnostic (they only produce calldata),
 * so they are re-exported directly from core.
 */
export {
  getRegisterCustomTokenRequest,
  getSetGatewaysRequest,
} from '@arbitrum/core'

export type {
  GetRegisterCustomTokenRequestParams,
  GetSetGatewaysRequestParams,
} from '@arbitrum/core'
