import { expect } from 'chai'
import { createWalletClient, http, parseEther, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../scripts/testSetup'
import { createArbitrumClient } from '../../src/experimental/createArbitrumClient'
import { fundParentSigner } from './testHelpers'
import {
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
  getAmountInEnvironmentDecimals,
  normalizeBalanceDiffByDecimals as normalizeBalanceDiffFByDecimals,
  approveCustomFeeTokenWithViem,
} from './custom-fee-token/customFeeTokenTestHelpers'

describe('arbitrumDepositActions', function () {
  let localEthChain: Chain
  let localArbChain: Chain
  let setup: Awaited<ReturnType<typeof testSetup>>

  before(async function () {
    setup = await testSetup()
    localEthChain = setup.localEthChain
    localArbChain = setup.localArbChain
  })

  beforeEach(async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentAccount.address)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('deposits ETH from parent to child using deposit action', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    const [depositAmount, tokenDecimals] = await getAmountInEnvironmentDecimals(
      '0.01'
    )

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

    const { childPublicClient, parentWalletClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentWalletClient: baseParentWalletClient,
      childWalletClient: baseChildWalletClient,
    })

    const initialBalance = await childPublicClient.getBalance({
      address: parentAccount.address,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await approveCustomFeeTokenWithViem({
        parentAccount,
        parentWalletClient,
        chain: localEthChain,
      })
    }

    const result = await parentWalletClient.depositEth({
      amount: depositAmount,
      account: parentAccount,
    })

    expect(result.status).to.equal('success')

    const finalBalance = await childPublicClient.getBalance({
      address: parentAccount.address,
    })

    const balanceDiff = finalBalance - initialBalance
    const normalizedBalanceDiff = normalizeBalanceDiffFByDecimals(
      balanceDiff,
      tokenDecimals
    )

    expect(normalizedBalanceDiff.toString()).to.equal(depositAmount.toString())
  })

  it('handles deposit failure gracefully', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    const depositAmount = parseEther('999999999')

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

    const { parentWalletClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentWalletClient: baseParentWalletClient,
      childWalletClient: baseChildWalletClient,
    })

    try {
      await parentWalletClient.depositEth({
        amount: depositAmount,
        account: parentAccount,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
