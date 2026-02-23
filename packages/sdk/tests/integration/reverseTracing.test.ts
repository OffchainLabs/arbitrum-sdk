import { expect } from 'chai'
import { loadEnv } from '../../src/lib/utils/env'
import { Wallet } from '@ethersproject/wallet'
import { BigNumber } from '@ethersproject/bignumber'
import { parseEther } from '@ethersproject/units'
import { JsonRpcProvider } from '@ethersproject/providers'

import {
  fundParentSigner,
  fundChildSigner,
  mineUntilStop,
  skipIfMainnet,
  wait,
} from './testHelpers'
import { ChildTransactionReceipt } from '../../src/lib/message/ChildTransaction'
import { ParentTransactionReceipt } from '../../src/lib/message/ParentTransaction'
import { ParentToChildMessageStatus } from '../../src/lib/message/ParentToChildMessage'
import { ChildToParentMessageStatus } from '../../src/lib/dataEntities/message'
import { testSetup } from '../testSetup'
import {
  getNativeTokenDecimals,
  scaleFrom18DecimalsToNativeTokenDecimals,
} from '../../src/lib/utils/lib'
import {
  isArbitrumNetworkWithCustomFeeToken,
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
} from './custom-fee-token/customFeeTokenTestHelpers'

loadEnv()

