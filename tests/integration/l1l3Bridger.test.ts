import { testSetup } from '../../scripts/testSetup'
import {
  Erc20Bridger,
  L1ToL2Message,
  L1ToL2MessageStatus,
  L1TransactionReceipt,
  L1L3Bridger,
} from '../../src'
import { L2ForwarderContractsDeployer__factory } from '../../src/lib/abi/factories/L2ForwarderContractsDeployer__factory'
import { MockToken__factory } from '../../src/lib/abi/factories/MockToken__factory'
import { MockToken } from '../../src/lib/abi/MockToken'
import { Teleporter__factory } from '../../src/lib/abi/factories/Teleporter__factory'
import { fundL1, fundL2, skipIfMainnet } from './testHelpers'
import { ethers } from 'ethers'
import { L1ContractCallTransactionReceipt } from '../../src/lib/message/L1Transaction'

type Unwrap<T> = T extends Promise<infer U> ? U : T

describe('Teleporter', () => {
  let setup: Unwrap<ReturnType<typeof testSetup>>
  let l1l3Bridger: L1L3Bridger
  let l1Token: MockToken

  before(async function () {
    await skipIfMainnet(this)

    setup = await testSetup()

    // fund signers on L1 and L2
    await fundL1(setup.l1Signer, ethers.utils.parseEther('1'))
    await fundL2(setup.l2Signer, ethers.utils.parseEther('1'))

    // deploy teleporter contracts (todo: this should maybe be done in gen:network in the future)

    const l2ContractsDeployer = await new L2ForwarderContractsDeployer__factory(
      setup.l2Signer
    ).deploy()
    await l2ContractsDeployer.deployed()

    const l2ForwarderImplAddr = await l2ContractsDeployer.implementation()
    const l2ForwarderFactory = await l2ContractsDeployer.factory()

    const l1Teleporter = await new Teleporter__factory(setup.l1Signer).deploy(
      l2ForwarderFactory,
      l2ForwarderImplAddr
    )
    await l1Teleporter.deployed()

    // set the teleporter on the l2Network
    setup.l2Network.teleporterAddresses = {
      l1Teleporter: l1Teleporter.address,
      l2ForwarderFactory,
    }

    l1l3Bridger = new L1L3Bridger(setup.l3Network)

    // deploy the mock token
    l1Token = await new MockToken__factory(setup.l1Signer).deploy(
      'MOCK',
      'MOCK',
      ethers.utils.parseEther('100'),
      await setup.l1Signer.getAddress()
    )
    await l1Token.deployed()

    // approve the teleporter
    await (
      await l1Token
        .connect(setup.l1Signer)
        .approve(
          setup.l2Network.teleporterAddresses!.l1Teleporter,
          ethers.utils.parseEther('100')
        )
    ).wait()
  })

  it('L1 Teleporter should move tokens to L3 with correct parameters', async () => {
    const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

    // todo: rename to teleport?
    const depositTx = await l1l3Bridger.deposit(
      {
        l1Token: l1Token.address,
        to: l3Recipient,
        amount: ethers.utils.parseEther('1'),
      },
      setup.l1Signer,
      setup.l2Signer.provider!,
      setup.l3Signer.provider!
    )

    const depositReceipt = await depositTx.wait()

    // wait for l1 l2 messages to redeem
    console.log('waiting for l1 l2 messages to redeem')
    const l1l2Messages = await depositReceipt.getL1ToL2Messages(
      setup.l2Signer.provider!
    )

    if (
      (await l1l2Messages[0].waitForStatus()).status !==
      L1ToL2MessageStatus.REDEEMED
    ) {
      throw new Error('first L1 to L2 message not redeemed')
    }
    if (
      (await l1l2Messages[1].waitForStatus()).status !==
      L1ToL2MessageStatus.REDEEMED
    ) {
      throw new Error('second L1 to L2 message not redeemed')
    }

    // get l2 l3 message
    const secondRedeemReceipt = new L1ContractCallTransactionReceipt(
      (await l1l2Messages[1].getAutoRedeemAttempt())!
    )
    const l2l3Message = (
      await secondRedeemReceipt.getL1ToL2Messages(setup.l3Signer.provider!)
    )[0]

    // wait for l2 l3 message to be redeemed
    console.log('waiting for l2 l3 message to be redeemed')
    if (
      (await l2l3Message.waitForStatus()).status !==
      L1ToL2MessageStatus.REDEEMED
    ) {
      throw new Error('L2 to L3 message not redeemed')
    }

    // make sure the tokens have landed in the right place
    const l3TokenAddr = await l1l3Bridger.getL3ERC20Address(
      l1Token.address,
      setup.l1Signer.provider!,
      setup.l2Signer.provider!
    )
    const l3Token = l1l3Bridger.getL3TokenContract(
      setup.l3Signer.provider!,
      l3TokenAddr
    )

    const l3Balance = await l3Token.balanceOf(l3Recipient)

    if (!l3Balance.eq(ethers.utils.parseEther('1').sub(1))) {
      throw new Error('L3 balance is incorrect')
    }
  })

  // should throw if gas overrides not passed when using non default gateway
  // test relayer stuff
  // don't need to test rescue here i think
})
