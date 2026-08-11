/**
 * ETH bridging test scenarios — defined ONCE, run by every adapter.
 *
 * Each test uses the TestHarness interface for signing/sending and the
 * provider-agnostic core functions for all bridging logic.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  getDepositRequest,
  getApproveGasTokenRequest,
  getWithdrawalRequest,
  getEthDeposits,
  getParentToChildMessages,
  getChildToParentMessages,
  getRedeemRequest,
  getExecuteRequest,
  getSendProps,
  EthDepositMessageStatus,
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  estimateAll,
  type ArbitrumNetwork,
  type GasOverrides,
  InboxAbi,
  ERC20InboxAbi,
  isArbitrumNetworkNativeTokenEther,
  ArbitrumContract,
  getChildToParentEvents,
} from '../../../src'

/** Amount used for simple ETH deposits */
const ETH_DEPOSIT_AMOUNT = 200_000_000_000_000n // 0.0002 ETH

/** Amount used for child chain transfers */
const CHILD_TRANSFER_AMOUNT = 5_000_000_000_000n // 0.000005 ETH

/** Amount used for withdrawal tests */
const ETH_WITHDRAW_AMOUNT = 20_000_000_000n // 0.00000002 ETH

/** Amount to fund test wallets with from the funnelKey */
const FUND_AMOUNT = 100_000_000_000_000_000n // 0.1 ETH

/** Delay between mining attempts (ms) -- must be large enough to avoid
 *  overwhelming the testnode with blocks. With confirmPeriodBlocks=1,
 *  we only need a handful of blocks to confirm, not thousands. */
const MINE_INTERVAL_MS = 500

/** Wait helper */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fund a wallet with ETH from the funnel key.
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
 * Build a depositTo transaction request (retryable ticket) by directly
 * estimating gas parameters and encoding the createRetryableTicket call.
 */
