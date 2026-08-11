/**
 * ERC-20 gateway resolution functions.
 *
 * Read-only functions that query the gateway routers on parent and child chains
 * to resolve gateway addresses and token address mappings.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { L1GatewayRouterAbi } from '../abi/L1GatewayRouter'
import { L2GatewayRouterAbi } from '../abi/L2GatewayRouter'
import { L2GatewayTokenAbi } from '../abi/L2GatewayToken'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumNetwork } from '../networks'
import { assertArbitrumNetworkHasTokenBridge } from '../networks'
import { ArbSdkError } from '../errors'

/**
 * Get the parent gateway address for a given ERC-20 token.
 *
 * Calls `L1GatewayRouter.getGateway(token)` on the parent chain.
 */
export async function getParentGatewayAddress(
  erc20ParentAddress: string,
  parentProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): Promise<string> {
  assertArbitrumNetworkHasTokenBridge(network)

  const router = new ArbitrumContract(
    L1GatewayRouterAbi,
    network.tokenBridge.parentGatewayRouter
  ).connect(parentProvider)

  const [gateway] = await router.read('getGateway', [erc20ParentAddress])
  return gateway as string
}

/**
 * Get the child gateway address for a given ERC-20 token.
 *
 * Calls `L2GatewayRouter.getGateway(token)` on the child chain.
 */
export async function getChildGatewayAddress(
  erc20ParentAddress: string,
  childProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): Promise<string> {
  assertArbitrumNetworkHasTokenBridge(network)

  const router = new ArbitrumContract(
    L2GatewayRouterAbi,
    network.tokenBridge.childGatewayRouter
  ).connect(childProvider)

  const [gateway] = await router.read('getGateway', [erc20ParentAddress])
  return gateway as string
}

/**
 * Get the child chain ERC-20 address for a given parent chain token.
 *
 * Calls `L1GatewayRouter.calculateL2TokenAddress(token)` on the parent chain.
 */
export async function getChildErc20Address(
  erc20ParentAddress: string,
  parentProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): Promise<string> {
  assertArbitrumNetworkHasTokenBridge(network)

  const router = new ArbitrumContract(
    L1GatewayRouterAbi,
    network.tokenBridge.parentGatewayRouter
  ).connect(parentProvider)

  const [childAddress] = await router.read('calculateL2TokenAddress', [
    erc20ParentAddress,
  ])
  return childAddress as string
}

/**
 * Get the parent chain ERC-20 address for a given child chain token.
 *
 * Calls `L2GatewayToken.l1Address()` on the child token, then validates
 * it via `L2GatewayRouter.calculateL2TokenAddress()`.
 */
export async function getParentErc20Address(
  erc20ChildAddress: string,
  childProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): Promise<string> {
  assertArbitrumNetworkHasTokenBridge(network)

  // WETH special case
  if (
    erc20ChildAddress.toLowerCase() ===
    network.tokenBridge.childWeth.toLowerCase()
  ) {
    return network.tokenBridge.parentWeth
  }

  // Read l1Address from the child token
  const childToken = new ArbitrumContract(
    L2GatewayTokenAbi,
    erc20ChildAddress
  ).connect(childProvider)

  const [parentAddress] = await childToken.read('l1Address', [])

  // Validate: look up the child address from the router and compare
  const router = new ArbitrumContract(
    L2GatewayRouterAbi,
    network.tokenBridge.childGatewayRouter
  ).connect(childProvider)

  const [calculatedChildAddress] = await router.read(
    'calculateL2TokenAddress',
    [parentAddress]
  )

  if (
    (calculatedChildAddress as string).toLowerCase() !==
    erc20ChildAddress.toLowerCase()
  ) {
    throw new ArbSdkError(
      `Unexpected parent address. Parent address from token is not registered to the provided child address. ${parentAddress} ${calculatedChildAddress} ${erc20ChildAddress}`
    )
  }

  return parentAddress as string
}
