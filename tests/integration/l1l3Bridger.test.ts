import { getSigner, testSetup } from '../../scripts/testSetup'
import { Address, Erc20Bridger, Erc20L1L3Bridger, L2Network } from '../../src'
import { L2ForwarderContractsDeployer__factory } from '../../src/lib/abi/factories/L2ForwarderContractsDeployer__factory'
import { TestERC20__factory } from '../../src/lib/abi/factories/TestERC20__factory'
import { TestERC20 } from '../../src/lib/abi/TestERC20'
import { L1Teleporter__factory } from '../../src/lib/abi/factories/L1Teleporter__factory'
import { fundL1, fundL2, skipIfMainnet } from './testHelpers'
import { BigNumber, Signer, ethers } from 'ethers'
import { EthL1L3Bridger } from '../../src/lib/assetBridger/l1l3Bridger'
import { assert, expect } from 'chai'
import { isL2NetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'

type Unwrap<T> = T extends Promise<infer U> ? U : T

async function expectPromiseToReject(
  promise: Promise<any>,
  message?: string
): Promise<Error> {
  let err: Error | undefined = undefined
  try {
    await promise
  } catch (e: any) {
    err = e
  }
  if (!err) throw new Error(message || 'Promise did not reject')
  return err
}

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

async function deployTeleportContracts(l1Signer: Signer, l2Signer: Signer) {
  // predict the teleporter address
  const predL1Teleporter = ethers.utils.getContractAddress({
    from: await l1Signer.getAddress(),
    nonce: await l1Signer.getTransactionCount(),
  })

  const l2ContractsDeployer = await new L2ForwarderContractsDeployer__factory(
    l2Signer
  ).deploy(new Address(predL1Teleporter).applyAlias().value)
  await l2ContractsDeployer.deployed()

  const l1Teleporter = await new L1Teleporter__factory(l1Signer).deploy(
    await l2ContractsDeployer.factory(),
    await l2ContractsDeployer.implementation()
  )
  await l1Teleporter.deployed()

  return {
    l1Teleporter,
    l2ContractsDeployer,
  }
}

describe('L1 to L3 Bridging', () => {
  // If we are not testing in orbit mode, don't run any of the teleporter tests
  if (process.env.ORBIT_TEST !== '1') return

  // let setup: Unwrap<ReturnType<typeof testSetup>>
  const l2JsonRpcProvider = new ethers.providers.JsonRpcProvider(
    process.env['ARB_URL']
  )
  let l2Network: L2Network
  let l3Network: L2Network

  let l1Signer: ethers.Signer
  let l2Signer: ethers.Signer
  let l3Provider: ethers.providers.JsonRpcProvider

  // setup for all test cases
  before(async function () {
    await skipIfMainnet(this)

    const setup = await testSetup()

    l2Network = setup.l1Network as L2Network
    l3Network = setup.l2Network

    l1Signer = getSigner(
      new ethers.providers.JsonRpcProvider(process.env['ETH_URL']),
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )
    l2Signer = getSigner(
      l2JsonRpcProvider,
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )
    l3Provider = new ethers.providers.JsonRpcProvider(process.env['ORBIT_URL'])

    // fund signers on L1 and L2
    await fundL1(l1Signer, ethers.utils.parseEther('10'))
    await fundL2(l2Signer, ethers.utils.parseEther('10'))
  })

  describe('EthL1L3Bridger', () => {
    if (isL2NetworkWithCustomFeeToken()) return

    let l1l3Bridger: EthL1L3Bridger

    before(() => {
      l1l3Bridger = new EthL1L3Bridger(l3Network)
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
          to: l3Recipient,
          l2RefundAddress: l2RefundAddress,
        },
        l1Signer,
        l2Signer.provider!,
        l3Provider
      )

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositStatus(
          depositReceipt,
          l2Signer.provider!,
          l3Provider
        )
        return status.completed
      }, 1000)

      // check eth balances
      const l3Balance = await l3Provider.getBalance(l3Recipient)
      expect(l3Balance.gt(ethers.utils.parseEther('0.1'))).to.be.true

      const l2Balance = await l2Signer.provider!.getBalance(l2RefundAddress)
      expect(l2Balance.gt(ethers.utils.parseEther('0'))).to.be.true
    })
  })

  describe('ERC20 Bridging', () => {
    let l1Token: TestERC20
    const amount = BigNumber.from(100)
    let l1l3Bridger: Erc20L1L3Bridger

    // deploy teleporter contracts and mock token
    before(async function () {
      const { l2ContractsDeployer, l1Teleporter } =
        await deployTeleportContracts(l1Signer, l2Signer)

      const l2ForwarderImplAddr = await l2ContractsDeployer.implementation()
      const l2ForwarderFactory = await l2ContractsDeployer.factory()

      // set the teleporter on the l2Network
      l2Network.teleporterAddresses = {
        l1Teleporter: l1Teleporter.address,
        l2ForwarderFactory,
      }

      // deploy the mock token
      l1Token = await new TestERC20__factory(l1Signer).deploy()
      await l1Token.deployed()
      await (await l1Token.connect(l1Signer).mint()).wait()

      l1l3Bridger = new Erc20L1L3Bridger(l3Network)
    })

    if (isL2NetworkWithCustomFeeToken()) {
      it('should properly get l2 and l1 fee token addresses', async () => {
        if (l1l3Bridger.l2FeeTokenAddress === undefined) {
          throw new Error('L2 fee token address is undefined')
        }
        // make sure l2 token equals l3 native token
        expect(
          l1l3Bridger.l2FeeTokenAddress
        ).to.eq(l3Network.nativeToken)
        // make sure l1 token maps to l2 token
        expect(
          await new Erc20Bridger(l2Network).getL2ERC20Address(
            await l1l3Bridger.l1FeeTokenAddress(l2Signer.provider!),
            l1Signer.provider!
          )
        ).to.eq(l1l3Bridger.l2FeeTokenAddress)
      })
    } else {
      it('should not have l1 and l2 fee token addresses', async () => {
        // make sure l2 is undefined and l1 throws
        expect(l1l3Bridger.l2FeeTokenAddress).to.be.undefined
        const err = await expectPromiseToReject(
          l1l3Bridger.l1FeeTokenAddress(l2Signer.provider!),
          'Did not throw when getting l1 fee token address'
        )
        expect(err.message).to.eq(
          `L3 network ${l3Network.name} uses ETH for fees`
        )
      })
    }

    it('getL2ERC20Address', async () => {
      // use weth to test, since we already know its addresses
      const l1Weth = l2Network.tokenBridge.l1Weth
      const l2Weth = l2Network.tokenBridge.l2Weth
      const ans = await l1l3Bridger.getL2ERC20Address(
        l1Weth!, // todo handle undefined
        l1Signer.provider!
      )
      expect(ans).to.eq(l2Weth)
    })

    it('getL1L2GatewayAddress', async () => {
      // test weth and default gateway
      const l1Weth = l2Network.tokenBridge.l1Weth
      const l1l2WethGateway = l2Network.tokenBridge.l1WethGateway

      const wethAns = await l1l3Bridger.getL1L2GatewayAddress(
        l1Weth!, // todo handle undefined
        l1Signer.provider!
      )

      expect(wethAns).to.eq(l1l2WethGateway)

      // test default gateway
      const l1l2Gateway = l2Network.tokenBridge.l1ERC20Gateway
      const defaultAns = await l1l3Bridger.getL1L2GatewayAddress(
        l1Token.address,
        l1Signer.provider!
      )
      expect(defaultAns).to.eq(l1l2Gateway)
    })

    if (!isL2NetworkWithCustomFeeToken()) {
      it('getL3ERC20Address', async () => {
        // use weth to test, since we already know its addresses
        const l1Weth = l2Network.tokenBridge.l1Weth
        const l3Weth = l3Network.tokenBridge.l2Weth
        const ans = await l1l3Bridger.getL3ERC20Address(
          l1Weth!, // todo handle undefined
          l1Signer.provider!,
          l2Signer.provider!
        )
        expect(ans).to.eq(l3Weth)
      })

      it('getL2L3GatewayAddress', async () => {
        // test weth and default gateway
        const l1Weth = l2Network.tokenBridge.l1Weth
        const l2l3WethGateway = l3Network.tokenBridge.l1WethGateway

        const wethAns = await l1l3Bridger.getL2L3GatewayAddress(
          l1Weth!, // todo handle undefined
          l1Signer.provider!,
          l2Signer.provider!
        )

        expect(wethAns).to.eq(l2l3WethGateway)

        // test default gateway
        const l2l3Gateway = l3Network.tokenBridge.l1ERC20Gateway
        const defaultAns = await l1l3Bridger.getL2L3GatewayAddress(
          l1Token.address,
          l1Signer.provider!,
          l2Signer.provider!
        )
        expect(defaultAns).to.eq(l2l3Gateway)
      })
    }

    it('approves', async () => {
      // approve the teleporter
      await (
        await l1l3Bridger.approveToken({
          erc20L1Address: l1Token.address,
          l1Signer,
        })
      ).wait()
    })

    it('happy path', async () => {
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

      const depositTx = await l1l3Bridger.deposit({
        erc20L1Address: l1Token.address,
        to: l3Recipient,
        amount,
        l1Signer,
        l2Provider: l2Signer.provider!,
        l3Provider,
      })

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositMessages({
          l1TransactionReceipt: depositReceipt,
          l2Provider: l2JsonRpcProvider,
          l3Provider,
        })
        return status.completed
      }, 1000)

      // make sure the tokens have landed in the right place
      const l3TokenAddr = await l1l3Bridger.getL3ERC20Address(
        l1Token.address,
        l1Signer.provider!,
        l2Signer.provider!
      )
      const l3Token = l1l3Bridger.getL3TokenContract(l3TokenAddr, l3Provider)

      const l3Balance = await l3Token.balanceOf(l3Recipient)

      expect(l3Balance.eq(amount)).to.be.true
    })
  })
})
