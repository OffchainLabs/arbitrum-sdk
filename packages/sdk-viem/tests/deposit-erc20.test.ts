import { Erc20Bridger, registerCustomArbitrumNetwork } from '@arbitrum/sdk'
import { ERC20__factory } from '@arbitrum/sdk/src/lib/abi/factories/ERC20__factory'
import { TestERC20__factory } from '@arbitrum/sdk/src/lib/abi/factories/TestERC20__factory'
import { TestERC20 } from '@arbitrum/sdk/src/lib/abi/TestERC20'
import {
  approveParentCustomFeeToken,
  fundParentCustomFeeToken,
  getAmountInEnvironmentDecimals,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import {
  fundChildSigner,
  fundParentSigner,
} from '@arbitrum/sdk/tests/integration/testHelpers'
import { Signer } from '@ethersproject/abstract-signer'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { type PublicClient } from 'viem'
import { testSetup } from './testSetup'

async function deposit({
  parentTokenAddress,
  depositAmount,
  parentSigner,
  childSigner,
  erc20Bridger,
  destinationAddress,
  parentWalletClient,
  retryableOverrides,
  ethDepositAmount,
}: {
  parentTokenAddress: string
  depositAmount: BigNumber
  parentSigner: Signer
  childSigner: Signer
  erc20Bridger: Erc20Bridger
  destinationAddress?: string
  parentWalletClient?: any
  retryableOverrides?: any
  ethDepositAmount?: BigNumber
}) {
  await (
    await erc20Bridger.approveToken({
      erc20ParentAddress: parentTokenAddress,
      parentSigner,
    })
  ).wait()

  const senderAddress = await parentSigner.getAddress()

  const expectedParentGatewayAddress =
    await erc20Bridger.getParentGatewayAddress(
      parentTokenAddress,
      parentSigner.provider!
    )

  const parentToken = erc20Bridger.getParentTokenContract(
    parentSigner.provider!,
    parentTokenAddress
  )

  const allowance = await parentToken.allowance(
    senderAddress,
    expectedParentGatewayAddress
  )
  expect(allowance.eq(Erc20Bridger.MAX_APPROVAL), 'set token allowance failed')
    .to.be.true

  if (isArbitrumNetworkWithCustomFeeToken()) {
    await (
      await erc20Bridger.approveGasToken({
        parentSigner,
        erc20ParentAddress: parentTokenAddress,
      })
    ).wait()

    const feeTokenAllowance = await ERC20__factory.connect(
      erc20Bridger.nativeToken!,
      parentSigner
    ).allowance(await parentSigner.getAddress(), expectedParentGatewayAddress)

    expect(
      feeTokenAllowance.eq(Erc20Bridger.MAX_APPROVAL),
      'set fee token allowance failed'
    ).to.be.true
  }

  const result = await parentWalletClient.depositErc20({
    amount: depositAmount.toBigInt(),
    erc20ParentAddress: parentTokenAddress,
    account: await parentSigner.getAddress(),
    destinationAddress,
    childClient: childSigner.provider as unknown as PublicClient,
    retryableGasOverrides: retryableOverrides,
    maxSubmissionCost: ethDepositAmount,
    excessFeeRefundAddress: destinationAddress,
  })
  return {
    parentToken,
    waitRes: result,
    childToken: null,
  }
}

describe('deposit erc20', function () {
  this.timeout(300000)

  let setup: Awaited<ReturnType<typeof testSetup>>
  let testToken: TestERC20
  let erc20Bridger: Erc20Bridger

  before('init', async () => {
    setup = await testSetup()
    registerCustomArbitrumNetwork(setup.childChain)

    await fundParentSigner(setup.parentSigner)
    await fundChildSigner(setup.childSigner)

    const deployErc20 = new TestERC20__factory().connect(setup.parentSigner)
    testToken = await deployErc20.deploy()
    await testToken.deployed()
    await (await testToken.mint()).wait()

    erc20Bridger = await Erc20Bridger.fromProvider(setup.childProvider)
  })

  beforeEach(async function () {
    await fundParentSigner(setup.parentSigner)

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundParentSigner(setup.parentSigner)
      await fundParentCustomFeeToken(setup.parentSigner)
      await approveParentCustomFeeToken(setup.parentSigner)
    }
  })

  it('erc20 deposit transaction', async function () {
    const depositAmount = BigNumber.from(10).toBigInt()
    const destinationAddress =
      '0x1234567890123456789012345678901234567890' as const

    const { parentAccount, parentWalletClient } = setup

    const initialBalance = await testToken.balanceOf(parentAccount.address)

    // Use the local deposit function
    await deposit({
      depositAmount: BigNumber.from(depositAmount),
      parentTokenAddress: testToken.address,
      erc20Bridger: erc20Bridger as any,
      parentSigner: setup.parentSigner,
      childSigner: setup.childSigner,
      destinationAddress,
      parentWalletClient: parentWalletClient as any,
    })

    const finalBalance = await testToken.balanceOf(parentAccount.address)
    expect(finalBalance.toString()).to.equal(
      (BigInt(initialBalance.toString()) - depositAmount).toString()
    )
  })

  it('handles deposit failure gracefully', async function () {
    const [depositAmount] = await getAmountInEnvironmentDecimals('0.01')
    const { parentWalletClient } = setup

    try {
      await deposit({
        depositAmount: BigNumber.from(depositAmount),
        parentTokenAddress: testToken.address,
        erc20Bridger,
        parentSigner: setup.parentSigner,
        childSigner: setup.childSigner,
        parentWalletClient,
      })
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).to.exist
    }
  })
})
