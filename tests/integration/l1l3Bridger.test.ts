import { testSetup } from '../../scripts/testSetup'
import { Erc20L1L3Bridger, L1ToL2MessageStatus } from '../../src'
import { L2ForwarderContractsDeployer__factory } from '../../src/lib/abi/factories/L2ForwarderContractsDeployer__factory'
import { MockToken__factory } from '../../src/lib/abi/factories/MockToken__factory'
import { MockToken } from '../../src/lib/abi/MockToken'
import { Teleporter__factory } from '../../src/lib/abi/factories/Teleporter__factory'
import { fundL1, fundL2, skipIfMainnet } from './testHelpers'
import { ethers } from 'ethers'
import { EthL1L3Bridger } from '../../src/lib/assetBridger/l1l3Bridger'
import { expect } from 'chai'

type Unwrap<T> = T extends Promise<infer U> ? U : T

function poll(
  fn: () => Promise<boolean>,
  pollInterval: number
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const result = await fn()
        if (result === true) {
          clearInterval(interval)
          resolve(true)
        }
      } catch (e) {
        clearInterval(interval)
        reject(e)
      }
    }, pollInterval)
  })
}

describe('L1 to L3 Bridging', () => {
  let setup: Unwrap<ReturnType<typeof testSetup>>

  // setup for all test cases
  before(async function () {
    await skipIfMainnet(this)

    setup = await testSetup()

    // fund signers on L1 and L2
    await fundL1(setup.l1Signer, ethers.utils.parseEther('100'))
    await fundL2(setup.l2Signer, ethers.utils.parseEther('100'))
  })

  describe('ETH Bridging', () => {
    describe('EthL1L3Bridger', () => {
      let l1l3Bridger: EthL1L3Bridger

      before(() => {
        l1l3Bridger = new EthL1L3Bridger(setup.l3Network)
      })

      // send some eth to L3 with custom l3 recipient and l2 refund address
      // makes sure that appropriate amounts land at the right places
      it('happy path', async () => {
        const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))
        const l2RefundAddress = ethers.utils.hexlify(
          ethers.utils.randomBytes(20)
        )

        const depositTx = await l1l3Bridger.deposit(
          {
            amount: ethers.utils.parseEther('1'),
            destinationOverrides: {
              l3DestinationAddress: l3Recipient,
              l2RefundAddress: l2RefundAddress,
            },
          },
          setup.l1Signer,
          setup.l2Signer.provider!,
          setup.l3Signer.provider!
        )

        const depositReceipt = await depositTx.wait()

        // poll status
        await poll(async () => {
          const status = await l1l3Bridger.getDepositStatus(
            depositReceipt,
            setup.l2Signer.provider!,
            setup.l3Signer.provider!
          )
          return status.completed
        }, 1000)

        // check eth balances
        const l3Balance = await setup.l3Signer.provider!.getBalance(l3Recipient)
        expect(l3Balance.gt(ethers.utils.parseEther('1'))).to.be.true

        const l2Balance = await setup.l2Signer.provider!.getBalance(
          l2RefundAddress
        )
        expect(l2Balance.gt(ethers.utils.parseEther('0'))).to.be.true
      })
    })
  })

  describe('ERC20 Bridging', () => {
    let l1Token: MockToken

    // deploy teleporter contracts and mock token
    before(async function () {
      // deploy teleporter contracts (todo: this should maybe be done in gen:network in the future)
      const l2ContractsDeployer =
        await new L2ForwarderContractsDeployer__factory(setup.l2Signer).deploy()
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

      // deploy the mock token
      l1Token = await new MockToken__factory(setup.l1Signer).deploy(
        'MOCK',
        'MOCK',
        ethers.utils.parseEther('100'),
        await setup.l1Signer.getAddress()
      )
      await l1Token.deployed()
    })

    describe('Erc20L1L3Bridger', () => {
      let l1l3Bridger: Erc20L1L3Bridger

      // create the bridger and approve the teleporter
      before(async () => {
        l1l3Bridger = new Erc20L1L3Bridger(setup.l3Network)

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

      // should throw if gas overrides not passed when using non default gateway
      // test relayer stuff
      // don't need to test rescue here i think

      it('happy path', async () => {
        const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

        const depositTx = await l1l3Bridger.deposit(
          {
            erc20L1Address: l1Token.address,
            to: l3Recipient,
            amount: ethers.utils.parseEther('1'),
          },
          setup.l1Signer,
          setup.l2Signer.provider!,
          setup.l3Signer.provider!
        )

        const depositReceipt = await depositTx.wait()

        // poll status
        await poll(async () => {
          const status = await l1l3Bridger.getDepositStatus(
            depositReceipt,
            setup.l2Signer.provider!,
            setup.l3Signer.provider!
          )
          return status.completed
        }, 1000)

        // make sure the tokens have landed in the right place
        const l3TokenAddr = await l1l3Bridger.getL3ERC20Address(
          l1Token.address,
          setup.l1Signer.provider!,
          setup.l2Signer.provider!
        )
        const l3Token = l1l3Bridger.getL3TokenContract(
          l3TokenAddr,
          setup.l3Signer.provider!,
        )

        const l3Balance = await l3Token.balanceOf(l3Recipient)

        if (!l3Balance.eq(ethers.utils.parseEther('1').sub(1))) {
          throw new Error('L3 balance is incorrect')
        }
      })
    })
  })
})
