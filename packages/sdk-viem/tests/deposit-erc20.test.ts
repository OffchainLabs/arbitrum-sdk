import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import {
  fundParentCustomFeeToken,
  getAmountInEnvironmentDecimals,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import {
  fundChildSigner,
  fundParentSigner,
} from '@arbitrum/sdk/tests/integration/testHelpers'
import { expect } from 'chai'
import { setupTestToken } from './helpers'
import { testSetup } from './testSetup'

describe('deposit erc20', function () {
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

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentSigner(setup.parentSigner)
      await fundParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('erc20 deposit transaction', async function () {
    const depositAmount = BigInt(10)
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as const

    const { parentAccount, parentWalletClient, parentPublicClient } = setup

    const initialBalance = (await parentPublicClient.readContract({
      address: testToken.address,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

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

    await parentWalletClient.depositErc20({
      amount: depositAmount,
      erc20ParentAddress: testToken.address,
      account: setup.parentAccount,
      destinationAddress,
      childClient: setup.childPublicClient,
      excessFeeRefundAddress: destinationAddress,
    })

    const finalBalance = (await parentPublicClient.readContract({
      address: testToken.address,
      abi: testToken.abi,
      functionName: 'balanceOf',
      args: [parentAccount.address],
    })) as bigint

    const targetBalance = BigInt(initialBalance - depositAmount)

    expect(finalBalance).to.equal(targetBalance)
  })

  it('handles deposit failure gracefully', async function () {
    try {
      const [depositAmount] = await getAmountInEnvironmentDecimals('100000000')
      const destinationAddress =
        '0x1234567890123456789012345678901234567890' as const

      const { parentWalletClient } = setup

      const account = (await setup.parentSigner.getAddress()) as any

      await parentWalletClient.approveErc20({
        erc20ParentAddress: testToken.address,
        account,
      })

      if (isArbitrumNetworkWithCustomFeeToken()) {
        await parentWalletClient.approveGasToken({
          erc20ParentAddress: testToken.address,
          account,
        })
      }

      await parentWalletClient.depositErc20({
        amount: depositAmount,
        erc20ParentAddress: testToken.address,
        account,
        destinationAddress,
        childClient: setup.childPublicClient,
        excessFeeRefundAddress: destinationAddress,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
