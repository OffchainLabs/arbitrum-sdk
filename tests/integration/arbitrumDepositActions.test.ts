import { expect } from 'chai'
import { createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../scripts/testSetup'
import { localEthChain, localArbChain } from '../../src/experimental/chains'
import { createArbitrumClient } from '../../src/experimental/createArbitrumClient'

describe('arbitrumDepositActions', function () {
  before(async function () {
    await testSetup()
  })

  it('deposits ETH from parent to child', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const depositAmount = parseEther('0.01')

    // Create parent wallet client
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create public clients using helper
    const { parentPublicClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      // @ts-expect-error
      childChain: localArbChain,
      parentRpcUrl: config.ethUrl,
      childRpcUrl: config.arbUrl,
    })

    // Get initial child balance
    const initialBalance = await childPublicClient.getBalance({
      address: account.address,
    })

    // Prepare and send deposit transaction
    // @ts-expect-error
    const request = await childPublicClient.prepareDepositEthTransaction({
      amount: depositAmount,
      account,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
    })

    // Wait for parent transaction
    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for child balance to increase
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

    // Create parent wallet client
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create public clients using helper
    const { parentPublicClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      // @ts-expect-error
      childChain: localArbChain,
      parentRpcUrl: config.ethUrl,
      childRpcUrl: config.arbUrl,
    })

    // Get initial destination balance
    const initialBalance = await childPublicClient.getBalance({
      address: destinationAddress,
    })

    // Prepare and send deposit transaction
    // @ts-expect-error
    const request = await childPublicClient.prepareDepositEthToTransaction({
      amount: depositAmount,
      account: account.address,
      destinationAddress,
      parentPublicClient,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
    })

    // Wait for parent transaction
    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for child balance to increase
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
