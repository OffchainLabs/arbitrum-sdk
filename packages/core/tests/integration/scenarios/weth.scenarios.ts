/**
 * WETH bridging test scenarios -- defined ONCE, run by every adapter.
 *
 * Ported from packages/sdk/tests/integration/weth.test.ts.
 * Uses the TestHarness interface for signing/sending and the
 * provider-agnostic core functions for all bridging logic.
 *
 * WETH tests only run on ETH-native chains (not custom gas token chains).
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  getApproveTokenRequest,
  getErc20DepositRequest,
  getErc20WithdrawalRequest,
  getParentToChildMessages,
  getChildToParentMessages,
  getChildErc20Address,
  getChildGatewayAddress,
  getExecuteRequest,
  getSendProps,
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  assertArbitrumNetworkHasTokenBridge,
  ArbitrumContract,
  ERC20Abi,
  getChildToParentEvents,
  type ArbitrumNetwork,
} from '../../../src'

/**
 * Minimal ABI for WETH deposit (wrapping ETH) and withdraw (unwrapping).
 * WETH's deposit() is payable with no args, withdraw(uint256) unwraps.
 */
const WethAbi = [
  ...ERC20Abi,
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wad', type: 'uint256', internalType: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_to', type: 'address', internalType: 'address' },
      { name: '_amount', type: 'uint256', internalType: 'uint256' },
    ],
    name: 'withdrawTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** Amount of ETH to wrap into WETH */
const WETH_TO_WRAP = 10_000_000_000_000n // 0.00001 ETH

/** Amount of WETH to deposit to child chain */
const WETH_TO_DEPOSIT = 100_000_000_000n // 0.0000001 ETH

/** Amount of WETH to withdraw from child chain */
const WETH_TO_WITHDRAW = 10_000_000n // 0.00000001 ETH

/** Amount to fund test wallets with from the funnelKey */
const FUND_AMOUNT = 1_000_000_000_000_000_000n // 1 ETH

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
 * Read the ERC-20 balance of an address.
 */
