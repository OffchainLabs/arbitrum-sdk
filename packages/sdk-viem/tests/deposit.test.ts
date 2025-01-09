import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import {
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import { fundParentSigner } from '@arbitrum/sdk/tests/integration/testHelpers'
import { expect } from 'chai'
import { parseEther } from 'viem'
import {
  approveCustomFeeTokenWithViem,
  getAmountInEnvironmentDecimals,
  normalizeBalanceDiffByDecimals,
} from './customFeeTokenTestHelpers'
import { testSetup } from './testSetup'

describe('deposit', function () {
  this.timeout(300000)

  let setup: Awaited<ReturnType<typeof testSetup>>

  before(async function () {
    setup = await testSetup()
    registerCustomArbitrumNetwork(setup.childChain)
  })

  beforeEach(async function () {
    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(setup.parentAccount.address)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('deposits ETH from parent to child using deposit action', async function () {
    const [depositAmount, tokenDecimals] = await getAmountInEnvironmentDecimals(
      '0.01'
    ) 

    const { childPublicClient, parentWalletClient } = setup

    const initialBalance = await childPublicClient.getBalance({
      address: setup.parentAccount.address,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveCustomFeeTokenWithViem({
        parentAccount: setup.parentAccount,
        parentWalletClient,
        chain: setup.localEthChain,
      })
    }

    const result = await parentWalletClient.depositEth({
      amount: depositAmount,
      account: setup.parentAccount,
    })

    expect(result.status).to.equal('success')

    const finalBalance = await childPublicClient.getBalance({
      address: setup.parentAccount.address,
    })

    const balanceDiff = finalBalance - initialBalance
    const normalizedBalanceDiff = normalizeBalanceDiffByDecimals(
      BigInt(balanceDiff),
      tokenDecimals
    )

    expect(normalizedBalanceDiff.toString()).to.equal(depositAmount.toString())
  })

  it('handles deposit failure gracefully', async function () {
    const depositAmount = parseEther('999999999')

    const { parentWalletClient } = setup

    try {
      await parentWalletClient.depositEth({
        amount: depositAmount,
        account: setup.parentAccount,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
