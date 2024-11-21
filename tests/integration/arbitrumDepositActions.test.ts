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
} from './custom-fee-token/customFeeTokenTestHelpers'

describe('arbitrumDepositActions', function () {
  let localEthChain: Chain
  let localArbChain: Chain

  before(async function () {
    const setup = await testSetup()
    localEthChain = setup.localEthChain
    localArbChain = setup.localArbChain

    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(setup.parentSigner)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('deposits ETH from parent to child and waits for completion', async function () {
    const parentAccount = privateKeyToAccount(
      `0x${config.ethKey}` as `0x${string}`
    )
    const depositAmount = parseEther('0.01')

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

    const request = await childPublicClient.prepareDepositEthTransaction({
      amount: depositAmount,
      account: parentAccount,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
      account: parentAccount,
    })

    const result = await parentWalletClient.waitForCrossChainTransaction({
      hash,
    })

    expect(result.status).to.equal('success')
    expect(result.complete).to.be.true

    const finalBalance = await childPublicClient.getBalance({
      address: parentAccount.address,
    })

    const balanceDiff = finalBalance - initialBalance
    expect(balanceDiff).to.equal(depositAmount)
  })
})
