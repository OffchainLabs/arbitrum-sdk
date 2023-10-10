import { config, testSetup } from '../../scripts/testSetup'
import { Erc20L1L3Bridger, L1ToL2MessageStatus } from '../../src'
import { L2ForwarderContractsDeployer__factory } from '../../src/lib/abi/factories/L2ForwarderContractsDeployer__factory'
import { MockToken__factory } from '../../src/lib/abi/factories/MockToken__factory'
import { MockToken } from '../../src/lib/abi/MockToken'
import { Teleporter__factory } from '../../src/lib/abi/factories/Teleporter__factory'
import { fundL1, fundL2, skipIfMainnet } from './testHelpers'
import { ethers } from 'ethers'
import {
  EthL1L3Bridger,
  RelayedErc20L1L3Bridger,
} from '../../src/lib/assetBridger/l1l3Bridger'
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
  const l2JsonRpcProvider = new ethers.providers.JsonRpcProvider(config.arbUrl)

  // setup for all test cases
  before(async function () {
    await skipIfMainnet(this)

    setup = await testSetup()

    // fund signers on L1 and L2
    await fundL1(setup.l1Signer, ethers.utils.parseEther('1'))
    await fundL2(setup.l2Signer, ethers.utils.parseEther('1'))
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
            amount: ethers.utils.parseEther('0.1'),
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
        expect(l3Balance.gt(ethers.utils.parseEther('0.1'))).to.be.true

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

    describe('BaseErc20L1L3Bridger', () => {
      // use Erc20L1L3Bridger to test base class
      let l1l3Bridger: Erc20L1L3Bridger

      // create the bridger and approve the teleporter
      before(async () => {
        l1l3Bridger = new Erc20L1L3Bridger(setup.l3Network)
      })

      it('getL2ERC20Address', async () => {
        // use weth to test, since we already know its addresses
        const l1Weth = setup.l2Network.tokenBridge.l1Weth
        const l2Weth = setup.l2Network.tokenBridge.l2Weth
        const ans = await l1l3Bridger.getL2ERC20Address(l1Weth, setup.l1Signer.provider!)
        expect(ans).to.eq(l2Weth)
      })

      it('getL3ERC20Address', async () => {
        // use weth to test, since we already know its addresses
        const l1Weth = setup.l2Network.tokenBridge.l1Weth
        const l3Weth = setup.l3Network.tokenBridge.l2Weth
        const ans = await l1l3Bridger.getL3ERC20Address(l1Weth, setup.l1Signer.provider!, setup.l2Signer.provider!)
        expect(ans).to.eq(l3Weth)
      })

      it('getL1L2GatewayAddress', async () => {
        // test weth and default gateway
        const l1Weth = setup.l2Network.tokenBridge.l1Weth
        const l1l2WethGateway = setup.l2Network.tokenBridge.l1WethGateway

        const wethAns = await l1l3Bridger.getL1L2GatewayAddress(l1Weth, setup.l1Signer.provider!)

        expect(wethAns).to.eq(l1l2WethGateway)

        // test default gateway
        const l1l2Gateway = setup.l2Network.tokenBridge.l1ERC20Gateway
        const defaultAns = await l1l3Bridger.getL1L2GatewayAddress(l1Token.address, setup.l1Signer.provider!)
        expect(defaultAns).to.eq(l1l2Gateway)
      })

      it('getL2L3GatewayAddress', async () => {
        // test weth and default gateway
        const l1Weth = setup.l2Network.tokenBridge.l1Weth
        const l2l3WethGateway = setup.l3Network.tokenBridge.l1WethGateway

        const wethAns = await l1l3Bridger.getL2L3GatewayAddress(l1Weth, setup.l1Signer.provider!, setup.l2Signer.provider!)

        expect(wethAns).to.eq(l2l3WethGateway)

        // test default gateway
        const l2l3Gateway = setup.l3Network.tokenBridge.l1ERC20Gateway
        const defaultAns = await l1l3Bridger.getL2L3GatewayAddress(l1Token.address, setup.l1Signer.provider!, setup.l2Signer.provider!)
        expect(defaultAns).to.eq(l2l3Gateway)
      })

      // todo: disabled
      
    })

    describe('Erc20L1L3Bridger', () => {
      let l1l3Bridger: Erc20L1L3Bridger

      // create the bridger and approve the teleporter
      before(async () => {
        l1l3Bridger = new Erc20L1L3Bridger(setup.l3Network)
      })

      it('approves', async () => {
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
            l2JsonRpcProvider,
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
          setup.l3Signer.provider!
        )

        const l3Balance = await l3Token.balanceOf(l3Recipient)

        if (!l3Balance.eq(ethers.utils.parseEther('1').sub(1))) {
          throw new Error('L3 balance is incorrect')
        }
      })
    })

    describe('RelayedErc20L1L3Bridger', () => {
      let l1l3Bridger: RelayedErc20L1L3Bridger

      // create the bridger and approve the teleporter
      before(async () => {
        l1l3Bridger = new RelayedErc20L1L3Bridger(setup.l3Network)
      })

      it('approves', async () => {
        await (
          await l1l3Bridger.approveToken(
            {
              erc20L1Address: l1Token.address,
            },
            setup.l1Signer
          )
        ).wait()
      })

      // should throw if gas overrides not passed when using non default gateway
      // test relayer stuff
      // don't need to test rescue here i think

      it('happy path', async () => {
        const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

        const depositResult = await l1l3Bridger.deposit(
          {
            erc20L1Address: l1Token.address,
            to: l3Recipient,
            amount: ethers.utils.parseEther('1'),
          },
          setup.l1Signer,
          setup.l2Signer.provider!,
          setup.l3Signer.provider!
        )

        const depositReceipt = await depositResult.tx.wait()

        // wait until first leg finishes
        await poll(async () => {
          const status = await l1l3Bridger.getDepositStatus(
            depositReceipt,
            l2JsonRpcProvider,
            setup.l3Signer.provider!
          )
          return status.bridgeToL2.status === L1ToL2MessageStatus.REDEEMED
        }, 1000)

        // make sure status shows that l2 forwarder hasn't been called yet
        expect(
          (
            await l1l3Bridger.getDepositStatus(
              depositReceipt,
              l2JsonRpcProvider,
              setup.l3Signer.provider!
            )
          ).l2ForwarderCall
        ).to.be.undefined

        // relay
        const relayTx = await RelayedErc20L1L3Bridger.relayDeposit(
          depositResult.relayerInfo,
          setup.l2Signer
        )

        await relayTx.wait()

        // make sure status is updated
        expect(
          await l1l3Bridger.getDepositStatus(
            depositReceipt,
            l2JsonRpcProvider,
            setup.l3Signer.provider!
          )
        ).to.be.not.undefined

        // wait for third leg to finish
        await poll(async () => {
          const status = await l1l3Bridger.getDepositStatus(
            depositReceipt,
            l2JsonRpcProvider,
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
          setup.l3Signer.provider!
        )

        const l3Balance = await l3Token.balanceOf(l3Recipient)

        if (!l3Balance.eq(ethers.utils.parseEther('1'))) {
          throw new Error('L3 balance is incorrect')
        }
      })
    })
  })
})
