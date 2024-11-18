import { expect } from 'chai'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../scripts/testSetup'
import { arbitrumDepositActions } from '../../src/experimental/arbitrumDeposit/actions'
import { localEthChain, localArbChain } from '../../src/experimental/chains'

describe('arbitrumDepositActions', function () {
  before(async function () {
    await testSetup()
  })

  it('deposits ETH from L1 to L2', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const depositAmount = parseEther('0.01')

    // Create L1 clients
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const parentPublicClient = createPublicClient({
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create L2 client and extend with deposit actions
    const childPublicClient = createPublicClient({
      chain: localArbChain,
      transport: http(config.arbUrl),
    }).extend(arbitrumDepositActions())

    // Get initial L2 balance
    const initialBalance = await childPublicClient.getBalance({
      address: account.address,
    })

    // Prepare and send deposit transaction
    const request = await childPublicClient.prepareDepositEthTransaction({
      amount: depositAmount,
      account,
    })

    const hash = await parentWalletClient.sendTransaction(request)

    // Wait for L1 transaction
    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for L2 balance to increase
    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

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

  it('deposits ETH from L1 to a different L2 address', async function () {
    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as `0x${string}`
    const depositAmount = parseEther('0.01')

    // Create L1 clients
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    const parentPublicClient = createPublicClient({
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    // Create L2 client and extend with deposit actions
    const childPublicClient = createPublicClient({
      chain: localArbChain,
      transport: http(config.arbUrl),
    }).extend(arbitrumDepositActions())

    // Get initial destination balance
    const initialBalance = await childPublicClient.getBalance({
      address: destinationAddress,
    })

    // Prepare and send deposit transaction
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

    // Wait for L1 transaction
    const receipt = await parentPublicClient.waitForTransactionReceipt({
      hash,
    })

    expect(receipt.status).to.equal('success')

    // Wait for L2 balance to increase
    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

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
