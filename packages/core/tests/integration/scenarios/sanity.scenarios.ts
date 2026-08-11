/**
 * Gateway configuration sanity check scenarios -- defined ONCE, run by every adapter.
 *
 * Ported from packages/sdk/tests/integration/sanity.test.ts.
 * Read-only tests that verify gateway public storage vars are properly set.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  ArbitrumContract,
  L2GatewayRouterAbi,
  assertArbitrumNetworkHasTokenBridge,
  getParentGatewayAddress,
  getChildErc20Address,
  type ArbitrumNetwork,
} from '../../../src'

/** Minimal inline ABI for gateway-specific methods not in exported ABIs. */
const GatewayAbi = [
  {
    inputs: [],
    name: 'cloneableProxyHash',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'counterpartGateway',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'router',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l2BeaconProxyFactory',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'beaconProxyFactory',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l1Weth',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l2Weth',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l2Gateway',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'l1Address',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Get the parent and child RPC URLs and the active network
 * based on whether this is an orbit test.
 */
function getNetworkContext(config: TestConfig): {
  parentRpcUrl: string
  childRpcUrl: string
  network: ArbitrumNetwork
} {
  if (config.isOrbitTest && config.l3Network) {
    return {
      parentRpcUrl: config.l2RpcUrl,
      childRpcUrl: config.l3RpcUrl,
      network: config.l3Network,
    }
  }
  return {
    parentRpcUrl: config.l1RpcUrl,
    childRpcUrl: config.l2RpcUrl,
    network: config.l2Network,
  }
}

/**
 * Register all 6 gateway configuration sanity check scenarios.
 */
export function sanityScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)

  describe('Sanity Checks (read-only)', () => {
    // ---------------------------------------------------------------
    // Test 1: standard gateways public storage vars properly set
    // ---------------------------------------------------------------
    it('standard gateways public storage vars properly set', async () => {
      assertArbitrumNetworkHasTokenBridge(network)

      const parentProvider = harness.createProvider(parentRpcUrl)
      const childProvider = harness.createProvider(childRpcUrl)

      const parentGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.parentErc20Gateway
      ).connect(parentProvider)

      const childGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.childErc20Gateway
      ).connect(childProvider)

      // cloneableProxyHash should match on both chains
      const [parentProxyHash] = await parentGateway.read(
        'cloneableProxyHash',
        []
      )
      const [childProxyHash] = await childGateway.read(
        'cloneableProxyHash',
        []
      )
      expect(parentProxyHash).toBe(childProxyHash)

      // l2BeaconProxyFactory (parent) should match beaconProxyFactory (child)
      const [parentBeaconFactory] = await parentGateway.read(
        'l2BeaconProxyFactory',
        []
      )
      const [childBeaconFactory] = await childGateway.read(
        'beaconProxyFactory',
        []
      )
      expect(parentBeaconFactory).toBe(childBeaconFactory)

      // counterpartGateway should cross-reference
      const [parentCounterpart] = await parentGateway.read(
        'counterpartGateway',
        []
      )
      expect((parentCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.childErc20Gateway.toLowerCase()
      )

      const [childCounterpart] = await childGateway.read(
        'counterpartGateway',
        []
      )
      expect((childCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.parentErc20Gateway.toLowerCase()
      )

      // router should point to respective gateway routers
      const [parentRouter] = await parentGateway.read('router', [])
      expect((parentRouter as string).toLowerCase()).toBe(
        network.tokenBridge.parentGatewayRouter.toLowerCase()
      )

      const [childRouter] = await childGateway.read('router', [])
      expect((childRouter as string).toLowerCase()).toBe(
        network.tokenBridge.childGatewayRouter.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 2: custom gateways public storage vars properly set
    // ---------------------------------------------------------------
    it('custom gateways public storage vars properly set', async () => {
      assertArbitrumNetworkHasTokenBridge(network)

      const parentProvider = harness.createProvider(parentRpcUrl)
      const childProvider = harness.createProvider(childRpcUrl)

      const parentGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.parentCustomGateway
      ).connect(parentProvider)

      const childGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.childCustomGateway
      ).connect(childProvider)

      // counterpartGateway should cross-reference
      const [parentCounterpart] = await parentGateway.read(
        'counterpartGateway',
        []
      )
      expect((parentCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.childCustomGateway.toLowerCase()
      )

      const [childCounterpart] = await childGateway.read(
        'counterpartGateway',
        []
      )
      expect((childCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.parentCustomGateway.toLowerCase()
      )

      // router should point to respective gateway routers
      const [parentRouter] = await parentGateway.read('router', [])
      expect((parentRouter as string).toLowerCase()).toBe(
        network.tokenBridge.parentGatewayRouter.toLowerCase()
      )

      const [childRouter] = await childGateway.read('router', [])
      expect((childRouter as string).toLowerCase()).toBe(
        network.tokenBridge.childGatewayRouter.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 3: WETH gateways public storage vars properly set
    // ---------------------------------------------------------------
    it('WETH gateways public storage vars properly set', async () => {
      if (!config.isEthNative) {
        return
      }

      assertArbitrumNetworkHasTokenBridge(network)

      const parentProvider = harness.createProvider(parentRpcUrl)
      const childProvider = harness.createProvider(childRpcUrl)

      const parentGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.parentWethGateway
      ).connect(parentProvider)

      const childGateway = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.childWethGateway
      ).connect(childProvider)

      // l1Weth / l2Weth should match network config
      const [parentWeth] = await parentGateway.read('l1Weth', [])
      expect((parentWeth as string).toLowerCase()).toBe(
        network.tokenBridge.parentWeth.toLowerCase()
      )

      const [childWeth] = await childGateway.read('l2Weth', [])
      expect((childWeth as string).toLowerCase()).toBe(
        network.tokenBridge.childWeth.toLowerCase()
      )

      // counterpartGateway should cross-reference
      const [parentCounterpart] = await parentGateway.read(
        'counterpartGateway',
        []
      )
      expect((parentCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.childWethGateway.toLowerCase()
      )

      const [childCounterpart] = await childGateway.read(
        'counterpartGateway',
        []
      )
      expect((childCounterpart as string).toLowerCase()).toBe(
        network.tokenBridge.parentWethGateway.toLowerCase()
      )

      // router should point to respective gateway routers
      const [parentRouter] = await parentGateway.read('router', [])
      expect((parentRouter as string).toLowerCase()).toBe(
        network.tokenBridge.parentGatewayRouter.toLowerCase()
      )

      const [childRouter] = await childGateway.read('router', [])
      expect((childRouter as string).toLowerCase()).toBe(
        network.tokenBridge.childGatewayRouter.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 4: aeWETH public vars properly set
    // ---------------------------------------------------------------
    it('aeWETH public vars properly set', async () => {
      if (!config.isEthNative) {
        return
      }

      assertArbitrumNetworkHasTokenBridge(network)

      const childProvider = harness.createProvider(childRpcUrl)

      const aeWeth = new ArbitrumContract(
        GatewayAbi,
        network.tokenBridge.childWeth
      ).connect(childProvider)

      const [l2Gateway] = await aeWeth.read('l2Gateway', [])
      expect((l2Gateway as string).toLowerCase()).toBe(
        network.tokenBridge.childWethGateway.toLowerCase()
      )

      const [l1Address] = await aeWeth.read('l1Address', [])
      expect((l1Address as string).toLowerCase()).toBe(
        network.tokenBridge.parentWeth.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 5: L1 gateway router points to right WETH gateways
    // ---------------------------------------------------------------
    it('L1 gateway router points to right WETH gateways', async () => {
      if (!config.isEthNative) {
        return
      }

      assertArbitrumNetworkHasTokenBridge(network)

      const parentProvider = harness.createProvider(parentRpcUrl)

      const gateway = await getParentGatewayAddress(
        network.tokenBridge.parentWeth,
        parentProvider,
        network
      )

      expect(gateway.toLowerCase()).toBe(
        network.tokenBridge.parentWethGateway.toLowerCase()
      )
    })

    // ---------------------------------------------------------------
    // Test 6: parent and child chain calculateL2ERC20Address match
    // ---------------------------------------------------------------
    it('parent and child chain calculateL2ERC20Address match', async () => {
      assertArbitrumNetworkHasTokenBridge(network)

      const parentProvider = harness.createProvider(parentRpcUrl)
      const childProvider = harness.createProvider(childRpcUrl)

      // Generate a random address
      const randomAddress =
        '0x' +
        [...Array(40)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('')

      // Get child ERC20 address from parent chain via core function
      const childAddressFromParent = await getChildErc20Address(
        randomAddress,
        parentProvider,
        network
      )

      // Get child ERC20 address from child chain via L2GatewayRouter
      const childRouter = new ArbitrumContract(
        L2GatewayRouterAbi,
        network.tokenBridge.childGatewayRouter
      ).connect(childProvider)

      const [childAddressFromChild] = await childRouter.read(
        'calculateL2TokenAddress',
        [randomAddress]
      )

      expect((childAddressFromChild as string).toLowerCase()).toBe(
        childAddressFromParent.toLowerCase()
      )
    })
  })
}
