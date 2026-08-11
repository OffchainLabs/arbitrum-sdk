/**
 * WETH gateway detection utility.
 *
 * Determines if a gateway address is a WETH gateway by calling
 * `l1Weth()` on the contract. If it returns a non-zero address,
 * it's a WETH gateway. If the call reverts or returns zero, it's not.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { L1WethGatewayAbi } from '../abi/L1WethGateway'
import type { ArbitrumProvider } from '../interfaces/provider'
import { ADDRESS_ZERO } from '../constants'

/**
 * Check if a gateway address is a WETH gateway by calling `l1Weth()`.
 *
 * @param gatewayAddress - The gateway contract address to check
 * @param parentProvider - Provider connected to the parent chain
 * @returns True if the gateway is a WETH gateway, false otherwise
 */
export async function isWethGateway(
  gatewayAddress: string,
  parentProvider: ArbitrumProvider
): Promise<boolean> {
  try {
    const gateway = new ArbitrumContract(
      L1WethGatewayAbi,
      gatewayAddress
    ).connect(parentProvider)

    const [wethAddress] = await gateway.read('l1Weth', [])
    const addr = wethAddress as string

    // If l1Weth returns a non-zero address, this is a WETH gateway
    return (
      typeof addr === 'string' &&
      addr !== ADDRESS_ZERO &&
      addr !== '0x' &&
      addr.length === 42
    )
  } catch {
    // Call reverted or failed — not a WETH gateway
    return false
  }
}