async function getTokenBalance(
  harness: TestHarness,
  rpcUrl: string,
  tokenAddress: string,
  account: string
): Promise<bigint> {
  const provider = harness.createProvider(rpcUrl)
  const token = new ArbitrumContract(ERC20Abi, tokenAddress).connect(provider)
  const [balance] = await token.read('balanceOf', [account])
  return balance as bigint
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
 * Register all WETH bridging test scenarios.
 * These only run on ETH-native chains.
 */
export function wethScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)

  describe('WETH Bridging', () => {
    // ---------------------------------------------------------------
    // Test 4.1: deposit WETH
    // ---------------------------------------------------------------
    it('deposit WETH', async () => {
      if (!config.isEthNative) {
        // WETH tests only apply to ETH-native chains
        return
      }

      assertArbitrumNetworkHasTokenBridge(network)

      const testAddr = harness.getAddress(config.funnelKey)
      const parentProvider = harness.createProvider(parentRpcUrl)
      const childProvider = harness.createProvider(childRpcUrl)

      const parentWethAddress = network.tokenBridge.parentWeth

      // Verify starting child WETH balance is 0
      const childWethAddress = network.tokenBridge.childWeth
      const startBalance = await getTokenBalance(
        harness,
        childRpcUrl,
        childWethAddress,
        testAddr
      )
      // Note: balance may not be 0 if test is re-run; that's OK

      // Step 1: Wrap ETH into WETH on parent chain
      const wethContract = new ArbitrumContract(WethAbi, parentWethAddress)
      const wrapTx = wethContract.encodeWrite('deposit', [], {
        value: WETH_TO_WRAP,
        from: testAddr,
      })
      const wrapReceipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        wrapTx
      )
      expect(wrapReceipt.status).toBe(1)

      // Verify WETH balance after wrapping
      const wethBalance = await getTokenBalance(
        harness,
        parentRpcUrl,
        parentWethAddress,
        testAddr
      )
      expect(wethBalance).toBeGreaterThanOrEqual(WETH_TO_DEPOSIT)

      // Step 2: Approve WETH for the gateway
      const approveTx = await getApproveTokenRequest({
        network,
        erc20ParentAddress: parentWethAddress,
        from: testAddr,
        parentProvider,
      })
      const approveReceipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        approveTx
      )
      expect(approveReceipt.status).toBe(1)

      // Step 3: Deposit WETH via the gateway router.
      // Use a higher submission fee buffer to account for base fee changes
      // between estimation and sending (testnode timing issue).
      const depositTx = await getErc20DepositRequest({
        network,
        erc20ParentAddress: parentWethAddress,
        amount: WETH_TO_DEPOSIT,
        from: testAddr,
        parentProvider,
        childProvider,
        retryableGasOverrides: {
          maxSubmissionFee: { percentIncrease: 500n },
        },
      })
      const depositReceipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        depositTx
      )
      expect(depositReceipt.status).toBe(1)

      // Step 4: Wait for auto-redeem
      const messages = getParentToChildMessages(
        depositReceipt,
        childProvider,
        network
      )
      expect(messages.length).toBe(1)

      const message = messages[0]
      const result = await message.waitForStatus(120_000)
      expect(result.status).toBe(ParentToChildMessageStatus.REDEEMED)

      // Step 5: Verify child WETH balance increased
      const childBalanceAfter = await getTokenBalance(
        harness,
        childRpcUrl,
        childWethAddress,
        testAddr
      )
      expect(childBalanceAfter).toBe(startBalance + WETH_TO_DEPOSIT)

      // Step 6: Verify the WETH gateway was used
      const childGateway = await getChildGatewayAddress(
        parentWethAddress,
        childProvider,
        network
      )
      expect(childGateway.toLowerCase()).toBe(
        network.tokenBridge.childWethGateway.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 4.2: withdraw WETH (full lifecycle)
    // ---------------------------------------------------------------
    it(
      'withdraw WETH',
      { timeout: 300_000 },
      async () => {
        if (!config.isEthNative) {
          // WETH tests only apply to ETH-native chains
          return
        }

        assertArbitrumNetworkHasTokenBridge(network)

        const testAddr = harness.getAddress(config.funnelKey)
        const parentProvider = harness.createProvider(parentRpcUrl)
        const childProvider = harness.createProvider(childRpcUrl)

        const parentWethAddress = network.tokenBridge.parentWeth
        const childWethAddress = network.tokenBridge.childWeth

        // Ensure we have WETH on the child chain.
        // Wrap some ETH into child WETH by calling deposit() on the child WETH contract.
        const childWethContract = new ArbitrumContract(
          WethAbi,
          childWethAddress
        )
        const wrapChildTx = childWethContract.encodeWrite('deposit', [], {
          value: WETH_TO_WRAP,
          from: testAddr,
        })
        const wrapChildReceipt = await harness.sendTransaction(
          config.funnelKey,
          childRpcUrl,
          wrapChildTx
        )
        expect(wrapChildReceipt.status).toBe(1)

        const childBalanceBefore = await getTokenBalance(
          harness,
          childRpcUrl,
          childWethAddress,
          testAddr
        )
        expect(childBalanceBefore).toBeGreaterThanOrEqual(WETH_TO_WITHDRAW)

        // Build and send the withdrawal on the child chain
        const withdrawTx = getErc20WithdrawalRequest({
          network,
          erc20ParentAddress: parentWethAddress,
          amount: WETH_TO_WITHDRAW,
          destinationAddress: testAddr,
          from: testAddr,
        })

        const withdrawReceipt = await harness.sendTransaction(
          config.funnelKey,
          childRpcUrl,
          withdrawTx
        )
        expect(withdrawReceipt.status).toBe(1)

        // Verify child WETH balance decreased
        const childBalanceAfter = await getTokenBalance(
          harness,
          childRpcUrl,
          childWethAddress,
          testAddr
        )
        expect(childBalanceAfter).toBe(childBalanceBefore - WETH_TO_WITHDRAW)

        // Get child-to-parent messages
        const withdrawMessages = getChildToParentMessages(
          withdrawReceipt,
          parentProvider,
          network
        )
        expect(withdrawMessages.length).toBeGreaterThanOrEqual(1)

        const withdrawMessage = withdrawMessages[0]
        expect(withdrawMessage).toBeDefined()

        // Verify the L2ToL1Tx events
        const withdrawEvents = getChildToParentEvents(withdrawReceipt)
        expect(withdrawEvents.length).toBe(1)

        // Check initial status is UNCONFIRMED
        const initialStatus = await withdrawMessage.status(
          network,
          childProvider
        )
        expect(initialStatus).toBe(ChildToParentMessageStatus.UNCONFIRMED)

        // Get parent WETH balance before execution
        const parentWethBefore = await getTokenBalance(
          harness,
          parentRpcUrl,
          parentWethAddress,
          testAddr
        )

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

        // Verify the parent chain received the WETH
        // Note: WETH gateway unwraps to ETH, so the WETH balance may not change.
        // Instead check that the ETH balance of the outbox increased, or that
        // the WETH contract balance on the parent decreased.
        // For WETH gateway, the withdrawal actually sends ETH (unwrapped).
        // The old SDK test checks parentToken.balanceOf which is the WETH balance,
        // but the WETH gateway unwraps to ETH on withdrawal. Let's verify the
        // parent WETH balance increased (the gateway mints WETH, not ETH, on parent).
        // Actually -- WETH gateway on parent side: the gateway holds WETH. On withdrawal
        // the gateway sends WETH to the user. So the user's parent WETH balance should increase.
        const parentWethAfter = await getTokenBalance(
          harness,
          parentRpcUrl,
          parentWethAddress,
          testAddr
        )
        expect(parentWethAfter).toBe(parentWethBefore + WETH_TO_WITHDRAW)
      }
    )
  })
}
