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

describe('depositTo', function () {
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

  it('deposits ETH from parent to a specified address on child using depositTo action', async function () {
    const [depositAmount, tokenDecimals] = await getAmountInEnvironmentDecimals(
      '0.01'
    )

    const { childPublicClient, parentWalletClient } = setup
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as const

    const initialBalance = await childPublicClient.getBalance({
      address: destinationAddress,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveCustomFeeTokenWithViem({
        parentAccount: setup.parentAccount,
        parentWalletClient,
        chain: setup.localEthChain,
      })
    }

    const result = await parentWalletClient.depositEthTo({
      amount: depositAmount,
      account: setup.parentAccount,
      destinationAddress,
    })

    expect(result.status).to.equal('success')

    const finalBalance = await childPublicClient.getBalance({
      address: destinationAddress,
    })

    const balanceDiff = finalBalance - initialBalance
    const normalizedBalanceDiff = normalizeBalanceDiffByDecimals(
      BigInt(balanceDiff),
      tokenDecimals
    )

    expect(normalizedBalanceDiff.toString()).to.equal(depositAmount.toString())
  })

  it('handles depositTo failure gracefully', async function () {
    const depositAmount = parseEther('999999999')
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as const

    const { parentWalletClient } = setup

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveCustomFeeTokenWithViem({
        parentAccount: setup.parentAccount,
        parentWalletClient,
        chain: setup.localEthChain,
      })
    }

    try {
      await parentWalletClient.depositEthTo({
        amount: depositAmount,
        account: setup.parentAccount,
        destinationAddress,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
