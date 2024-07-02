import { getSigner, testSetup } from '../../scripts/testSetup'
import {
  Address,
  Erc20Bridger,
  Erc20L1L3Bridger,
  ParentToChildMessageStatus,
  ParentToChildMessageWriter,
  ArbitrumNetwork,
} from '../../src'
import { L2ForwarderContractsDeployer__factory } from '../../src/lib/abi/factories/L2ForwarderContractsDeployer__factory'
import { TestERC20__factory } from '../../src/lib/abi/factories/TestERC20__factory'
import { TestERC20 } from '../../src/lib/abi/TestERC20'
import { AeWETH__factory } from '../../src/lib/abi/factories/AeWETH__factory'
import { L1Teleporter__factory } from '../../src/lib/abi/factories/L1Teleporter__factory'
import { fundParentSigner, fundChildSigner, skipIfMainnet } from './testHelpers'
import { BigNumber, Signer, Wallet, ethers, providers, utils } from 'ethers'
import {
  Erc20DepositRequestParams,
  EthL1L3Bridger,
} from '../../src/lib/assetBridger/l1l3Bridger'
import { assert, expect } from 'chai'
import { isArbitrumNetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import { ERC20__factory } from '../../src/lib/abi/factories/ERC20__factory'
import { Deferrable } from 'ethers/lib/utils'
import {
  itOnlyWhenCustomGasToken,
  itOnlyWhenEth,
} from './custom-fee-token/mochaExtensions'
import {
  assertArbitrumNetworkHasTokenBridge,
  registerCustomArbitrumNetwork,
} from '../../src/lib/dataEntities/networks'

async function expectPromiseToReject(
  promise: Promise<any>,
  expectedError?: string
): Promise<void> {
  let err: Error | undefined = undefined
  try {
    await promise
  } catch (e: any) {
    err = e
  }
  if (!err)
    throw new Error('Promise did not reject, expected: ' + expectedError)
  if (expectedError && err.message !== expectedError) {
    throw new Error(
      `Expected error "${expectedError}" but got "${err.message}" instead`
    )
  }
}

function hackProvider(
  provider: any,
  to: string,
  calldata: string,
  retData: string
) {
  const oldCall = provider.call.bind(provider)
  provider.originalCall ||= oldCall
  provider.call = async (
    txRequest: Deferrable<ethers.providers.TransactionRequest>,
    b: any
  ) => {
    return (await txRequest.to) === to && (await txRequest.data) === calldata
      ? retData
      : oldCall(txRequest, b)
  }
}

function unhackProvider(provider: any) {
  if (provider.originalCall) provider.call = provider.originalCall
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
  ).deploy(
    new Address(predL1Teleporter).applyAlias().value,
    await l1Signer.getChainId()
  )
  await l2ContractsDeployer.deployed()

  const l1Teleporter = await new L1Teleporter__factory(l1Signer).deploy(
    await l2ContractsDeployer.factory(),
    await l2ContractsDeployer.implementation(),
    ethers.constants.AddressZero,
    ethers.constants.AddressZero
  )
  await l1Teleporter.deployed()

  return {
    l1Teleporter,
    l2ContractsDeployer,
  }
}

async function fundActualL1CustomFeeToken(
  l1Signer: Signer,
  l2FeeToken: string,
  l2Network: ArbitrumNetwork,
  l2Provider: providers.Provider
) {
  const l1FeeToken = await new Erc20Bridger(l2Network).getParentErc20Address(
    l2FeeToken,
    l2Provider
  )

  const deployerWallet = new Wallet(
    utils.sha256(utils.toUtf8Bytes('user_token_bridge_deployer')),
    l1Signer.provider!
  )

  const tokenContract = ERC20__factory.connect(l1FeeToken, deployerWallet)

  const tx = await tokenContract.transfer(
    await l1Signer.getAddress(),
    utils.parseEther('10')
  )
  await tx.wait()
}

