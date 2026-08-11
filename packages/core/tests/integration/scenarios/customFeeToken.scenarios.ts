/**
 * Custom fee token ETH bridging test scenarios — defined ONCE, run by every adapter.
 *
 * These tests only run on chains with a custom gas token (skipped when config.isEthNative).
 * They cover approving the native/gas token, depositing it, and withdrawing it.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  getDepositRequest,
  getApproveGasTokenRequest,
  getWithdrawalRequest,
  getChildToParentMessages,
  getExecuteRequest,
  getSendProps,
  ChildToParentMessageStatus,
  ERC20Abi,
  ArbitrumContract,
  isArbitrumNetworkNativeTokenEther,
  type ArbitrumNetwork,
} from '../../../src'

/** Amount used for custom fee token deposits */
const DEPOSIT_AMOUNT = 200_000_000_000_000n // 0.0002 native token

/** Amount used for withdrawal tests */
const WITHDRAW_AMOUNT = 20_000_000_000n // 0.00000002 native token

/** Amount to fund test wallets with from the funnelKey */
const FUND_AMOUNT = 100_000_000_000_000_000n // 0.1 native token

/** Max uint256 */
const MAX_UINT256 = 2n ** 256n - 1n

/** Delay between mining attempts (ms) */
const MINE_INTERVAL_MS = 500

/** Wait helper */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fund a wallet from the funnel key.
 */
