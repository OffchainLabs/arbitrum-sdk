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

export const deployErc20Parent = async (deployer: Signer) => {
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

export const deployErc20Child = async (deployer: Signer) => {
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
  l3Signer: Signer,
  l1InboxAddress: string, // inbox for L2 on L1
  l2InboxAddress: string // inbox for L3 on L2
) => {
  console.log('deploying l1 parent')
  const l1Parent = await deployErc20Parent(l1Signer)

  console.log('deploying l2 child')
  const l2Child = await deployErc20Child(l2Signer)

  console.log('deploying l2 parent')
  const l2Parent = await deployErc20Parent(l2Signer)

  console.log('deploying l3 child')
  const l3Child = await deployErc20Child(l3Signer)

  type Unwrap<T> = T extends Promise<infer U> ? U : T
  const initializeParentChild = async (
    parent: Unwrap<ReturnType<typeof deployErc20Parent>>,
    child: Unwrap<ReturnType<typeof deployErc20Child>>,
    inboxAddress: string,
    parentSigner: Signer,
    parentWethAddressOverride?: string
  ) => {
    // initialize child
    await (
      await child.router.initialize(
        parent.router.address,
        child.standardGateway.address
      )
    ).wait()
    await (
      await child.beaconProxyFactory.initialize(child.beacon.address)
    ).wait()
    await (
      await child.standardGateway.initialize(
        parent.standardGateway.address,
        child.router.address,
        child.beaconProxyFactory.address
      )
    ).wait()
    await (
      await child.customGateway.initialize(
        parent.customGateway.address,
        child.router.address
      )
    ).wait()
    await (
      await child.weth.initialize(
        'WETH',
        'WETH',
        18,
        child.wethGateway.address,
        parentWethAddressOverride || parent.weth.address
      )
    ).wait()
    await (
      await child.wethGateway.initialize(
        parent.wethGateway.address,
        child.router.address,
        parentWethAddressOverride || parent.weth.address,
        child.weth.address
      )
    ).wait()

    // initialize parent
    await (
      await parent.router.initialize(
        await parentSigner.getAddress(),
        parent.standardGateway.address,
        constants.AddressZero,
        child.router.address,
        inboxAddress
      )
    ).wait()

    await (
      await parent.standardGateway.initialize(
        child.standardGateway.address,
        parent.router.address,
        inboxAddress,
        await child.beaconProxyFactory.cloneableProxyHash(),
        child.beaconProxyFactory.address
      )
    ).wait()
    await (
      await parent.customGateway.initialize(
        child.customGateway.address,
        parent.router.address,
        inboxAddress,
        await parentSigner.getAddress()
      )
    ).wait()
    await (
      await parent.wethGateway.initialize(
        child.wethGateway.address,
        parent.router.address,
        inboxAddress,
        parentWethAddressOverride || parent.weth.address,
        child.weth.address
      )
    ).wait()
  }

  console.log('initialising L1 <-> L2')
  await initializeParentChild(l1Parent, l2Child, l1InboxAddress, l1Signer)

  console.log('initialising L2 <-> L3')
  await initializeParentChild(
    l2Parent,
    l3Child,
    l2InboxAddress,
    l2Signer,
    l2Child.weth.address
  )

  return {
    l1Parent,
    l2Child,
    l2Parent: {
      ...l2Parent,
      weth: l2Child.weth,
    },
    l3Child,
  }
}