async function buildDepositToRequest(
  harness: TestHarness,
  parentRpcUrl: string,
  childRpcUrl: string,
  network: ArbitrumNetwork,
  from: string,
  destinationAddress: string,
  amount: bigint,
  gasOverrides?: GasOverrides
) {
  const parentProvider = harness.createProvider(parentRpcUrl)
  const childProvider = harness.createProvider(childRpcUrl)
  const nativeTokenIsEth = isArbitrumNetworkNativeTokenEther(network)

  // Estimate gas parameters for the retryable ticket
  const estimates = await estimateAll(
    parentProvider,
    childProvider,
    network,
    {
      from,
      to: destinationAddress,
      l2CallValue: amount,
      excessFeeRefundAddress: from,
      callValueRefundAddress: destinationAddress,
      data: '0x',
    },
    gasOverrides
  )

  // Encode the createRetryableTicket call
  const abi = nativeTokenIsEth ? InboxAbi : ERC20InboxAbi
  const inbox = new ArbitrumContract(abi, network.ethBridge.inbox)

  const data = inbox.encodeFunctionData('createRetryableTicket', [
    destinationAddress,
    amount,
    estimates.maxSubmissionCost,
    from,
    destinationAddress,
    estimates.gasLimit,
    estimates.maxFeePerGas,
    '0x',
  ])

  const value = nativeTokenIsEth ? estimates.deposit : 0n

  return { to: network.ethBridge.inbox, data, value, from }
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
 * Register all 6 ETH bridging test scenarios.
 */
export function ethScenarios(harness: TestHarness, config: TestConfig): void {
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)

  describe('ETH Bridging', () => {
    // ---------------------------------------------------------------
    // Test 1.1: transfers ether on child chain
    // ---------------------------------------------------------------
    it('transfers ether on child chain', async () => {
      const testKey =
        '0x' +
        [...Array(64)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      const testAddr = harness.getAddress(testKey)

      // Fund the test wallet on the child chain
      await fundWallet(
        harness,
        childRpcUrl,
        config.funnelKey,
        testAddr,
        FUND_AMOUNT
      )

      // Generate a random recipient
      const randomKey =
        '0x' +
        [...Array(64)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      const randomAddress = harness.getAddress(randomKey)

      const balanceBefore = await harness.getBalance(childRpcUrl, testAddr)

      const receipt = await harness.sendEth(
        testKey,
        childRpcUrl,
        randomAddress,
        CHILD_TRANSFER_AMOUNT
      )

      const balanceAfter = await harness.getBalance(childRpcUrl, testAddr)
      const randomBalanceAfter = await harness.getBalance(
        childRpcUrl,
        randomAddress
      )

      expect(randomBalanceAfter).toBe(CHILD_TRANSFER_AMOUNT)

      const gasSpent = receipt.gasUsed * receipt.effectiveGasPrice
      expect(balanceAfter).toBe(
        balanceBefore - gasSpent - CHILD_TRANSFER_AMOUNT
      )
    })

    // ---------------------------------------------------------------
    // Test 1.2: approveGasToken throws on ETH-native
    // ---------------------------------------------------------------
    it('approveGasToken throws when ETH is native gas token', () => {
      if (!config.isEthNative) {
        // This test only applies to ETH-native chains
        return
      }

      const testAddr = harness.getAddress(config.funnelKey)

      expect(() =>
        getApproveGasTokenRequest({
          network,
          from: testAddr,
        })
      ).toThrow('chain uses ETH as its native/gas token')
    })

    // ---------------------------------------------------------------
    // Test 1.3: deposits ETH
    // ---------------------------------------------------------------
    it('deposits ETH', async () => {
      const testAddr = harness.getAddress(config.funnelKey)
      const childProvider = harness.createProvider(childRpcUrl)
      const parentProvider = harness.createProvider(parentRpcUrl)

      // Track the bridge balance (inbox forwards ETH to the bridge contract)
      const bridgeAddress = network.ethBridge.bridge
      const initialBridgeBalance =
        await parentProvider.getBalance(bridgeAddress)

      // Build and send deposit request
      const depositTx = getDepositRequest({
        network,
        amount: ETH_DEPOSIT_AMOUNT,
        from: testAddr,
      })

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        depositTx
      )

      expect(receipt.status).toBe(1)

      // Verify bridge balance increased by the deposit amount
      const finalBridgeBalance =
        await parentProvider.getBalance(bridgeAddress)
      if (config.isEthNative) {
        expect(finalBridgeBalance).toBe(
          initialBridgeBalance + ETH_DEPOSIT_AMOUNT
        )
      }

      // Get ETH deposit messages from the receipt
      const ethDeposits = getEthDeposits(receipt, childProvider, network)
      expect(ethDeposits.length).toBe(1)

      const deposit = ethDeposits[0]
      expect(deposit.to.toLowerCase()).toBe(testAddr.toLowerCase())
      // The value in the deposit event should be 0.0002 ETH in 18-decimal scale
      expect(deposit.value).toBe(200_000_000_000_000n)

      // Wait for deposit to land on child chain
      const childReceipt = await deposit.wait(120_000)
      expect(childReceipt).not.toBeNull()

      const status = await deposit.status()
      expect(status).toBe(EthDepositMessageStatus.DEPOSITED)
    })

    // ---------------------------------------------------------------
    // Test 1.4: deposits ETH to a specific address
    // ---------------------------------------------------------------
    it('deposits ETH to a specific address', async () => {
      const testAddr = harness.getAddress(config.funnelKey)
      const childProvider = harness.createProvider(childRpcUrl)

      // Generate random destination
      const destKey =
        '0x' +
        [...Array(64)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      const destAddress = harness.getAddress(destKey)

      // Build depositTo request (retryable ticket)
      const depositTx = await buildDepositToRequest(
        harness,
        parentRpcUrl,
        childRpcUrl,
        network,
        testAddr,
        destAddress,
        ETH_DEPOSIT_AMOUNT
      )

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        depositTx
      )

      expect(receipt.status).toBe(1)

      // Get parent-to-child messages (retryable tickets)
      const messages = getParentToChildMessages(
        receipt,
        childProvider,
        network
      )
      expect(messages.length).toBe(1)

      const message = messages[0]
      expect(message.messageData.destAddress.toLowerCase()).toBe(
        destAddress.toLowerCase()
      )
      expect(message.messageData.l2CallValue).toBe(ETH_DEPOSIT_AMOUNT)

      // Wait for the retryable ticket to be redeemed
      const result = await message.waitForStatus(120_000)
      expect(result.status).toBe(ParentToChildMessageStatus.REDEEMED)

      // Verify the destination has the deposited amount
      const destBalance = await harness.getBalance(childRpcUrl, destAddress)
      expect(destBalance).toBe(ETH_DEPOSIT_AMOUNT)
    })

    // ---------------------------------------------------------------
    // Test 1.5: deposits ETH with manual redeem
    // ---------------------------------------------------------------
    it('deposits ETH to a specific address with manual redeem', async () => {
      const testAddr = harness.getAddress(config.funnelKey)
      const childProvider = harness.createProvider(childRpcUrl)

      // Generate random destination
      const destKey =
        '0x' +
        [...Array(64)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')
      const destAddress = harness.getAddress(destKey)

      // Build depositTo request with gasLimit=0 to force auto-redeem failure
      const depositTx = await buildDepositToRequest(
        harness,
        parentRpcUrl,
        childRpcUrl,
        network,
        testAddr,
        destAddress,
        ETH_DEPOSIT_AMOUNT,
        { gasLimit: { base: 0n } }
      )

      const receipt = await harness.sendTransaction(
        config.funnelKey,
        parentRpcUrl,
        depositTx
      )

      expect(receipt.status).toBe(1)

      // Get the retryable ticket message
      const messages = getParentToChildMessages(
        receipt,
        childProvider,
        network
      )
      expect(messages.length).toBe(1)

      const message = messages[0]

      // Wait for the retryable ticket to be created (auto-redeem should fail)
      const result = await message.waitForStatus(120_000)
      expect(result.status).toBe(
        ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD
      )

      // Verify destination has zero balance before manual redeem
      const destBalanceBefore = await harness.getBalance(
        childRpcUrl,
        destAddress
      )
      expect(destBalanceBefore).toBe(0n)

      // Manually redeem the retryable ticket
      const redeemTx = getRedeemRequest(message.retryableCreationId)
      await harness.sendTransaction(config.funnelKey, childRpcUrl, redeemTx)

      // Verify destination now has the deposited amount
      const destBalanceAfter = await harness.getBalance(
        childRpcUrl,
        destAddress
      )
      expect(destBalanceAfter).toBe(ETH_DEPOSIT_AMOUNT)
    })

    // ---------------------------------------------------------------
    // Test 1.6: withdraw ETH (full lifecycle)
    // ---------------------------------------------------------------
    it(
      'withdraw ETH transaction succeeds',
      { timeout: 300_000 },
      async () => {
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

        // Build and send withdrawal on the child chain
        const withdrawTx = getWithdrawalRequest({
          network,
          amount: ETH_WITHDRAW_AMOUNT,
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

        // Verify the L2ToL1Tx events
        const withdrawEvents = getChildToParentEvents(withdrawReceipt)
        expect(withdrawEvents.length).toBe(1)

        // Check initial status is UNCONFIRMED
        const initialStatus = await withdrawMessage.status(
          network,
          childProvider
        )
        expect(initialStatus).toBe(ChildToParentMessageStatus.UNCONFIRMED)

        // Mine blocks on both chains while waiting for the assertion to be
        // confirmed. Use the funnelKey directly (it's pre-funded).
        // The state flag ensures miners stop once confirmation is detected.
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

        // Verify the destination received the ETH
        const finalRandomBalance = await parentProvider.getBalance(
          randomAddress
        )
        expect(finalRandomBalance).toBe(ETH_WITHDRAW_AMOUNT)
      }
    )
  })
}
