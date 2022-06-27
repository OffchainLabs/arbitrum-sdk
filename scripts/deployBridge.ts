import { Signer, ContractFactory, constants } from 'ethers'

import { L1GatewayRouter__factory } from '../src/lib/abi/factories/L1GatewayRouter__factory'
import { L1ERC20Gateway__factory } from '../src/lib/abi/factories/L1ERC20Gateway__factory'
import { L1CustomGateway__factory } from '../src/lib/abi/factories/L1CustomGateway__factory'
import { L1WethGateway__factory } from '../src/lib/abi/factories/L1WethGateway__factory'
import { L2GatewayRouter__factory } from '../src/lib/abi/factories/L2GatewayRouter__factory'
import { L2ERC20Gateway__factory } from '../src/lib/abi/factories/L2ERC20Gateway__factory'
import { L2CustomGateway__factory } from '../src/lib/abi/factories/L2CustomGateway__factory'
import { L2WethGateway__factory } from '../src/lib/abi/factories/L2WethGateway__factory'
import { StandardArbERC20__factory } from '../src/lib/abi/factories/StandardArbERC20__factory'
import { UpgradeableBeacon__factory } from '../src/lib/abi/factories/UpgradeableBeacon__factory'
import { BeaconProxyFactory__factory } from '../src/lib/abi/factories/BeaconProxyFactory__factory'
import { TransparentUpgradeableProxy__factory } from '../src/lib/abi/factories/TransparentUpgradeableProxy__factory'
import { ProxyAdmin } from '../src/lib/abi/ProxyAdmin'
import { ProxyAdmin__factory } from '../src/lib/abi/factories/ProxyAdmin__factory'
import { AeWETH__factory } from '../src/lib/abi/factories/AeWETH__factory'
import { TestWETH9__factory } from '../src/lib/abi/factories/TestWETH9__factory'
import { Multicall2__factory } from '../src/lib/abi/factories/Multicall2__factory'
import { ArbMulticall2__factory } from '../src/lib/abi/factories/ArbMulticall2__factory'

const deployBehindProxy = async <
  T extends ContractFactory & { contractName: string }
>(
  deployer: Signer,
  factory: T,
  admin: ProxyAdmin,
  dataToCallProxy = '0x'
): Promise<ReturnType<T['deploy']>> => {
  const instance = await factory.connect(deployer).deploy()
  await instance.deployed()

  const proxy = await new TransparentUpgradeableProxy__factory()
    .connect(deployer)
    .deploy(instance.address, admin.address, dataToCallProxy)
  await proxy.deployed()
  console.log(factory['contractName'], proxy.address)

  return instance.attach(proxy.address)
}

export const deployErc20L1 = async (deployer: Signer) => {
  const proxyAdmin = await new ProxyAdmin__factory().connect(deployer).deploy()
  await proxyAdmin.deployed()
  console.log('proxyAdmin', proxyAdmin.address)

  const router = await deployBehindProxy(
    deployer,
    new L1GatewayRouter__factory(),
    proxyAdmin
  )
  await router.deployed()

  const standardGateway = await deployBehindProxy(
    deployer,
    new L1ERC20Gateway__factory(),
    proxyAdmin
  )
  await standardGateway.deployed()

  const customGateway = await deployBehindProxy(
    deployer,
    new L1CustomGateway__factory(),
    proxyAdmin
  )
  await customGateway.deployed()

  const wethGateway = await deployBehindProxy(
    deployer,
    new L1WethGateway__factory(),
    proxyAdmin
  )
  await wethGateway.deployed()

  const weth = TestWETH9__factory.connect("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", deployer)
  await weth.deployed()
  console.log('weth', weth.address)

  const multicall = await new Multicall2__factory().connect(deployer).deploy()
  await multicall.deployed()
  console.log('multicall', multicall.address)

  return {
    proxyAdmin,
    router,
    standardGateway,
    customGateway,
    wethGateway,
    weth,
    multicall,
  }
}

