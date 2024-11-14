import { expect } from 'chai'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumDepositActions } from '../../src/experimental/arbitrumDeposit/actions'
import { testSetup, config } from '../../scripts/testSetup'
import { localEthChain, localArbChain } from '../../src/experimental/chains'

describe('arbitrumDepositActions', function() {
  this.timeout(60000)

  it('deposits ether', async function() {
    const { childChain } = await testSetup()

    const account = privateKeyToAccount(`0x${config.ethKey}` as `0x${string}`)

    // Create parent clients
    const parentWalletClient = createWalletClient({
      account,
      chain: localEthChain,
      transport: http(config.ethUrl)
    })

    const parentPublicClient = createPublicClient({
      chain: localEthChain,
      transport: http(config.ethUrl)
    }).extend(arbitrumDepositActions({
      ethBridge: {
        inbox: childChain.ethBridge.inbox as `0x${string}`
      }
    }))

    // Create child client for balance checks
    const childPublicClient = createPublicClient({
      chain: localArbChain,
      transport: http(config.arbUrl)
    })

    const initialBalance = await childPublicClient.getBalance({
      address: account.address
    })
    console.log('Initial child balance:', initialBalance)

    const depositAmount = parseEther('0.01')
    console.log('Deposit amount:', depositAmount)

    const hash = await parentPublicClient.depositEth({
      amount: depositAmount,
      account: account.address,
      walletClient: parentWalletClient
    })

    // Wait for parent transaction
    const receipt = await parentPublicClient.waitForTransactionReceipt({ 
      hash,
      confirmations: 1
    })

    expect(receipt.status).to.equal('success')

    // Poll for child balance change
    let finalBalance = initialBalance
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const currentBalance = await childPublicClient.getBalance({
        address: account.address
      })

      console.log(`Attempt ${attempts + 1} - Current balance:`, currentBalance)
      
      if (currentBalance > initialBalance) {
        finalBalance = currentBalance
        break
      }
      
      attempts++
    }

    console.log('Final child balance:', finalBalance)
    console.log('Balance difference:', finalBalance - initialBalance)

    expect(Number(finalBalance)).to.be.greaterThan(
      Number(initialBalance),
      'child balance did not increase after deposit'
    )
  })
}) 