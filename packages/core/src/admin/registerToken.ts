/**
 * Admin functions for token bridge management.
 *
 * These functions produce calldata for registering custom tokens
 * and setting gateways on the L1 gateway router.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { ICustomTokenAbi } from '../abi/ICustomToken'
import { L1GatewayRouterAbi } from '../abi/L1GatewayRouter'
import type { ArbitrumNetwork } from '../networks'
import { assertArbitrumNetworkHasTokenBridge } from '../networks'
import type { TransactionRequestData } from '../interfaces/types'

export interface GetRegisterCustomTokenRequestParams {
  /** The Arbitrum network (child chain). */
  network: ArbitrumNetwork
  /** Parent chain address of the custom token. */
  parentTokenAddress: string
  /** Child chain address of the custom token. */
  childTokenAddress: string
  /** Sender address (token owner). */
  from: string
  /** Maximum submission cost for the custom bridge retryable. */
  maxSubmissionCostForCustomBridge: bigint
  /** Maximum submission cost for the router retryable. */
  maxSubmissionCostForRouter: bigint
  /** Max gas for the custom bridge retryable on L2. */
  maxGasForCustomBridge: bigint
  /** Max gas for the router retryable on L2. */
  maxGasForRouter: bigint
  /** Gas price bid on the child chain. */
  gasPriceBid: bigint
  /** Value to forward for the gateway retryable. */
  valueForGateway: bigint
  /** Value to forward for the router retryable. */
  valueForRouter: bigint
  /** Address to credit back unused funds. */
  creditBackAddress: string
}

export interface GetSetGatewaysRequestParams {
  /** The Arbitrum network (child chain). */
  network: ArbitrumNetwork
  /** Token addresses to set gateways for. */
  tokenAddresses: string[]
  /** Gateway addresses corresponding to each token. */
  gatewayAddresses: string[]
  /** Max gas for the retryable on L2. */
  maxGas: bigint
  /** Gas price bid on the child chain. */
  gasPriceBid: bigint
  /** Maximum submission cost for the retryable. */
  maxSubmissionCost: bigint
  /** Sender address. */
  from: string
}

/**
 * Build a transaction request to register a custom token on the Arbitrum bridge.
 *
 * Calls `ICustomToken.registerTokenOnL2()` on the parent token contract.
 * This initiates two retryable tickets: one for the custom gateway and one for the router.
 */
export function getRegisterCustomTokenRequest(
  params: GetRegisterCustomTokenRequestParams
): TransactionRequestData {
  const {
    parentTokenAddress,
    childTokenAddress,
    from,
    maxSubmissionCostForCustomBridge,
    maxSubmissionCostForRouter,
    maxGasForCustomBridge,
    maxGasForRouter,
    gasPriceBid,
    valueForGateway,
    valueForRouter,
    creditBackAddress,
  } = params

  const customToken = new ArbitrumContract(
    ICustomTokenAbi,
    parentTokenAddress
  )

  const data = customToken.encodeFunctionData('registerTokenOnL2', [
    childTokenAddress,
    maxSubmissionCostForCustomBridge,
    maxSubmissionCostForRouter,
    maxGasForCustomBridge,
    maxGasForRouter,
    gasPriceBid,
    valueForGateway,
    valueForRouter,
    creditBackAddress,
  ])

  return {
    to: parentTokenAddress,
    data,
    value: valueForGateway + valueForRouter,
    from,
  }
}

/**
 * Build a transaction request to set gateways for tokens on the L1 gateway router.
 *
 * Calls `L1GatewayRouter.setGateways(address[], address[], uint256, uint256, uint256)`.
 * This is an admin-only function.
 */
export function getSetGatewaysRequest(
  params: GetSetGatewaysRequestParams
): TransactionRequestData {
  const {
    network,
    tokenAddresses,
    gatewayAddresses,
    maxGas,
    gasPriceBid,
    maxSubmissionCost,
    from,
  } = params

  assertArbitrumNetworkHasTokenBridge(network)

  const router = new ArbitrumContract(
    L1GatewayRouterAbi,
    network.tokenBridge.parentGatewayRouter
  )

  const data = router.encodeFunctionData('setGateways', [
    tokenAddresses,
    gatewayAddresses,
    maxGas,
    gasPriceBid,
    maxSubmissionCost,
  ])

  const callValue = maxGas * gasPriceBid + maxSubmissionCost

  return {
    to: network.tokenBridge.parentGatewayRouter,
    data,
    value: callValue,
    from,
  }
}