async function fundWallet(
  harness: TestHarness,
  rpcUrl: string,
  funnelKey: string,
  toAddress: string,
  amount: bigint = FUND_AMOUNT
): Promise<void> {
  await harness.sendEth(funnelKey, rpcUrl, toAddress, amount)
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
 * Register all 4 custom fee token ETH bridging test scenarios.
 */
export function customFeeTokenScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)

  describe('Custom Fee Token ETH Bridging', () => {
    // ---------------------------------------------------------------
    // Test 1: approves custom fee token (arbitrary amount, using params)
    // ---------------------------------------------------------------
    it('approves custom fee token (arbitrary amount, using params)', async () => {
      if (config.isEthNative) {
        return
      }

      const testAddr = harness.getAddress(config.funnelKey)
      const parentProvider = harness.createProvider(parentRpcUrl)
      const amount = 1_000_000_000_000_000_000n // 1 token (18 decimals)

      // Build and send the approval TX
      const approveTx = getApproveGasTokenRequest({
        network,
        amount,
        from: testAddr,
      })

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        approveTx
      )
      expect(receipt.status).toBe(1)

      // Read the allowance via ERC20 contract
      const nativeToken = network.nativeToken!
      const erc20 = new ArbitrumContract(ERC20Abi, nativeToken, parentProvider)
      const result = await erc20.read('allowance', [
        testAddr,
        network.ethBridge.inbox,
      ])

      const allowance = result[0] as bigint
      expect(allowance).toBeGreaterThanOrEqual(amount)
    })

    // ---------------------------------------------------------------
    // Test 2: approves custom fee token (max amount)
    // ---------------------------------------------------------------
    it('approves custom fee token (max amount)', async () => {
      if (config.isEthNative) {
        return
      }

      const testAddr = harness.getAddress(config.funnelKey)
      const parentProvider = harness.createProvider(parentRpcUrl)

      // Build approval without specifying amount (defaults to max uint256)
      const approveTx = getApproveGasTokenRequest({
        network,
        from: testAddr,
      })

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        approveTx
      )
      expect(receipt.status).toBe(1)

      // Read the allowance via ERC20 contract
      const nativeToken = network.nativeToken!
      const erc20 = new ArbitrumContract(ERC20Abi, nativeToken, parentProvider)
      const result = await erc20.read('allowance', [
        testAddr,
        network.ethBridge.inbox,
      ])

      const allowance = result[0] as bigint
      expect(allowance).toBe(MAX_UINT256)
    })

    // ---------------------------------------------------------------
    // Test 3: deposits custom fee token
    // ---------------------------------------------------------------
    it('deposits custom fee token', async () => {
      if (config.isEthNative) {
        return
      }

      const testAddr = harness.getAddress(config.funnelKey)

      // Get initial child chain balance
      const initialBalance = await harness.getBalance(childRpcUrl, testAddr)

      // Build and send the deposit request
      // On custom fee token chains, "ETH deposit" actually deposits the native/gas token
      const depositTx = getDepositRequest({
        network,
        amount: DEPOSIT_AMOUNT,
        from: testAddr,
      })

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        depositTx
      )
      expect(receipt.status).toBe(1)

      // Wait for deposit to land on child chain
      await wait(30_000)

      // Verify the child chain balance increased by the deposit amount
      const finalBalance = await harness.getBalance(childRpcUrl, testAddr)
      expect(finalBalance).toBe(initialBalance + DEPOSIT_AMOUNT)
    })

    // ---------------------------------------------------------------
    // Test 4: withdraws custom fee token (full lifecycle)
    // ---------------------------------------------------------------
    it(
      'withdraws custom fee token',
      { timeout: 300_000 },
      async () => {
        if (config.isEthNative) {
          return
        }

        const testAddr = harness.getAddress(config.funnelKey)
        const parentProvider = harness.createProvider(parentRpcUrl)
        const childProvider = harness.createProvider(childRpcUrl)

        // Generate random destination for the withdrawal
        const randomKey =
          '0x' +
          [...Array(64)]
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join('')
        const randomAddress = harness.getAddress(randomKey)

        // Read initial native token balance on parent chain for the destination
        const nativeToken = network.nativeToken!
        const erc20 = new ArbitrumContract(
          ERC20Abi,
          nativeToken,
          parentProvider
        )
        const initialResult = await erc20.read('balanceOf', [randomAddress])
        const initialBalance = initialResult[0] as bigint

        // Build and send withdrawal on the child chain
        const withdrawTx = getWithdrawalRequest({
          network,
          amount: WITHDRAW_AMOUNT,
          destinationAddress: randomAddress,
          from: testAddr,
        })

        const withdrawReceipt = await harness.sendTransaction(
          config.funnelKey,
          childRpcUrl,
          withdrawTx
        )
        expect(withdrawReceipt.status).toBe(1)

        // Get child-to-parent messages
        const withdrawMessages = getChildToParentMessages(
          withdrawReceipt,
          parentProvider,
          network
        )
        expect(withdrawMessages.length).toBeGreaterThanOrEqual(1)

        const withdrawMessage = withdrawMessages[0]
        expect(withdrawMessage).toBeDefined()

        // Check initial status is UNCONFIRMED
        const initialStatus = await withdrawMessage.status(
          network,
          childProvider
        )
        expect(initialStatus).toBe(ChildToParentMessageStatus.UNCONFIRMED)

        // Mine blocks on both chains while waiting for assertion confirmation
        const state = { mining: true }
        await Promise.race([
          mineUntilStop(harness, parentRpcUrl, config.funnelKey, state),
          mineUntilStop(harness, childRpcUrl, config.funnelKey, state),
          withdrawMessage.waitUntilReadyToExecute(
            network,
            childProvider,
            500
          ),
        ])
        state.mining = false

        // Verify status is now CONFIRMED
        const confirmedStatus = await withdrawMessage.status(
          network,
          childProvider
        )
        expect(confirmedStatus).toBe(ChildToParentMessageStatus.CONFIRMED)

        // Get the outbox proof
        const { sendRootSize } = await getSendProps(
          parentProvider,
          childProvider,
          withdrawMessage.event,
          network
        )
        expect(sendRootSize).toBeDefined()

        const proof = await withdrawMessage.getOutboxProof(
          childProvider,
          sendRootSize!
        )

        // Build and send the execute request on the parent chain
        const executeTx = getExecuteRequest(
          withdrawMessage.event,
          proof,
          network
        )

        const executeReceipt = await harness.sendTransaction(
          config.funnelKey,
          parentRpcUrl,
          executeTx
        )
        expect(executeReceipt.status).toBe(1)

        // Verify status is now EXECUTED
        const executedStatus = await withdrawMessage.status(
          network,
          childProvider
        )
        expect(executedStatus).toBe(ChildToParentMessageStatus.EXECUTED)

        // Verify the destination received the native token (ERC20 on parent chain)
        const finalResult = await erc20.read('balanceOf', [randomAddress])
        const finalBalance = finalResult[0] as bigint
        expect(finalBalance).toBe(initialBalance + WITHDRAW_AMOUNT)
      }
    )
  })
}
