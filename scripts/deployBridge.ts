import { Signer, ContractFactory, constants } from 'ethers'

import { L1OrbitGatewayRouter__factory } from '../src/lib/abi/factories/L1OrbitGatewayRouter__factory'
import { L1OrbitERC20Gateway__factory } from '../src/lib/abi/factories/L1OrbitERC20Gateway__factory'
import { L1OrbitCustomGateway__factory } from '../src/lib/abi/factories/L1OrbitCustomGateway__factory'

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
import { TokenBridge } from '../src/lib/dataEntities/networks'

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

  return instance.attach(proxy.address) as ReturnType<T['deploy']>
}

const deployErc20L1CustomFee = async (deployer: Signer) => {
  const proxyAdmin = await new ProxyAdmin__factory().connect(deployer).deploy()
  await proxyAdmin.deployed()
  console.log('proxyAdmin', proxyAdmin.address)

  const router = await deployBehindProxy(
    deployer,
    new L1OrbitGatewayRouter__factory(),
    proxyAdmin
  )
  await router.deployed()

  const standardGateway = await deployBehindProxy(
    deployer,
    new L1OrbitERC20Gateway__factory(),
    proxyAdmin
  )
  await standardGateway.deployed()

  const customGateway = await deployBehindProxy(
    deployer,
    new L1OrbitCustomGateway__factory(),
    proxyAdmin
  )
  await customGateway.deployed()

  const multicall = await new Multicall2__factory().connect(deployer).deploy()
  await multicall.deployed()
  console.log('multicall', multicall.address)

  return {
    proxyAdmin,
    router,
    standardGateway,
    customGateway,
    multicall,
    weth: undefined,
    wethGateway: undefined,
  }
}

const deployErc20L1 = async (deployer: Signer) => {
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

  const weth = await new TestWETH9__factory()
    .connect(deployer)
    .deploy('WETH', 'WETH')
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

const deployL2Weth = async (deployer: Signer, proxyAdmin: ProxyAdmin) => {
  const wethGateway = await deployBehindProxy(
    deployer,
    new L2WethGateway__factory(),
    proxyAdmin
  )
  await wethGateway.deployed()

  const weth = await deployBehindProxy(
    deployer,
    new AeWETH__factory(),
    proxyAdmin
  )
  await weth.deployed()
  console.log('weth', weth.address)

  return {
    wethGateway,
    weth,
  }
}

const deployErc20L2NoWeth = async (deployer: Signer) => {
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
    beacon,
    beaconProxyFactory,
    multicall,
  }
}

const deployErc20L2CustomFee = async (deployer: Signer) => {
  return {
    ...(await deployErc20L2NoWeth(deployer)),
    weth: undefined,
    wethGateway: undefined,
  }
}

const deployErc20L2 = async (deployer: Signer) => {
  const noWeth = await deployErc20L2NoWeth(deployer)
  return {
    ...noWeth,
    ...(await deployL2Weth(deployer, noWeth.proxyAdmin)),
  }
}

export const deployErc20AndInit = async (
  l1Signer: Signer,
  l2Signer: Signer,
  inboxAddress: string,
  usingCustomFee: boolean,
  l1WethOverride?: string
): Promise<TokenBridge> => {
  console.log('deploying l1')
  const l1 = usingCustomFee
    ? await deployErc20L1CustomFee(l1Signer)
    : await deployErc20L1(l1Signer)

  console.log('deploying l2')
  const l2 = usingCustomFee
    ? await deployErc20L2CustomFee(l2Signer)
    : await deployErc20L2(l2Signer)

  console.log('initialising L2')
  await (
    await l2.router.initialize(l1.router.address, l2.standardGateway.address)
  ).wait()
  await (await l2.beaconProxyFactory.initialize(l2.beacon.address)).wait()
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
  if (l1.weth && l2.weth) {
    await (
      await l2.weth.initialize(
        'WETH',
        'WETH',
        18,
        l2.wethGateway.address,
        l1WethOverride || l1.weth.address
      )
    ).wait()
    await (
      await l2.wethGateway.initialize(
        l1.wethGateway.address,
        l2.router.address,
        l1WethOverride || l1.weth.address,
        l2.weth.address
      )
    ).wait()
  }

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
  if (l1.weth && l2.weth) {
    await (
      await l1.wethGateway.initialize(
        l2.wethGateway.address,
        l1.router.address,
        inboxAddress,
        l1WethOverride || l1.weth.address,
        l2.weth.address
      )
    ).wait()
  }

  const ret = {
    l1CustomGateway: l1.customGateway.address,
    l1ERC20Gateway: l1.standardGateway.address,
    l1GatewayRouter: l1.router.address,
    l1MultiCall: l1.multicall.address,
    l1ProxyAdmin: l1.proxyAdmin.address,

    l2CustomGateway: l2.customGateway.address,
    l2ERC20Gateway: l2.standardGateway.address,
    l2GatewayRouter: l2.router.address,
    l2Multicall: l2.multicall.address,
    l2ProxyAdmin: l2.proxyAdmin.address,
  }

  if (l1.weth && l2.weth) {
    return {
      ...ret,
      l1Weth: l1WethOverride || l1.weth.address,
      l1WethGateway: l1.wethGateway.address,
      l2Weth: l2.weth.address,
      l2WethGateway: l2.wethGateway.address,
    }
  }
  return ret
}
