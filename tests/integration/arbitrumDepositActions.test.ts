import { expect } from 'chai'
import { createWalletClient, http, parseEther, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../scripts/testSetup'
import { createArbitrumClient } from '../../src/experimental/createArbitrumClient'
import { fundParentSigner } from './testHelpers'

describe('arbitrumDepositActions', function () {
  let localEthChain: Chain
  let localArbChain: Chain

  before(async function () {
    const setup = await testSetup()
    localEthChain = setup.localEthChain
    localArbChain = setup.localArbChain
    await fundParentSigner(setup.parentSigner)
  })

  it('deposits ETH from parent to child', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const depositAmount = parseEther('0.01')

    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const { parentPublicClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentRpcUrl: config.ethUrl,
      childRpcUrl: config.arbUrl,
    })

    const initialBalance = await childPublicClient.getBalance({
      address: account.address,
    })

    const request = await childPublicClient.prepareDepositEthTransaction({
      amount: depositAmount,
      account,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
      account,
      kzg: undefined,
    } as const)

    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 12

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const currentBalance = await childPublicClient.getBalance({
        address: account.address,
      })

      if (currentBalance > initialBalance) {
        finalBalance = currentBalance
        break
      }

      attempts++
    }

    const balanceDiff = finalBalance - initialBalance
    expect(balanceDiff).to.equal(depositAmount)
  })

  it('deposits ETH from parent to a different child address', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as `0x${string}`
    const depositAmount = parseEther('0.01')

    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const { parentPublicClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentRpcUrl: config.ethUrl,
      childRpcUrl: config.arbUrl,
    })

    const initialBalance = await childPublicClient.getBalance({
      address: destinationAddress,
    })

    const request = await childPublicClient.prepareDepositEthToTransaction({
      amount: depositAmount,
      account: account.address,
      destinationAddress,
      parentPublicClient,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
      account,
      kzg: undefined,
    } as const)

    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 12

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const currentBalance = await childPublicClient.getBalance({
        address: destinationAddress,
      })

      if (currentBalance > initialBalance) {
        finalBalance = currentBalance
        break
      }

      attempts++
    }

    const balanceDiff = finalBalance - initialBalance
    expect(balanceDiff).to.equal(depositAmount)
  })
})
