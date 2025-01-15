import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import {
  fundParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import {
  fundChildSigner,
  fundParentSigner,
} from '@arbitrum/sdk/tests/integration/testHelpers'
import { expect } from 'chai'
import { setupTestToken } from './helpers'
import { testSetup } from './testSetup'
import { executeConfirmedWithdrawal } from './helpers'
import { Erc20Bridger } from '@arbitrum/sdk'
import { publicClientToProvider } from '@offchainlabs/ethers-viem-compat'

describe('withdraw erc20', function () {
  this.timeout(300000)

  let setup: Awaited<ReturnType<typeof testSetup>>
  let testToken: Awaited<ReturnType<typeof setupTestToken>>

  before('init', async () => {
    setup = await testSetup()
    registerCustomArbitrumNetwork(setup.childChain)

    await fundParentSigner(setup.parentSigner)
    await fundChildSigner(setup.childSigner)

    testToken = await setupTestToken(setup)
  })

  beforeEach(async function () {
    await fundParentSigner(setup.parentSigner)
    await fundChildSigner(setup.childSigner)

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentSigner(setup.parentSigner)
      await fundParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('erc20 withdraw transaction', async function () {
    const withdrawAmount = BigInt(10)
    const {
      parentAccount,
      childWalletClient,
      childPublicClient,
      parentPublicClient,
      parentWalletClient,
    } = setup

    // First deposit some tokens to withdraw
    await parentWalletClient.approveErc20({
      erc20ParentAddress: testToken.address,
      account: setup.parentAccount,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await parentWalletClient.approveGasToken({
        erc20ParentAddress: testToken.address,
        account: setup.parentAccount,
      })
    }

    const depositResult = await parentWalletClient.depositErc20({
      amount: withdrawAmount,
      erc20ParentAddress: testToken.address,
      account: setup.parentAccount,
      destinationAddress: parentAccount.address,
      childClient: setup.childPublicClient,
      excessFeeRefundAddress: parentAccount.address,
    })

    // Wait for deposit to complete and get child token address
    await parentPublicClient.waitForTransactionReceipt({
      hash: depositResult.hash,
    })

    const erc20Bridger = await Erc20Bridger.fromProvider(
      publicClientToProvider(setup.childPublicClient)
    )
    const childTokenAddress = await erc20Bridger.getChildErc20Address(
      testToken.address,
      publicClientToProvider(setup.parentPublicClient)
    )

    // Get initial balances - use child token address for child chain
    const initialChildBalance = (await childPublicClient.readContract({
      address: childTokenAddress as `0x${string}`,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

    const initialParentBalance = (await parentPublicClient.readContract({
      address: testToken.address,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

    // Perform withdrawal
    const result = await childWalletClient!.withdrawErc20({
      amount: withdrawAmount,
      erc20ParentAddress: testToken.address,
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

    // Check final balances - use child token address for child chain
    const finalChildBalance = (await childPublicClient.readContract({
      address: childTokenAddress as `0x${string}`,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

    const finalParentBalance = (await parentPublicClient.readContract({
      address: testToken.address,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

    // Child balance should have decreased by withdrawal amount
    expect(finalChildBalance).to.equal(initialChildBalance - withdrawAmount)

    // Parent balance should have increased by withdrawal amount
    expect(finalParentBalance).to.equal(initialParentBalance + withdrawAmount)
  })

  it('handles withdrawal failure gracefully', async function () {
    const { parentAccount, childWalletClient } = setup

    const withdrawAmount = BigInt('999999999999999999999999999999')

    try {
      await childWalletClient!.withdrawErc20({
        amount: withdrawAmount,
        erc20ParentAddress: testToken.address,
        destinationAddress: parentAccount.address,
        account: parentAccount,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
}) 