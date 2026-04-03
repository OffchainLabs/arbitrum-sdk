/**
 * Custom ERC-20 bridging test scenarios -- defined ONCE, run by every adapter.
 *
 * Ported from packages/sdk/tests/integration/customerc20.test.ts.
 * Uses the TestHarness interface for signing/sending and the
 * provider-agnostic core functions for all bridging logic.
 *
 * NOTE: All tests are currently skipped because custom ERC-20 registration
 * requires deploying TestCustomTokenL1/TestArbCustomToken contracts with
 * specific bytecodes and calling AdminErc20Bridger.registerCustomToken.
 * This will be implemented in a follow-up.
 */
import { describe, it } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import type { ArbitrumNetwork } from '../../../src'

/**
 * Get the parent and child RPC URLs and the active network
 * based on whether this is an orbit test.
 */
function getNetworkContext(config: TestConfig): {
  parentRpcUrl: string
  childRpcUrl: string
  network: ArbitrumNetwork
} {
  if (config.isOrbitTest && config.l3Network) {
    return {
      parentRpcUrl: config.l2RpcUrl,
      childRpcUrl: config.l3RpcUrl,
      network: config.l3Network,
    }
  }
  return {
    parentRpcUrl: config.l1RpcUrl,
    childRpcUrl: config.l2RpcUrl,
    network: config.l2Network,
  }
}

/**
 * Register all Custom ERC-20 bridging test scenarios.
 */
export function customErc20Scenarios(
  _harness: TestHarness,
  config: TestConfig
): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)

  describe('Custom ERC-20 Bridging', () => {
    // ---------------------------------------------------------------
    // Test 3.1: register custom token
    // ---------------------------------------------------------------
    it.skip('register custom token', async () => {
      // TODO: Port from old SDK. Requires:
      // 1. Deploy TestCustomTokenL1 on parent chain (needs custom gateway + router args)
      // 2. Deploy TestArbCustomToken on child chain (needs custom gateway + parent token args)
      // 3. Call getRegisterCustomTokenRequest() to register the pair
      // 4. Wait for both parent-to-child messages (setToken + setGateway) to be redeemed
      // 5. Verify the gateways are correctly set on both chains
    })

    // ---------------------------------------------------------------
    // Test 3.2: deposit custom ERC-20
    // ---------------------------------------------------------------
    it.skip('deposit custom ERC-20', async () => {
      // TODO: Port from old SDK. Requires custom token to be registered first.
      // Similar to standard ERC-20 deposit but verifies custom gateway is used.
    })

    // ---------------------------------------------------------------
    // Test 3.3: withdraw custom ERC-20
    // ---------------------------------------------------------------
    it.skip('withdraw custom ERC-20', async () => {
      // TODO: Port from old SDK. Requires custom token deposit first.
      // Similar to standard ERC-20 withdrawal but verifies custom gateway is used.
    })

    // ---------------------------------------------------------------
    // Test 3.4: deposit custom ERC-20 with extra ETH
    // ---------------------------------------------------------------
    it.skip('deposit custom ERC-20 with extra ETH', async () => {
      // TODO: Port from old SDK. Batch custom token + ETH deposit.
    })

    // ---------------------------------------------------------------
    // Test 3.5: deposit custom ERC-20 with extra ETH to specific address
    // ---------------------------------------------------------------
    it.skip('deposit custom ERC-20 with extra ETH to specific address', async () => {
      // TODO: Port from old SDK. Same as 3.4 but with destinationAddress.
    })
  })
}
