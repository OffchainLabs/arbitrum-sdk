/**
 * Batch info test scenarios — defined ONCE, run by every adapter.
 *
 * Tests that L1 batch information can be looked up for child chain transactions
 * using the NodeInterface precompile.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  ArbitrumContract,
  NodeInterfaceAbi,
  NODE_INTERFACE_ADDRESS,
  type ArbitrumNetwork,
} from '../../../src'

/** Amount to fund test wallets with from the funnelKey */
const FUND_AMOUNT = 100_000_000_000_000_000n // 0.1 ETH

/** Amount used for child chain transfers */
const CHILD_TRANSFER_AMOUNT = 5_000_000_000_000n // 0.000005 ETH

/** Delay between mining attempts (ms) */
const MINE_INTERVAL_MS = 500

/** Wait helper */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
 * Mine blocks by sending self-transfers on a given chain.
 */
async function mineUntilStop(
  harness: TestHarness,
  rpcUrl: string,
  key: string,
  state: { mining: boolean }
): Promise<void> {
  const addr = harness.getAddress(key)
  while (state.mining) {
    try {
      await harness.sendEth(key, rpcUrl, addr, 0n)
    } catch {
      // ignore transient failures
    }
    await wait(MINE_INTERVAL_MS)
  }
}

/**
 * Poll for L1 batch confirmations using getL1Confirmations.
 * Returns the number of confirmations once non-zero, or 0 after timeout.
 */
async function waitForL1BatchConfirmations(
  nodeInterface: ArbitrumContract,
  blockHash: string,
  timeoutMs: number
): Promise<bigint> {
  const MAX_POLLS = 10
  let polls = 0
  let confirmations = 0n

  while (polls < MAX_POLLS) {
    const result = await nodeInterface.read('getL1Confirmations', [blockHash])
    confirmations = result[0] as bigint

    if (confirmations !== 0n) {
      break
    }

    polls += 1
    await wait(timeoutMs / MAX_POLLS)
  }

  return confirmations
}

/**
 * Register batch info test scenarios.
 */
export function batchInfoScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, childRpcUrl } = getNetworkContext(config)

  describe('Batch Info', () => {
    // ---------------------------------------------------------------
    // Test: finds L1 batch info for child transaction
    // ---------------------------------------------------------------
    it(
      'finds L1 batch info for child transaction',
      { timeout: 120_000 },
      async () => {
        const childProvider = harness.createProvider(childRpcUrl)
        const nodeInterface = new ArbitrumContract(
          NodeInterfaceAbi,
          NODE_INTERFACE_ADDRESS,
          childProvider
        )

        // Fund a test wallet on the child chain
        const testKey =
          '0x' +
          [...Array(64)]
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('')
        const testAddr = harness.getAddress(testKey)

        await harness.sendEth(
          config.funnelKey,
          childRpcUrl,
          testAddr,
          FUND_AMOUNT
        )

        // Send a simple ETH transfer on the child chain
        const randomKey =
          '0x' +
          [...Array(64)]
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('')
        const randomAddress = harness.getAddress(randomKey)

        const receipt = await harness.sendEth(
          testKey,
          childRpcUrl,
          randomAddress,
          CHILD_TRANSFER_AMOUNT
        )

        // Start mining on both chains
        const state = { mining: true }
        const mineParent = mineUntilStop(
          harness,
          parentRpcUrl,
          config.funnelKey,
          state
        )
        const mineChild = mineUntilStop(
          harness,
          childRpcUrl,
          config.funnelKey,
          state
        )

        try {
          // Poll for batch info
          // eslint-disable-next-line no-constant-condition
          while (true) {
            await wait(300)

            // Find the batch containing our block
            let batchNumber: bigint
            try {
              const result = await nodeInterface.read(
                'findBatchContainingBlock',
                [BigInt(receipt.blockNumber)]
              )
              batchNumber = result[0] as bigint
            } catch {
              // findBatchContainingBlock errors if block number does not exist yet
              continue
            }

            if (batchNumber > 0n) {
              // Poll for L1 confirmations using the block hash
              const confirmations = await waitForL1BatchConfirmations(
                nodeInterface,
                receipt.blockHash,
                60_000
              )

              expect(confirmations).toBeGreaterThan(0n)

              if (confirmations > 8n) {
                break
              }
            }
          }
        } finally {
          state.mining = false
          // Wait for miners to stop
          await Promise.allSettled([mineParent, mineChild])
        }
      }
    )
  })
}
