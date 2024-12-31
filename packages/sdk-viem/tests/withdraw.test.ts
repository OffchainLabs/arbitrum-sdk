import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import {
  approveCustomFeeTokenWithViem,
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  getAmountInEnvironmentDecimals,
  isArbitrumNetworkWithCustomFeeToken,
  normalizeBalanceDiffByDecimals,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import { fundParentSigner } from '@arbitrum/sdk/tests/integration/testHelpers'
import { config, testSetup } from '@arbitrum/sdk/tests/testSetup'
import { expect } from 'chai'
import { createWalletClient, http, parseEther, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createArbitrumClient } from '../src/createArbitrumClient'
import { executeConfirmedWithdrawal } from './helpers'

describe('withdraw', function () {
  this.timeout(300000)

  let localEthChain: Chain
  let localArbChain: Chain
  let setup: Awaited<ReturnType<typeof testSetup>>

  before(async function () {
    setup = await testSetup()
    localEthChain = setup.localEthChain
    localArbChain = setup.localArbChain
    registerCustomArbitrumNetwork(setup.childChain)
  })

  beforeEach(async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentAccount.address)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('withdraws ETH from child to parent using withdraw action', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    const [withdrawAmount, tokenDecimals] =
      await getAmountInEnvironmentDecimals('0.01')

    const baseParentWalletClient = createWalletClient({
      account: parentAccount,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const baseChildWalletClient = createWalletClient({
      account: parentAccount,
      chain: localArbChain,
      transport: http(config.arbUrl),
    })

    const { parentPublicClient, childPublicClient, childWalletClient } =
      createArbitrumClient({
        parentChain: localEthChain,
        childChain: localArbChain,
        parentWalletClient: baseParentWalletClient,
        childWalletClient: baseChildWalletClient,
      })

    const initialParentBalance = await parentPublicClient.getBalance({
      address: parentAccount.address as `0x${string}`,
    })

    const initialChildBalance = await childPublicClient.getBalance({
      address: parentAccount.address as `0x${string}`,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveCustomFeeTokenWithViem({
        parentAccount,
        parentWalletClient: baseParentWalletClient,
        chain: localEthChain,
      })
    }

    // Start withdrawal
    const result = await childWalletClient!.withdrawEth({
      amount: withdrawAmount,
      destinationAddress: parentAccount.address,
      account: parentAccount,
    })

    expect(result.status).to.equal('success')
    expect(result.complete).to.equal(false)

    const receipt = await childPublicClient.waitForTransactionReceipt({
      hash: result.hash,
    })

    const { status } = await executeConfirmedWithdrawal(
      receipt,
      childPublicClient,
      parentPublicClient
    )

    expect(status).to.be.true

    const finalParentBalance = await parentPublicClient.getBalance({
      address: parentAccount.address as `0x${string}`,
    })

    const finalChildBalance = await childPublicClient.getBalance({
      address: parentAccount.address as `0x${string}`,
    })

    // Check that balance decreased on child chain
    const childBalanceDiff = finalChildBalance - initialChildBalance
    const normalizedChildBalanceDiff = normalizeBalanceDiffByDecimals(
      BigInt(childBalanceDiff),
      tokenDecimals
    )
    expect(normalizedChildBalanceDiff < BigInt(0)).to.be.true

    const parentBalanceDiff = finalParentBalance - initialParentBalance
    const normalizedParentBalanceDiff = normalizeBalanceDiffByDecimals(
      BigInt(parentBalanceDiff),
      tokenDecimals
    )

    if (isArbitrumNetworkWithCustomFeeToken()) {
      const maxExpectedDecrease = -withdrawAmount * BigInt(2)
      expect(normalizedParentBalanceDiff >= maxExpectedDecrease).to.be.true
    } else {
      expect(normalizedParentBalanceDiff >= withdrawAmount).to.be.true
    }
  })

  it('handles withdrawal failure gracefully', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    const withdrawAmount = parseEther('999999999')

    const baseParentWalletClient = createWalletClient({
      account: parentAccount,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const baseChildWalletClient = createWalletClient({
      account: parentAccount,
      chain: localArbChain,
      transport: http(config.arbUrl),
    })

    const { childWalletClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentWalletClient: baseParentWalletClient,
      childWalletClient: baseChildWalletClient,
    })

    try {
      await childWalletClient!.withdrawEth({
        amount: withdrawAmount,
        destinationAddress: parentAccount.address,
        account: parentAccount,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
