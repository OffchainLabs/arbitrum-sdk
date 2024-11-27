import { expect } from 'chai'
import { createWalletClient, http, parseEther, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  config,
  testSetup,
  getLocalNetworksFromFile,
} from '../../scripts/testSetup'
import { createArbitrumClient } from '../../src/experimental/createArbitrumClient'
import { fundParentSigner } from './testHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import {
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  isArbitrumNetworkWithCustomFeeToken,
  getAmountInEnvironmentDecimals,
  normalizeBalanceDiffByDecimals as normalizeBalanceDiffFByDecimals,
  approveCustomFeeTokenWithViem,
} from './custom-fee-token/customFeeTokenTestHelpers'
import { JsonRpcProvider } from '@ethersproject/providers'

const localNetworks = getLocalNetworksFromFile

describe.only('arbitrumDepositActions', function () {
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
    console.log('\n=== beforeEach setup ===')
    console.log('Parent Account:', parentAccount.address)
    console.log('Parent Signer:', await setup.parentSigner.getAddress())
    console.log(
      'Parent Provider URL:',
      (setup.parentProvider as JsonRpcProvider).connection.url
    )
    console.log(
      'Child Provider URL:',
      (setup.childProvider as JsonRpcProvider).connection.url
    )

    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      console.log('\n=== Custom Fee Token Setup ===')
      const nativeToken = localNetworks().l3Network?.nativeToken
      console.log('Native Token Address:', nativeToken)

      const tokenContract = ERC20__factory.connect(
        nativeToken!,
        setup.parentProvider
      )

      // Log token details
      const symbol = await tokenContract.symbol()
      const decimals = await tokenContract.decimals()
      const totalSupply = await tokenContract.totalSupply()
      console.log('Token Symbol:', symbol)
      console.log('Token Decimals:', decimals)
      console.log('Token Total Supply:', totalSupply.toString())

      // Log balances before funding
      const balanceBefore = await tokenContract.balanceOf(parentAccount.address)
      console.log('Balance Before Funding:', balanceBefore.toString())

      await fundParentCustomFeeToken(parentAccount.address)

      // Log balances after funding
      const balanceAfter = await tokenContract.balanceOf(parentAccount.address)
      console.log('Balance After Funding:', balanceAfter.toString())
      console.log('Funding Amount:', balanceAfter.sub(balanceBefore).toString())

      await approveParentCustomFeeToken(setup.parentSigner)

      // Log network details
      const network = localNetworks().l3Network!
      console.log('\n=== Network Configuration ===')
      console.log('Chain ID:', network.chainId)
      console.log('Bridge:', network.ethBridge.bridge)
      console.log('Inbox:', network.ethBridge.inbox)
      console.log('Native Token:', network.nativeToken)
    }
  })

  it('deposits ETH from parent to child using deposit action', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    console.log('\n=== Starting Deposit Test ===')
    console.log('Parent Account:', parentAccount.address)
    console.log('Test Environment:', {
      ORBIT_TEST: process.env.ORBIT_TEST,
      DECIMALS: process.env.DECIMALS,
    })

    const [depositAmount, tokenDecimals] = await getAmountInEnvironmentDecimals(
      '0.01'
    )
    console.log('\n=== Deposit Parameters ===')
    console.log('Deposit Amount:', depositAmount.toString())
    console.log('Token Decimals:', tokenDecimals)

    const baseParentWalletClient = createWalletClient({
      account: parentAccount,
      chain: localEthChain,
      transport: http(config.ethUrl),
    })

    console.log('\n=== Chain Configuration ===')
    console.log('Parent Chain:', {
      id: localEthChain.id,
      name: localEthChain.name,
      rpcUrl: config.ethUrl,
    })
    console.log('Child Chain:', {
      id: localArbChain.id,
      name: localArbChain.name,
      rpcUrl: config.arbUrl,
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
    console.log('\n=== Initial State ===')
    console.log('Initial Child Chain Balance:', initialBalance.toString())

    if (isArbitrumNetworkWithCustomFeeToken()) {
      const nativeToken = localNetworks().l3Network?.nativeToken
      const tokenContract = ERC20__factory.connect(
        nativeToken!,
        setup.parentProvider
      )

      // Get token details
      const symbol = await tokenContract.symbol()
      const decimals = await tokenContract.decimals()
      const balance = await tokenContract.balanceOf(parentAccount.address)
      const allowance = await tokenContract.allowance(
        parentAccount.address,
        localNetworks().l3Network!.ethBridge.inbox
      )

      console.log('\n=== Custom Fee Token State ===')
      console.log('Token Symbol:', symbol)
      console.log('Token Decimals:', decimals)
      console.log('Balance Before Deposit:', balance.toString())
      console.log('Current Allowance:', allowance.toString())
      console.log('Inbox Address:', localNetworks().l3Network!.ethBridge.inbox)
    }

    console.log('\n=== Approving Custom Fee Token ===')
    await approveCustomFeeTokenWithViem({
      parentAccount,
      parentWalletClient,
      chain: localEthChain,
    })

    if (isArbitrumNetworkWithCustomFeeToken()) {
      const nativeToken = localNetworks().l3Network?.nativeToken
      const tokenContract = ERC20__factory.connect(
        nativeToken!,
        setup.parentProvider
      )
      const allowance = await tokenContract.allowance(
        parentAccount.address,
        localNetworks().l3Network!.ethBridge.inbox
      )
      console.log('New Allowance After Approval:', allowance.toString())
    }

    console.log('\n=== Executing Deposit ===')
    const result = await parentWalletClient.depositEth({
      amount: depositAmount,
      account: parentAccount,
    })

    console.log('\n=== Deposit Result ===')
    console.log('Transaction Hash:', result.hash)
    console.log('Status:', result.status)
    console.log('Complete:', result.complete)
    if (result.message) {
      console.log('Message:', result.message)
    }

    expect(result.status).to.equal('success')

    const finalBalance = await childPublicClient.getBalance({
      address: parentAccount.address,
    })

    const balanceDiff = finalBalance - initialBalance
    const normalizedBalanceDiff = normalizeBalanceDiffFByDecimals(
      balanceDiff,
      tokenDecimals
    )

    console.log('\n=== Final State ===')
    console.log('Final Balance:', finalBalance.toString())
    console.log('Balance Difference:', balanceDiff.toString())
    console.log(
      'Normalized Balance Difference:',
      normalizedBalanceDiff.toString()
    )
    console.log('Expected Amount:', depositAmount.toString())

    if (isArbitrumNetworkWithCustomFeeToken()) {
      const nativeToken = localNetworks().l3Network?.nativeToken
      const tokenContract = ERC20__factory.connect(
        nativeToken!,
        setup.parentProvider
      )
      const finalTokenBalance = await tokenContract.balanceOf(
        parentAccount.address
      )
      console.log('Final Token Balance:', finalTokenBalance.toString())
    }

    expect(normalizedBalanceDiff.toString()).to.equal(depositAmount.toString())
  })

  it('handles deposit failure gracefully', async function () {
    const parentAccount = privateKeyToAccount(`0x${config.ethKey}`)
    // Use an amount too large to cause a failure
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