describe('Reverse Tracing', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('traces an ETH deposit child tx back to the parent tx', async () => {
    const {
      ethBridger,
      parentSigner,
      parentProvider,
      childChain,
      childSigner,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    await fundParentSigner(parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentSigner)
      await approveParentCustomFeeToken(parentSigner)
    }

    const ethToDeposit = scaleFrom18DecimalsToNativeTokenDecimals({
      amount: parseEther('0.0002'),
      decimals,
    })

    // Deposit ETH from parent to child
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      parentSigner: parentSigner,
    })
    const parentTxReceipt = await res.wait()
    expect(parentTxReceipt.status).to.equal(1, 'eth deposit parent txn failed')

    // Wait for child chain deposit to arrive
    const waitResult = await parentTxReceipt.waitForChildTransactionReceipt(
      childSigner.provider!
    )
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.childTxReceipt).to.exist

    const childReceipt = new ChildTransactionReceipt(waitResult.childTxReceipt!)

    // Mine blocks on both chains until the child tx is included in a batch
    const miner1 = Wallet.createRandom().connect(parentSigner.provider!)
    const miner2 = Wallet.createRandom().connect(childSigner.provider!)
    await fundParentSigner(miner1, parseEther('0.1'))
    await fundChildSigner(miner2, parseEther('0.1'))
    const state = { mining: true }
    mineUntilStop(miner1, state)
    mineUntilStop(miner2, state)

    // Wait for the batch containing this tx to be posted
    const l2Provider = childSigner.provider! as JsonRpcProvider
    const maxAttempts = 600 // ~3 minutes with 300ms delay
    let batchFound = false
    try {
      for (let attempts = 0; attempts < maxAttempts; attempts++) {
        await wait(300)
        const batchNum = await childReceipt
          .getBatchNumber(l2Provider)
          .catch(() => BigNumber.from(0))
        if (batchNum.gt(0)) {
          batchFound = true
          break
        }
      }
    } finally {
      state.mining = false
    }

    if (!batchFound) {
      throw new Error(
        'Timed out waiting for child transaction to be included in a batch'
      )
    }

    // Reverse trace: from child deposit tx back to parent tx
    const tracedParentTxHash =
      await childReceipt.getParentDepositTransactionHash(
        l2Provider,
        parentSigner.provider!
      )

    expect(tracedParentTxHash).to.not.be.null
    expect(tracedParentTxHash).to.eq(
      parentTxReceipt.transactionHash,
      'traced parent tx hash does not match original deposit tx hash'
    )
  })

  it('traces a retryable redeem child tx back to the parent tx', async () => {
    const {
      ethBridger,
      parentSigner,
      parentProvider,
      childChain,
      childSigner,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })

    await fundParentSigner(parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentSigner)
      await approveParentCustomFeeToken(parentSigner)
    }
    const destWallet = Wallet.createRandom()

    const ethToDeposit = scaleFrom18DecimalsToNativeTokenDecimals({
      amount: parseEther('0.0002'),
      decimals,
    })

    // depositTo creates a retryable ticket (not a simple ETH deposit)
    const res = await ethBridger.depositTo({
      amount: ethToDeposit,
      parentSigner: parentSigner,
      destinationAddress: destWallet.address,
      childProvider: childSigner.provider!,
    })
    const parentTxReceipt = await res.wait()
    expect(parentTxReceipt.status).to.equal(1, 'eth deposit parent txn failed')

    // Wait for the retryable to be redeemed
    const parentToChildMessages =
      await parentTxReceipt.getParentToChildMessages(childSigner.provider!)
    expect(parentToChildMessages.length).to.eq(
      1,
      'failed to find 1 parent-to-child message'
    )
    const parentToChildMessage = parentToChildMessages[0]

    const retryableTicketResult = await parentToChildMessage.waitForStatus()
    expect(retryableTicketResult.status).to.eq(
      ParentToChildMessageStatus.REDEEMED,
      'Retryable ticket not redeemed'
    )

    // Get the redeem tx hash from the retryable creation receipt
    const retryableTxReceipt =
      await childSigner.provider!.getTransactionReceipt(
        parentToChildMessage.retryableCreationId
      )
    const childRetryableTxReceipt = new ChildTransactionReceipt(
      retryableTxReceipt
    )
    const ticketRedeemEvents =
      childRetryableTxReceipt.getRedeemScheduledEvents()
    expect(ticketRedeemEvents.length).to.eq(
      1,
      'failed finding the redeem event'
    )

    const redeemTxHash = ticketRedeemEvents[0].retryTxHash

    // Reverse trace from the redeem tx back to the parent tx
    const redeemReceipt = await childSigner.provider!.getTransactionReceipt(
      redeemTxHash
    )
    const childRedeemReceipt = new ChildTransactionReceipt(redeemReceipt)
    const tracedParentTxHash =
      await childRedeemReceipt.getParentTransactionHash(
        childSigner.provider!,
        parentSigner.provider!
      )

    expect(tracedParentTxHash).to.not.be.null
    expect(tracedParentTxHash).to.eq(
      parentTxReceipt.transactionHash,
      'traced parent tx hash does not match original deposit tx hash (from redeem)'
    )

    // Also trace from the retryable ticket creation tx itself
    const ticketCreationReceipt = new ChildTransactionReceipt(
      retryableTxReceipt
    )
    const tracedFromTicket =
      await ticketCreationReceipt.getParentTransactionHash(
        childSigner.provider!,
        parentSigner.provider!
      )

    expect(tracedFromTicket).to.not.be.null
    expect(tracedFromTicket).to.eq(
      parentTxReceipt.transactionHash,
      'traced parent tx hash does not match original deposit tx hash (from ticket)'
    )
  })

  it('traces a withdrawal execution parent tx back to the child tx', async () => {
    const {
      childSigner,
      childChain,
      parentSigner,
      parentProvider,
      ethBridger,
    } = await testSetup()
    const decimals = await getNativeTokenDecimals({
      parentProvider,
      childNetwork: childChain,
    })
    await fundChildSigner(childSigner)
    await fundParentSigner(parentSigner)

    const ethToWithdraw = scaleFrom18DecimalsToNativeTokenDecimals({
      amount: parseEther('0.00000002'),
      decimals,
    })
    const randomAddress = Wallet.createRandom().address

    // Initiate withdrawal on child chain
    const withdrawEthRes = await ethBridger.withdraw({
      amount: ethToWithdraw,
      childSigner: childSigner,
      destinationAddress: randomAddress,
      from: await childSigner.getAddress(),
    })
    const withdrawEthRec = await withdrawEthRes.wait()
    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    const withdrawMessage = (
      await withdrawEthRec.getChildToParentMessages(parentSigner)
    )[0]
    expect(withdrawMessage, 'withdraw message not found').to.exist

    // Mine blocks on both chains until the withdrawal is confirmed
    const miner1 = Wallet.createRandom().connect(parentSigner.provider!)
    const miner2 = Wallet.createRandom().connect(childSigner.provider!)
    await fundParentSigner(miner1, parseEther('1'))
    await fundChildSigner(miner2, parseEther('1'))
    const state = { mining: true }
    await Promise.race([
      mineUntilStop(miner1, state),
      mineUntilStop(miner2, state),
      withdrawMessage.waitUntilReadyToExecute(childSigner.provider!),
    ])
    state.mining = false

    expect(
      await withdrawMessage.status(childSigner.provider!),
      'confirmed status'
    ).to.eq(ChildToParentMessageStatus.CONFIRMED)

    // Execute on parent chain
    const execTx = await withdrawMessage.execute(childSigner.provider!)
    const execRec = await execTx.wait()

    expect(
      await withdrawMessage.status(childSigner.provider!),
      'executed status'
    ).to.eq(ChildToParentMessageStatus.EXECUTED)

    // Reverse trace: from parent execution tx back to child withdrawal tx
    const parentExecReceipt = new ParentTransactionReceipt(execRec)
    const tracedChildTxHash =
      await parentExecReceipt.getChildWithdrawTransactionHash(
        childSigner.provider!,
        parentSigner.provider!
      )

    expect(tracedChildTxHash).to.not.be.null
    expect(tracedChildTxHash).to.eq(
      withdrawEthRec.transactionHash,
      'traced child tx hash does not match original withdrawal tx hash'
    )
  })

  it('returns null for a non-retryable child tx', async () => {
    const { childSigner, parentSigner } = await testSetup()
    await fundChildSigner(childSigner)

    // Send a plain child chain transfer (not a retryable)
    const randomAddress = Wallet.createRandom().address
    const tx = await childSigner.sendTransaction({
      to: randomAddress,
      value: parseEther('0.000001'),
    })
    const rec = await tx.wait()

    const childReceipt = new ChildTransactionReceipt(rec)
    const tracedParentTxHash = await childReceipt.getParentTransactionHash(
      childSigner.provider!,
      parentSigner.provider!
    )

    expect(tracedParentTxHash).to.be.null
  })

  it('returns null for a non-withdrawal-execution parent tx', async () => {
    const { parentSigner, childSigner } = await testSetup()
    await fundParentSigner(parentSigner)

    // Send a plain parent chain transfer (not a withdrawal execution)
    const randomAddress = Wallet.createRandom().address
    const tx = await parentSigner.sendTransaction({
      to: randomAddress,
      value: parseEther('0.000001'),
    })
    const rec = await tx.wait()

    const parentReceipt = new ParentTransactionReceipt(rec)
    const tracedChildTxHash =
      await parentReceipt.getChildWithdrawTransactionHash(
        childSigner.provider!,
        parentSigner.provider!
      )

    expect(tracedChildTxHash).to.be.null
  })
})
