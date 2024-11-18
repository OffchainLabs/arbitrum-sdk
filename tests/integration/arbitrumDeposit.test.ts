import { expect } from 'chai'
import { createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../scripts/testSetup'
import { localEthChain, localArbChain } from '../../src/experimental/chains'
import { createArbitrumClient } from '../../src/experimental/arbitrumDeposit/createArbitrumClient'

describe('arbitrumDepositActions', function () {
  before(async function () {
    await testSetup()
  })

  it('deposits ETH from L1 to L2', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const depositAmount = parseEther('0.01')

    // Create L1 wallet client
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create public clients using helper
    const { parentChainPublicClient, childChainPublicClient } =
      createArbitrumClient({
        parentChain: localEthChain,
        // @ts-expect-error
        childChain: localArbChain,
        parentRpcUrl: config.ethUrl,
        childRpcUrl: config.arbUrl,
      })

    // Get initial L2 balance
    const initialBalance = await childChainPublicClient.getBalance({
      address: account.address,
    })

    // Prepare and send deposit transaction
    // @ts-expect-error
    const request = await childChainPublicClient.prepareDepositEthTransaction({
      amount: depositAmount,
      account,
    })

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
    })

    // Wait for L1 transaction
    const receipt = await parentChainPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for L2 balance to increase
    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const currentBalance = await childChainPublicClient.getBalance({
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

  it('deposits ETH from L1 to a different L2 address', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as `0x${string}`
    const depositAmount = parseEther('0.01')

    // Create L1 wallet client
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create public clients using helper
    const { parentChainPublicClient, childChainPublicClient } =
      createArbitrumClient({
        parentChain: localEthChain,
        // @ts-expect-error
        childChain: localArbChain,
        parentRpcUrl: config.ethUrl,
        childRpcUrl: config.arbUrl,
      })

    // Get initial destination balance
    const initialBalance = await childChainPublicClient.getBalance({
      address: destinationAddress,
    })

    // Prepare and send deposit transaction
    // @ts-expect-error
    const request = await childChainPublicClient.prepareDepositEthToTransaction(
      {
        amount: depositAmount,
        account: account.address,
        destinationAddress,
        parentPublicClient: parentChainPublicClient,
      }
    )

    const hash = await parentWalletClient.sendTransaction({
      ...request,
      chain: localEthChain,
    })

    // Wait for L1 transaction
    const receipt = await parentChainPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for L2 balance to increase
    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

      const currentBalance = await childChainPublicClient.getBalance({
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
