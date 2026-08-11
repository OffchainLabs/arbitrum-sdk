/**
 * Gas estimation test scenarios — defined ONCE, run by every adapter.
 *
 * Each test uses the TestHarness interface for signing/sending and the
 * provider-agnostic core functions for all bridging logic.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  estimateSubmissionFee,
  type ArbitrumNetwork,
} from '../../../src'

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
 * Register gas estimation test scenarios.
 */
export function gasEstimationScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, network } = getNetworkContext(config)

  describe('Gas Estimation', () => {
    // ---------------------------------------------------------------
    // Test 1: estimateSubmissionFee returns non-0 for ETH chain
    // ---------------------------------------------------------------
    it('estimateSubmissionFee returns non-0 for ETH chain', async () => {
      if (!config.isEthNative) {
        return
      }

      const parentProvider = harness.createProvider(parentRpcUrl)

      // 32 bytes of zero calldata
      const callDataSize = 32

      const submissionFee = await estimateSubmissionFee(
        parentProvider,
        network,
        callDataSize
      )

      expect(submissionFee).toBeGreaterThan(0n)
    })

    // ---------------------------------------------------------------
    // Test 2: estimateSubmissionFee returns 0 for custom gas token chain
    // ---------------------------------------------------------------
    it('estimateSubmissionFee returns 0 for custom gas token chain', async () => {
      if (config.isEthNative) {
        return
      }

      const parentProvider = harness.createProvider(parentRpcUrl)

      // 32 bytes of zero calldata
      const callDataSize = 32

      const submissionFee = await estimateSubmissionFee(
        parentProvider,
        network,
        callDataSize
      )

      expect(submissionFee).toBe(0n)
    })
  })
}
