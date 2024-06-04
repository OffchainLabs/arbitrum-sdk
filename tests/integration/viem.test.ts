import { expect } from 'chai'
import dotenv from 'dotenv'

import { parseEther } from '@ethersproject/units'
import { Wallet } from '@ethersproject/wallet'

import { testSetup } from '../../scripts/testSetup'
import {
  GatewayType,
  depositToken,
  fundL1,
  fundL2,
  skipIfMainnet,
} from './testHelpers'
import { L1ToL2MessageStatus } from '../../src'
import { TestERC20__factory } from '../../src/lib/abi/factories/TestERC20__factory'
import { BigNumber } from 'ethers'

dotenv.config()

// TODO: create better tests before merging

describe('useViemSigner', async () => {
  let testToken: any

  before('init', async () => {
    const setup = await testSetup()
    await fundL1(setup.l1Signer)
    await fundL2(setup.l2Signer)

    const deployErc20 = new TestERC20__factory().connect(setup.l1Signer)
    testToken = await deployErc20.deploy()
    await testToken.deployed()

    await (await testToken.mint()).wait()
  })

  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  it('deposits ether', async () => {
    const { ethBridger, l1Signer, l1WalletClient } = await testSetup()

    await fundL1(l1Signer)
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      l1Signer: l1WalletClient, // uses WalletClient from viem to create a ViemSigner in the decorator
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
  })

  it('deposits ether to a specific L2 address', async () => {
    const { ethBridger, l1Signer, l2Signer, l1WalletClient } = await testSetup()

    await fundL1(l1Signer)
    const destWallet = Wallet.createRandom()

    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.depositTo({
      amount: ethToDeposit,
      l1Signer: l1WalletClient, // uses WalletClient from viem to create a ViemSigner in the decorator
      destinationAddress: destWallet.address,
      l2Provider: l2Signer.provider!,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
  })
  it.skip('register custom token', async () => {
    const depositAmount = BigNumber.from(100)
    const { erc20Bridger, l1WalletClient, l2WalletClient } = await testSetup()
    await depositToken(
      depositAmount,
      testToken.address,
      erc20Bridger,
      l1WalletClient as any,
      l2WalletClient as any,
      L1ToL2MessageStatus.REDEEMED,
      GatewayType.STANDARD
    )
  })
})