export const deployErc20L2 = async (deployer: Signer) => {
  const proxyAdmin = await new ProxyAdmin__factory().connect(deployer).deploy()
  await proxyAdmin.deployed()
  console.log('proxyAdmin', proxyAdmin.address)

  const router = await deployBehindProxy(
    deployer,
    new L2GatewayRouter__factory(),
    proxyAdmin
  )
  await router.deployed()

  const standardGateway = await deployBehindProxy(
    deployer,
    new L2ERC20Gateway__factory(),
    proxyAdmin
  )
  await standardGateway.deployed()

  const customGateway = await deployBehindProxy(
    deployer,
    new L2CustomGateway__factory(),
    proxyAdmin
  )
  await customGateway.deployed()

  const wethGateway = await deployBehindProxy(
    deployer,
    new L2WethGateway__factory(),
    proxyAdmin
  )
  await wethGateway.deployed()

  const standardArbERC20 = await new StandardArbERC20__factory()
    .connect(deployer)
    .deploy()
  await standardArbERC20.deployed()

  const beacon = await new UpgradeableBeacon__factory()
    .connect(deployer)
    .deploy(standardArbERC20.address)
  await beacon.deployed()

  const beaconProxyFactory = await new BeaconProxyFactory__factory()
    .connect(deployer)
    .deploy()
  await beaconProxyFactory.deployed()

  const weth = await deployBehindProxy(
    deployer,
    new AeWETH__factory(),
    proxyAdmin
  )
  console.log('weth', weth.address)

  const multicall = await new ArbMulticall2__factory()
    .connect(deployer)
    .deploy()
  await multicall.deployed()
  console.log('multicall', multicall.address)

  return {
    proxyAdmin,
    router,
    standardGateway,
    customGateway,
    wethGateway,
    beacon,
    beaconProxyFactory,
    weth,
    multicall,
  }
}

export const deployErc20AndInit = async (
  l1Signer: Signer,
  l2Signer: Signer,
  inboxAddress: string
) => {
  console.log('deploying l1')
  const l1 = await deployErc20L1(l1Signer)

  console.log('deploying l2')
  const l2 = await deployErc20L2(l2Signer)

  console.log('initialising L2')
  await l2.router.initialize(l1.router.address, l2.standardGateway.address)
  await l2.beaconProxyFactory.initialize(l2.beacon.address)
  await (
    await l2.standardGateway.initialize(
      l1.standardGateway.address,
      l2.router.address,
      l2.beaconProxyFactory.address
    )
  ).wait()
  await (
    await l2.customGateway.initialize(
      l1.customGateway.address,
      l2.router.address
    )
  ).wait()
  await (
    await l2.weth.initialize(
      'WETH',
      'WETH',
      18,
      l2.wethGateway.address,
      l1.weth.address
    )
  ).wait()
  await (
    await l2.wethGateway.initialize(
      l1.wethGateway.address,
      l2.router.address,
      l1.weth.address,
      l2.weth.address
    )
  ).wait()

  console.log('initialising L1')
  await (
    await l1.router.initialize(
      await l1Signer.getAddress(),
      l1.standardGateway.address,
      constants.AddressZero,
      l2.router.address,
      inboxAddress
    )
  ).wait()

  await (
    await l1.standardGateway.initialize(
      l2.standardGateway.address,
      l1.router.address,
      inboxAddress,
      await l2.beaconProxyFactory.cloneableProxyHash(),
      l2.beaconProxyFactory.address
    )
  ).wait()
  await (
    await l1.customGateway.initialize(
      l2.customGateway.address,
      l1.router.address,
      inboxAddress,
      await l1Signer.getAddress()
    )
  ).wait()
  await (
    await l1.wethGateway.initialize(
      l2.wethGateway.address,
      l1.router.address,
      inboxAddress,
      l1.weth.address,
      l2.weth.address
    )
  ).wait()

  return { l1, l2 }
}
