import { Signer, ContractFactory, constants, ethers } from 'ethers'

// import from token-bridge-contracts directly to make sure the bytecode is the same
import {
  bytecode as L1GatewayRouter__bytecode,
  abi as L1GatewayRouter__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1GatewayRouter.sol/L1GatewayRouter.json'
import {
  bytecode as L1ERC20Gateway__bytecode,
  abi as L1ERC20Gateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1ERC20Gateway.sol/L1ERC20Gateway.json'
import {
  bytecode as L1CustomGateway__bytecode,
  abi as L1CustomGateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1CustomGateway.sol/L1CustomGateway.json'
import {
  bytecode as L1WethGateway__bytecode,
  abi as L1WethGateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1WethGateway.sol/L1WethGateway.json'
import {
  bytecode as L2GatewayRouter__bytecode,
  abi as L2GatewayRouter__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/arbitrum/gateway/L2GatewayRouter.sol/L2GatewayRouter.json'
import {
  bytecode as L2ERC20Gateway__bytecode,
  abi as L2ERC20Gateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/arbitrum/gateway/L2ERC20Gateway.sol/L2ERC20Gateway.json'
import {
  bytecode as L2CustomGateway__bytecode,
  abi as L2CustomGateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/arbitrum/gateway/L2CustomGateway.sol/L2CustomGateway.json'
import {
  bytecode as L2WethGateway__bytecode,
  abi as L2WethGateway__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/arbitrum/gateway/L2WethGateway.sol/L2WethGateway.json'
import {
  bytecode as StandardArbERC20__bytecode,
  abi as StandardArbERC20__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/arbitrum/StandardArbERC20.sol/StandardArbERC20.json'
import {
  bytecode as BeaconProxyFactory__bytecode,
  abi as BeaconProxyFactory__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/ClonableBeaconProxy.sol/BeaconProxyFactory.json'
import {
  bytecode as AeWETH__bytecode,
  abi as AeWETH__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/AeWETH.json'
import {
  bytecode as TestWETH9__bytecode,
  abi as TestWETH9__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/test/TestWETH9.sol/TestWETH9.json'
import {
  bytecode as Multicall2__bytecode,
  abi as Multicall2__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/rpc-utils/MulticallV2.sol/Multicall2.json'
import {
  bytecode as ArbMulticall2__bytecode,
  abi as ArbMulticall2__abi,
} from '@arbitrum/token-bridge-contracts/build/contracts/contracts/rpc-utils/MulticallV2.sol/ArbMulticall2.json'

// import from nitro-contracts directly to make sure the bytecode is the same
import {
  bytecode as UpgradeableBeacon__bytecode,
  abi as UpgradeableBeacon__abi,
} from '@arbitrum/nitro-contracts/build/contracts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json'
import {
  bytecode as TransparentUpgradeableProxy__bytecode,
  abi as TransparentUpgradeableProxy__abi,
} from '@arbitrum/nitro-contracts/build/contracts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json'
import {
  bytecode as ProxyAdmin__bytecode,
  abi as ProxyAdmin__abi,
} from '@arbitrum/nitro-contracts/build/contracts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json'

type NamedFactory = ContractFactory & { contractName: string }
const NamedFactory = (
  abi: any,
  bytecode: string,
  contractName: string
): NamedFactory => {
  const factory = new ContractFactory(abi, bytecode) as NamedFactory
  factory['contractName'] = contractName
  return factory
}

const deployBehindProxy = async <
  T extends ContractFactory & { contractName: string }
>(
  deployer: Signer,
  factory: T,
  adminAddr: string,
  dataToCallProxy = '0x'
): Promise<ReturnType<T['deploy']>> => {
  const instance = await factory.connect(deployer).deploy()
  await instance.deployed()

  const proxy = await new ethers.ContractFactory(
    TransparentUpgradeableProxy__abi,
    TransparentUpgradeableProxy__bytecode
  )
    .connect(deployer)
    .deploy(instance.address, adminAddr, dataToCallProxy)
  await proxy.deployed()
  console.log(factory['contractName'], proxy.address)

  return instance.attach(proxy.address) as ReturnType<T['deploy']>
}

export const deployErc20L1 = async (deployer: Signer) => {
  const proxyAdmin = await new ethers.ContractFactory(
    ProxyAdmin__abi,
    ProxyAdmin__bytecode
  )
    .connect(deployer)
    .deploy()
  await proxyAdmin.deployed()
  console.log('proxyAdmin', proxyAdmin.address)

  const router = await deployBehindProxy(
    deployer,
    NamedFactory(
      L1GatewayRouter__abi,
      L1GatewayRouter__bytecode,
      'L1GatewayRouter'
    ),
    proxyAdmin.address
  )
  await router.deployed()

  const standardGateway = await deployBehindProxy(
    deployer,
    NamedFactory(
      L1ERC20Gateway__abi,
      L1ERC20Gateway__bytecode,
      'L1ERC20Gateway'
    ),
    proxyAdmin.address
  )
  await standardGateway.deployed()

  const customGateway = await deployBehindProxy(
    deployer,
    NamedFactory(
      L1CustomGateway__abi,
      L1CustomGateway__bytecode,
      'L1CustomGateway'
    ),
    proxyAdmin.address
  )
  await customGateway.deployed()

  const wethGateway = await deployBehindProxy(
    deployer,
    NamedFactory(L1WethGateway__abi, L1WethGateway__bytecode, 'L1WethGateway'),
    proxyAdmin.address
  )
  await wethGateway.deployed()

  const weth = await NamedFactory(
    TestWETH9__abi,
    TestWETH9__bytecode,
    'TestWETH9'
  )
    .connect(deployer)
    .deploy('WETH', 'WETH')
  await weth.deployed()
  console.log('weth', weth.address)

  const multicall = await NamedFactory(
    Multicall2__abi,
    Multicall2__bytecode,
    'Multicall2'
  )
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
    weth,
    multicall,
  }
}

export const deployErc20L2 = async (deployer: Signer) => {
  const proxyAdmin = await new ethers.ContractFactory(
    ProxyAdmin__abi,
    ProxyAdmin__bytecode
  )
    .connect(deployer)
    .deploy()
  await proxyAdmin.deployed()
  console.log('proxyAdmin', proxyAdmin.address)

  const router = await deployBehindProxy(
    deployer,
    NamedFactory(
      L2GatewayRouter__abi,
      L2GatewayRouter__bytecode,
      'L2GatewayRouter'
    ),
    proxyAdmin.address
  )
  await router.deployed()

  const standardGateway = await deployBehindProxy(
    deployer,
    NamedFactory(
      L2ERC20Gateway__abi,
      L2ERC20Gateway__bytecode,
      'L2ERC20Gateway'
    ),
    proxyAdmin.address
  )
  await standardGateway.deployed()

  const customGateway = await deployBehindProxy(
    deployer,
    NamedFactory(
      L2CustomGateway__abi,
      L2CustomGateway__bytecode,
      'L2CustomGateway'
    ),
    proxyAdmin.address
  )
  await customGateway.deployed()

  const wethGateway = await deployBehindProxy(
    deployer,
    NamedFactory(L2WethGateway__abi, L2WethGateway__bytecode, 'L2WethGateway'),
    proxyAdmin.address
  )
  await wethGateway.deployed()

  const standardArbERC20 = await NamedFactory(
    StandardArbERC20__abi,
    StandardArbERC20__bytecode,
    'StandardArbERC20'
  )
    .connect(deployer)
    .deploy()
  await standardArbERC20.deployed()

  const beacon = await NamedFactory(
    UpgradeableBeacon__abi,
    UpgradeableBeacon__bytecode,
    'UpgradeableBeacon'
  )
    .connect(deployer)
    .deploy(standardArbERC20.address)
  await beacon.deployed()

  const beaconProxyFactory = await NamedFactory(
    BeaconProxyFactory__abi,
    BeaconProxyFactory__bytecode,
    'BeaconProxyFactory'
  )
    .connect(deployer)
    .deploy()
  await beaconProxyFactory.deployed()

  const weth = await deployBehindProxy(
    deployer,
    NamedFactory(AeWETH__abi, AeWETH__bytecode, 'AeWETH'),
    proxyAdmin.address
  )
  console.log('weth', weth.address)

  const multicall = await NamedFactory(
    ArbMulticall2__abi,
    ArbMulticall2__bytecode,
    'ArbMulticall2'
  )
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