describe('L1 to L3 Bridging', () => {
  // If we are not testing in orbit mode, don't run any of the teleporter tests
  if (process.env.ORBIT_TEST !== '1') return

  // let setup: Unwrap<ReturnType<typeof testSetup>>
  let l2Network: ArbitrumNetwork
  let l3Network: ArbitrumNetwork

  let l1Signer: ethers.Signer
  let l2Signer: ethers.Signer
  let l3Signer: ethers.Signer
  let l3Provider: ethers.providers.JsonRpcProvider

  async function checkNetworkGuards(
    l1: boolean,
    l2: boolean,
    l3: boolean,
    checkFunction: (
      l1Signer: Signer,
      l2Signer: Signer,
      l3Signer: Signer
    ) => Promise<any>
  ) {
    const l1ChainId = await l1Signer.getChainId()
    const l2ChainId = await l2Signer.getChainId()
    const l3ChainId = (await l3Provider.getNetwork()).chainId

    const l3Signer = new Wallet(
      ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      l3Provider
    )

    if (l1) {
      await expectPromiseToReject(
        checkFunction(l2Signer, l2Signer, l3Signer),
        `Signer/provider chain id: ${l2ChainId} doesn't match provided chain id: ${l1ChainId}.`
      )
    }
    if (l2) {
      await expectPromiseToReject(
        checkFunction(l1Signer, l1Signer, l3Signer),
        `Signer/provider chain id: ${l1ChainId} doesn't match provided chain id: ${l2ChainId}.`
      )
    }
    if (l3) {
      await expectPromiseToReject(
        checkFunction(l1Signer, l2Signer, l1Signer),
        `Signer/provider chain id: ${l1ChainId} doesn't match provided chain id: ${l3ChainId}.`
      )
    }
  }

  // setup for all test cases
  before(async function () {
    await skipIfMainnet(this)

    const setup = await testSetup()

    l2Network = setup.parentChain
    l3Network = setup.childChain

    l1Signer = getSigner(
      new ethers.providers.JsonRpcProvider(process.env['ETH_URL']),
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )
    l2Signer = getSigner(
      new ethers.providers.JsonRpcProvider(process.env['ARB_URL']),
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )
    l3Provider = new ethers.providers.JsonRpcProvider(process.env['ORBIT_URL'])
    l3Signer = getSigner(
      l3Provider,
      ethers.utils.hexlify(ethers.utils.randomBytes(32))
    )

    // fund signers on L1 and L2
    await fundParentSigner(l1Signer, ethers.utils.parseEther('10'))
    await fundChildSigner(l2Signer, ethers.utils.parseEther('10'))
    await fundChildSigner(l3Signer, ethers.utils.parseEther('10'))

    if (isArbitrumNetworkWithCustomFeeToken()) {
      await fundActualL1CustomFeeToken(
        l1Signer,
        l3Network.nativeToken!,
        l2Network,
        l2Signer.provider!
      )
    }
  })

  describe('EthL1L3Bridger', () => {
    itOnlyWhenEth('functions should be guarded by check*Network', async () => {
      // getDepositRequest
      await checkNetworkGuards(
        true,
        true,
        true,
        async (l1Signer, l2Signer, l3Signer) => {
          return new EthL1L3Bridger(l3Network).getDepositRequest({
            destinationAddress: await l1Signer.getAddress(),
            amount: ethers.utils.parseEther('0.1'),
            l1Signer,
            l2Provider: l2Signer.provider!,
            l3Provider: l3Signer.provider!,
          })
        }
      )
      // deposit
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new EthL1L3Bridger(l3Network).deposit({
            l1Signer,
            txRequest: {
              to: await l1Signer.getAddress(),
              value: ethers.utils.parseEther('0.1'),
              data: '',
            },
          })
        }
      )
      // getDepositStatus
      await checkNetworkGuards(
        true,
        true,
        true,
        async (l1Signer, l2Signer, l3Signer) => {
          return new EthL1L3Bridger(l3Network).getDepositStatus({
            txReceipt: '' as any,
            l1Provider: l1Signer.provider!,
            l2Provider: l2Signer.provider!,
            l3Provider: l3Signer.provider!,
          })
        }
      )
    })

    itOnlyWhenCustomGasToken(
      'should fail construction if l3 uses a custom fee token',
      async () => {
        expect(() => new EthL1L3Bridger(l3Network)).to.throw(
          `L3 network ${l3Network.name} uses a custom fee token`
        )
      }
    )

    // send some eth to L3 with custom l3 recipient and l2 refund address
    // makes sure that appropriate amounts land at the right places
    itOnlyWhenEth('happy path', async () => {
      const l1l3Bridger = new EthL1L3Bridger(l3Network)
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))
      const l2RefundAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20))

      const depositTx = await l1l3Bridger.deposit({
        amount: ethers.utils.parseEther('0.1'),
        destinationAddress: l3Recipient,
        l2RefundAddress: l2RefundAddress,
        l1Signer,
        l2Provider: l2Signer.provider!,
        l3Provider,
      })

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositStatus({
          txReceipt: depositReceipt,
          l1Provider: l1Signer.provider!,
          l2Provider: l2Signer.provider!,
          l3Provider,
        })
        return status.completed
      }, 1000)

      // check eth balances
      const l3Balance = await l3Provider.getBalance(l3Recipient)
      assert(l3Balance.gt(ethers.utils.parseEther('0.1')))

      const l2Balance = await l2Signer.provider!.getBalance(l2RefundAddress)
      assert(l2Balance.gt(ethers.utils.parseEther('0')))
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

      const l2ForwarderFactory = await l2ContractsDeployer.factory()

      // set the teleporter on the l2Network
      l2Network.teleporter = {
        l1Teleporter: l1Teleporter.address,
        l2ForwarderFactory,
      }

      // deploy the mock token
      l1Token = await new TestERC20__factory(l1Signer).deploy()
      await l1Token.deployed()
      await (await l1Token.connect(l1Signer).mint()).wait()

      l1l3Bridger = new Erc20L1L3Bridger(l3Network)
    })

    itOnlyWhenCustomGasToken(
      'should properly get l2 and l1 fee token addresses',
      async () => {
        if (l1l3Bridger.l2FeeTokenAddress === undefined) {
          throw new Error('L2 fee token address is undefined')
        }
        // make sure l2 token equals l3 native token
        expect(l1l3Bridger.l2FeeTokenAddress).to.eq(l3Network.nativeToken)
        // make sure l1 token maps to l2 token
        expect(
          await new Erc20Bridger(l2Network).getChildErc20Address(
            (await l1l3Bridger.getGasTokenOnL1(
              l1Signer.provider!,
              l2Signer.provider!
            ))!,
            l1Signer.provider!
          )
        ).to.eq(l1l3Bridger.l2FeeTokenAddress)
      }
    )

    itOnlyWhenCustomGasToken(
      'should throw getting l1 gas token address when it is unavailable',
      async () => {
        const networkCopy = JSON.parse(
          JSON.stringify(l3Network)
        ) as ArbitrumNetwork
        networkCopy.nativeToken = ethers.utils.hexlify(
          ethers.utils.randomBytes(20)
        )
        await expectPromiseToReject(
          new Erc20L1L3Bridger(networkCopy).getGasTokenOnL1(
            l1Signer.provider!,
            l2Signer.provider!
          ),
          'L1 gas token not found. Use skipGasToken when depositing'
        )
      }
    )

    itOnlyWhenCustomGasToken(
      'should throw when the fee token does not use 18 decimals on L1 or L2',
      async () => {
        const hackedL1Provider = new ethers.providers.JsonRpcProvider(
          process.env['ETH_URL']
        )
        const hackedL2Provider = new ethers.providers.JsonRpcProvider(
          process.env['ARB_URL']
        )

        const decimalSelector =
          ERC20__factory.createInterface().encodeFunctionData('decimals')
        const encodeDecimals = (decimals: number) =>
          new ethers.utils.AbiCoder().encode(['uint8'], [decimals])

        // test require custom fee token has 18 decimals on l1 and l2
        const l1FeeToken = (await l1l3Bridger.getGasTokenOnL1(
          l1Signer.provider!,
          l2Signer.provider!
        ))!

        // incorrect L2 fee token decimals
        hackProvider(
          hackedL2Provider,
          l1l3Bridger.l2FeeTokenAddress!,
          decimalSelector,
          encodeDecimals(10)
        )
        await expectPromiseToReject(
          new Erc20L1L3Bridger(l3Network).getGasTokenOnL1(
            hackedL1Provider,
            hackedL2Provider
          ),
          'L2 gas token has incorrect decimals. Use skipGasToken when depositing'
        )

        // incorrect L1 fee token decimals
        unhackProvider(hackedL2Provider)
        hackProvider(
          hackedL1Provider,
          l1FeeToken,
          decimalSelector,
          encodeDecimals(17)
        )
        await expectPromiseToReject(
          new Erc20L1L3Bridger(l3Network).getGasTokenOnL1(
            hackedL1Provider,
            hackedL2Provider
          ),
          'L1 gas token has incorrect decimals. Use skipGasToken when depositing'
        )
      }
    )

    itOnlyWhenEth('should not have l1 and l2 fee token addresses', async () => {
      // make sure l2 is undefined and l1 is also undefined
      expect(l1l3Bridger.l2FeeTokenAddress).to.be.undefined
      await expectPromiseToReject(
        l1l3Bridger.getGasTokenOnL1(l1Signer.provider!, l2Signer.provider!),
        'L3 uses ETH for gas'
      )
    })

    it('getL2ERC20Address', async () => {
      assertArbitrumNetworkHasTokenBridge(l2Network)
      // use weth to test, since we already know its addresses
      const parentWeth = l2Network.tokenBridge.parentWeth
      const childWeth = l2Network.tokenBridge.childWeth
      const ans = await l1l3Bridger.getL2ERC20Address(
        parentWeth,
        l1Signer.provider!
      )
      expect(ans).to.eq(childWeth)
    })

    it('getL1L2GatewayAddress', async () => {
      assertArbitrumNetworkHasTokenBridge(l2Network)
      // test weth and default gateway
      const parentWeth = l2Network.tokenBridge.parentWeth
      const l1l2WethGateway = l2Network.tokenBridge.parentWethGateway

      const wethAns = await l1l3Bridger.getL1L2GatewayAddress(
        parentWeth,
        l1Signer.provider!
      )

      expect(wethAns).to.eq(l1l2WethGateway)

      // test default gateway
      const l1l2Gateway = l2Network.tokenBridge.parentErc20Gateway
      const defaultAns = await l1l3Bridger.getL1L2GatewayAddress(
        l1Token.address,
        l1Signer.provider!
      )
      expect(defaultAns).to.eq(l1l2Gateway)
    })

    itOnlyWhenEth('getL3ERC20Address', async () => {
      assertArbitrumNetworkHasTokenBridge(l2Network)
      assertArbitrumNetworkHasTokenBridge(l3Network)
      // use weth to test, since we already know its addresses
      const parentWeth = l2Network.tokenBridge.parentWeth
      const l3Weth = l3Network.tokenBridge.childWeth
      const ans = await l1l3Bridger.getL3ERC20Address(
        parentWeth,
        l1Signer.provider!,
        l2Signer.provider!
      )
      expect(ans).to.eq(l3Weth)
    })

    itOnlyWhenEth('getL2L3GatewayAddress', async () => {
      assertArbitrumNetworkHasTokenBridge(l2Network)
      assertArbitrumNetworkHasTokenBridge(l3Network)
      // test weth and default gateway
      const parentWeth = l2Network.tokenBridge.parentWeth
      const l2l3WethGateway = l3Network.tokenBridge.parentWethGateway

      const wethAns = await l1l3Bridger.getL2L3GatewayAddress(
        parentWeth,
        l1Signer.provider!,
        l2Signer.provider!
      )

      expect(wethAns).to.eq(l2l3WethGateway)

      // test default gateway
      const l2l3Gateway = l3Network.tokenBridge.parentErc20Gateway
      const defaultAns = await l1l3Bridger.getL2L3GatewayAddress(
        l1Token.address,
        l1Signer.provider!,
        l2Signer.provider!
      )
      expect(defaultAns).to.eq(l2l3Gateway)
    })

    it('approves', async () => {
      // approve the teleporter
      await (
        await l1l3Bridger.approveToken({
          erc20L1Address: l1Token.address,
          l1Signer,
        })
      ).wait()

      assert(
        (
          await l1Token.allowance(
            await l1Signer.getAddress(),
            l1l3Bridger.teleporter.l1Teleporter
          )
        ).eq(ethers.constants.MaxUint256)
      )
    })

    it('functions should be guarded by check*Network', async () => {
      registerCustomArbitrumNetwork({
        chainId: 1337,
        name: 'Mainnet Sepolia',
        parentChainId: 1,
        tokenBridge: {
          parentGatewayRouter: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
          childGatewayRouter: '0x5288c571Fd7aD117beA99bF60FE0846C4E84F933',
          parentErc20Gateway: '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
          childErc20Gateway: '0x09e9222E96E7B4AE2a407B98d48e330053351EEe',
          parentCustomGateway: '0xcEe284F754E854890e311e3280b767F80797180d',
          childCustomGateway: '0x096760F208390250649E3e8763348E783AEF5562',
          parentWethGateway: '0xd92023E9d9911199a6711321D1277285e6d4e2db',
          childWethGateway: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
          childWeth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
          parentWeth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          parentProxyAdmin: '0x9aD46fac0Cf7f790E5be05A0F15223935A0c0aDa',
          childProxyAdmin: '0xd570aCE65C43af47101fC6250FD6fC63D1c22a86',
          parentMultiCall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
          childMulticall: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
        },
        ethBridge: {
          bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
          inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
          sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
          outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
          rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
          classicOutboxes: {
            '0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a': 0,
            '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40': 30,
          },
        },
        confirmPeriodBlocks: 45818,
        isCustom: false,
      })

      // l1FeeTokenAddress
      if (isArbitrumNetworkWithCustomFeeToken()) {
        await checkNetworkGuards(
          true,
          true,
          false,
          async (l1Signer, l2Signer, _l3Signer) => {
            return new Erc20L1L3Bridger(l3Network).getGasTokenOnL1(
              l1Signer.provider!,
              l2Signer.provider!
            )
          }
        )
      }

      // getL2ERC20Address
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getL2ERC20Address(
            l1Token.address,
            l1Signer.provider!
          )
        }
      )

      // getL3ERC20Address
      await checkNetworkGuards(
        true,
        true,
        false,
        async (l1Signer, l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getL3ERC20Address(
            l1Token.address,
            l1Signer.provider!,
            l2Signer.provider!
          )
        }
      )

      // getL1L2GatewayAddress
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getL1L2GatewayAddress(
            l1Token.address,
            l1Signer.provider!
          )
        }
      )

      // getL2L3GatewayAddress
      await checkNetworkGuards(
        true,
        true,
        false,
        async (l1Signer, l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getL2L3GatewayAddress(
            l1Token.address,
            l1Signer.provider!,
            l2Signer.provider!
          )
        }
      )

      // l1TokenIsDisabled
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).l1TokenIsDisabled(
            l1Token.address,
            l1Signer.provider!
          )
        }
      )

      // l2TokenIsDisabled
      await checkNetworkGuards(
        false,
        true,
        false,
        async (_l1Signer, l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).l2TokenIsDisabled(
            l1Token.address,
            l2Signer.provider!
          )
        }
      )

      // approveToken
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).approveToken({
            txRequest: {
              to: l1Token.address,
              value: amount,
              data: '',
            },
            l1Signer,
          })
        }
      )

      // getApproveFeeTokenRequest
      if (isArbitrumNetworkWithCustomFeeToken()) {
        await checkNetworkGuards(
          true,
          true,
          false,
          async (l1Signer, l2Signer, _l3Signer) => {
            return new Erc20L1L3Bridger(l3Network).getApproveFeeTokenRequest({
              l1Provider: l1Signer.provider!,
              l2Provider: l2Signer.provider!,
              amount: amount,
            })
          }
        )
      }

      // approveFeeToken
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).approveFeeToken({
            txRequest: {
              to: l1Token.address,
              value: amount,
              data: '',
            },
            l1Signer,
          })
        }
      )

      // getDepositRequest
      await checkNetworkGuards(
        true,
        true,
        true,
        async (l1Signer, l2Signer, l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getDepositRequest({
            erc20L1Address: l1Token.address,
            destinationAddress: await l1Signer.getAddress(),
            amount: amount,
            from: await l1Signer.getAddress(),
            l1Signer,
            l2Provider: l2Signer.provider!,
            l3Provider: l3Signer.provider!,
          })
        }
      )

      // deposit
      await checkNetworkGuards(
        true,
        false,
        false,
        async (l1Signer, _l2Signer, _l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).deposit({
            l1Signer,
            txRequest: {
              to: await l1Signer.getAddress(),
              value: amount,
              data: '',
            },
          })
        }
      )

      // getDepositStatus
      await checkNetworkGuards(
        true,
        true,
        true,
        async (l1Signer, l2Signer, l3Signer) => {
          return new Erc20L1L3Bridger(l3Network).getDepositStatus({
            txHash: '0x0',
            l1Provider: l1Signer.provider!,
            l2Provider: l2Signer.provider!,
            l3Provider: l3Signer.provider!,
          })
        }
      )
    })

    itOnlyWhenCustomGasToken('happy path skip fee token', async () => {
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

      const depositParams: Erc20DepositRequestParams = {
        erc20L1Address: l1Token.address,
        destinationAddress: l3Recipient,
        amount,
        l2Provider: l2Signer.provider!,
        l3Provider,
        skipGasToken: true,
      }

      const depositTxRequest = await l1l3Bridger.getDepositRequest({
        ...depositParams,
        l1Signer,
      })

      assert(depositTxRequest.feeTokenAmount.eq(0))

      const depositTx = await l1l3Bridger.deposit({
        l1Signer,
        txRequest: depositTxRequest.txRequest,
      })

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositStatus({
          txHash: depositReceipt.transactionHash,
          l1Provider: l1Signer.provider!,
          l2Provider: l2Signer.provider!,
          l3Provider,
        })

        return (
          (await status.l2l3TokenBridgeRetryable?.status()) ===
          ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHAIN
        )
      }, 1000)

      // we have to manually redeem the l3 retryable
      const status = await l1l3Bridger.getDepositStatus({
        txHash: depositReceipt.transactionHash,
        l1Provider: l1Signer.provider!,
        l2Provider: l2Signer.provider!,
        l3Provider,
      })

      const ticket = status.l2l3TokenBridgeRetryable!
      const messageWriter = new ParentToChildMessageWriter(
        l3Signer,
        l3Network.chainId,
        ticket.sender,
        ticket.messageNumber,
        ticket.parentBaseFee,
        ticket.messageData
      )
      await (await messageWriter.redeem({ gasLimit: 20_000_000 })).wait()

      // make sure the tokens have landed in the right place
      const l3TokenAddr = await l1l3Bridger.getL3ERC20Address(
        l1Token.address,
        l1Signer.provider!,
        l2Signer.provider!
      )
      const l3Token = l1l3Bridger.getL3TokenContract(l3TokenAddr, l3Provider)

      const l3Balance = await l3Token.balanceOf(l3Recipient)

      assert(l3Balance.eq(amount))
    })

    async function testHappyPathNonFeeOrStandard(
      depositParams: Erc20DepositRequestParams
    ) {
      const depositTxRequest = await l1l3Bridger.getDepositRequest({
        ...depositParams,
        l1Signer,
      })

      if (isArbitrumNetworkWithCustomFeeToken()) {
        assert(depositTxRequest.feeTokenAmount.gt('0'))
        // approve fee token
        await (
          await l1l3Bridger.approveFeeToken({
            l1Signer,
            l2Provider: l2Signer.provider!,
            amount: depositTxRequest.feeTokenAmount,
          })
        ).wait()
      } else {
        assert(depositTxRequest.feeTokenAmount.eq('0'))
      }

      const depositTx = await l1l3Bridger.deposit({
        l1Signer,
        txRequest: depositTxRequest.txRequest,
      })

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositStatus({
          txHash: depositReceipt.transactionHash,
          l1Provider: l1Signer.provider!,
          l2Provider: l2Signer.provider!,
          l3Provider,
        })
        return status.completed
      }, 1000)

      // make sure the tokens have landed in the right place
      const l3TokenAddr = await l1l3Bridger.getL3ERC20Address(
        depositParams.erc20L1Address,
        l1Signer.provider!,
        l2Signer.provider!
      )
      const l3Token = l1l3Bridger.getL3TokenContract(l3TokenAddr, l3Provider)

      const l3Balance = await l3Token.balanceOf(
        depositParams.destinationAddress || (await l1Signer.getAddress())
      )

      assert(
        (
          await l3Provider.getBalance(
            depositParams.destinationAddress || (await l1Signer.getAddress())
          )
        ).gt('0')
      )

      assert(l3Balance.eq(amount))
    }

    it('happy path non fee token or standard', async () => {
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))

      const depositParams: Erc20DepositRequestParams = {
        erc20L1Address: l1Token.address,
        destinationAddress: l3Recipient,
        amount,
        l2Provider: l2Signer.provider!,
        l3Provider,
      }

      await testHappyPathNonFeeOrStandard(depositParams)
    })

    it('happy path weth', async () => {
      assertArbitrumNetworkHasTokenBridge(l2Network)
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))
      const weth = AeWETH__factory.connect(
        l2Network.tokenBridge.parentWeth,
        l1Signer
      )

      // wrap some eth
      await (
        await weth.deposit({
          value: amount,
        })
      ).wait()

      // approve weth
      await (
        await weth.approve(l1l3Bridger.teleporter.l1Teleporter, amount)
      ).wait()

      const depositParams: Erc20DepositRequestParams = {
        erc20L1Address: l2Network.tokenBridge.parentWeth,
        destinationAddress: l3Recipient,
        amount,
        l2Provider: l2Signer.provider!,
        l3Provider,
      }

      await testHappyPathNonFeeOrStandard(depositParams)
    })

    itOnlyWhenCustomGasToken('happy path OnlyCustomFee', async () => {
      const l3Recipient = ethers.utils.hexlify(ethers.utils.randomBytes(20))
      const l1FeeToken = (await l1l3Bridger.getGasTokenOnL1(
        l1Signer.provider!,
        l2Signer.provider!
      ))!

      const depositParams: Erc20DepositRequestParams = {
        erc20L1Address: l1FeeToken,
        destinationAddress: l3Recipient,
        amount: ethers.utils.parseEther('0.1'),
        l2Provider: l2Signer.provider!,
        l3Provider,
      }

      const depositTxRequest = await l1l3Bridger.getDepositRequest({
        ...depositParams,
        l1Signer,
      })

      await (
        await l1l3Bridger.approveToken({ ...depositParams, l1Signer })
      ).wait()

      const depositTx = await l1l3Bridger.deposit({
        l1Signer,
        txRequest: depositTxRequest.txRequest,
      })

      const depositReceipt = await depositTx.wait()

      // poll status
      await poll(async () => {
        const status = await l1l3Bridger.getDepositStatus({
          txHash: depositReceipt.transactionHash,
          l1Provider: l1Signer.provider!,
          l2Provider: l2Signer.provider!,
          l3Provider,
        })
        return status.completed
      }, 1000)

      // todo make this check better
      assert((await l3Provider.getBalance(l3Recipient)).gt('0'))
    })
  })
})
