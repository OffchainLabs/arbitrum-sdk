import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import {
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  getAmountInEnvironmentDecimals,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import {
  fundParentSigner,
  fundChildSigner,
} from '@arbitrum/sdk/tests/integration/testHelpers'
import { config, testSetup } from '@arbitrum/sdk/tests/testSetup'
import { expect } from 'chai'
import { createWalletClient, http, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createArbitrumClient } from '../src/createArbitrumClient'
import { TestERC20__factory } from '@arbitrum/sdk/src/lib/abi/factories/TestERC20__factory'
import { TestERC20 } from '@arbitrum/sdk/src/lib/abi/TestERC20'

describe('deposit erc20', function () {
  this.timeout(300000)

  let localEthChain: Chain
  let localArbChain: Chain
  let setup: Awaited<ReturnType<typeof testSetup>>
  let testToken: TestERC20
  let parentAccount: ReturnType<typeof privateKeyToAccount>

  before('init', async () => {
    setup = await testSetup()
    localEthChain = setup.localEthChain
    localArbChain = setup.localArbChain
    registerCustomArbitrumNetwork(setup.childChain)
    parentAccount = privateKeyToAccount(`0x${config.ethKey}`)

    await fundParentSigner(setup.parentSigner)
    await fundChildSigner(setup.childSigner)
    const deployErc20 = new TestERC20__factory().connect(setup.parentDeployer)
    testToken = await deployErc20.deploy()
    await testToken.deployed()
    await (await testToken.mint()).wait()
  })

  beforeEach(async function () {
    await fundParentSigner(setup.parentSigner)
    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentCustomFeeToken(parentAccount.address)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('erc20 deposit transaction', async function () {
    const depositAmount = BigInt(100)
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as const

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

    const { parentWalletClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentWalletClient: baseParentWalletClient,
      childWalletClient: baseChildWalletClient,
    })

    const approveResult = await parentWalletClient.approveErc20({
      erc20ParentAddress: testToken.address,
      amount: depositAmount,
      account: parentAccount,
    })
    expect(approveResult.status).to.equal('success')

    const initialBalance = await testToken.balanceOf(parentAccount.address)
    const request = await parentWalletClient.depositErc20({
      amount: depositAmount,
      erc20ParentAddress: testToken.address,
      account: parentAccount,
      destinationAddress,
      childClient: childPublicClient,
    })
    expect(request.status).to.equal('success')

    const finalBalance = await testToken.balanceOf(parentAccount.address)
    expect(finalBalance.toString()).to.equal(
      (BigInt(initialBalance.toString()) - depositAmount).toString()
    )
  })

  it('handles deposit failure gracefully', async function () {
    const [depositAmount] = await getAmountInEnvironmentDecimals('0.01')

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

    const { parentWalletClient, childPublicClient } = createArbitrumClient({
      parentChain: localEthChain,
      childChain: localArbChain,
      parentWalletClient: baseParentWalletClient,
      childWalletClient: baseChildWalletClient,
    })

    try {
      await parentWalletClient.depositErc20({
        amount: depositAmount,
        erc20ParentAddress: testToken.address,
        account: parentAccount,
        childClient: childPublicClient,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
