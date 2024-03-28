/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { expect } from 'chai'

import { AeWETH__factory } from '../../src/lib/abi/factories/AeWETH__factory'
import { L2GatewayRouter__factory } from '../../src/lib/abi/factories/L2GatewayRouter__factory'
import { L2WethGateway__factory } from '../../src/lib/abi/factories/L2WethGateway__factory'
import { L1WethGateway__factory } from '../../src/lib/abi/factories/L1WethGateway__factory'
import { L2CustomGateway__factory } from '../../src/lib/abi/factories/L2CustomGateway__factory'
import { L1CustomGateway__factory } from '../../src/lib/abi/factories/L1CustomGateway__factory'
import { L2ERC20Gateway__factory } from '../../src/lib/abi/factories/L2ERC20Gateway__factory'
import { L1ERC20Gateway__factory } from '../../src/lib/abi/factories/L1ERC20Gateway__factory'

import { testSetup } from '../../scripts/testSetup'
import { randomBytes, hexlify } from 'ethers/lib/utils'
import { itOnlyWhenEth } from './custom-fee-token/mochaExtensions'

const expectIgnoreCase = (expected: string, actual: string) => {
  expect(expected.toLocaleLowerCase()).to.equal(actual.toLocaleLowerCase())
}

describe('sanity checks (read-only)', async () => {
  it('standard gateways public storage vars properly set', async () => {
    const { parentSigner, childSigner, childChain } = await testSetup()
    const l1Gateway = await L1ERC20Gateway__factory.connect(
      childChain.tokenBridge.l1ERC20Gateway,
      parentSigner
    )
    const l2Gateway = await L2ERC20Gateway__factory.connect(
      childChain.tokenBridge.l2ERC20Gateway,
      childSigner
    )

    const l1ClonableProxyHash = await l1Gateway.cloneableProxyHash()
    const l2ClonableProxyHash = await l2Gateway.cloneableProxyHash()
    expect(l1ClonableProxyHash).to.equal(l2ClonableProxyHash)

    const l1BeaconProxyHash = await l1Gateway.l2BeaconProxyFactory()
    const l2BeaconProxyHash = await l2Gateway.beaconProxyFactory()
    expect(l1BeaconProxyHash).to.equal(l2BeaconProxyHash)

    const l1GatewayCounterParty = await l1Gateway.counterpartGateway()
    expect(l1GatewayCounterParty).to.equal(
      childChain.tokenBridge.l2ERC20Gateway
    )

    const l2GatewayCounterParty = await l2Gateway.counterpartGateway()
    expect(l2GatewayCounterParty).to.equal(
      childChain.tokenBridge.l1ERC20Gateway
    )

    const l1Router = await l1Gateway.router()
    expect(l1Router).to.equal(childChain.tokenBridge.l1GatewayRouter)

    const l2Router = await l2Gateway.router()
    expect(l2Router).to.equal(childChain.tokenBridge.l2GatewayRouter)
  })

  it('custom gateways public storage vars properly set', async () => {
    const { parentSigner, childSigner, childChain } = await testSetup()
    const l1Gateway = await L1CustomGateway__factory.connect(
      childChain.tokenBridge.l1CustomGateway,
      parentSigner
    )
    const l2Gateway = await L2CustomGateway__factory.connect(
      childChain.tokenBridge.l2CustomGateway,
      childSigner
    )
    const l1GatewayCounterParty = await l1Gateway.counterpartGateway()
    expect(l1GatewayCounterParty).to.equal(
      childChain.tokenBridge.l2CustomGateway
    )

    const l2GatewayCounterParty = await l2Gateway.counterpartGateway()
    expect(l2GatewayCounterParty).to.equal(
      childChain.tokenBridge.l1CustomGateway
    )

    const l1Router = await l1Gateway.router()
    expect(l1Router).to.equal(childChain.tokenBridge.l1GatewayRouter)

    const l2Router = await l2Gateway.router()
    expect(l2Router).to.equal(childChain.tokenBridge.l2GatewayRouter)
  })

  itOnlyWhenEth(
    'weth gateways gateways public storage vars properly set',
    async () => {
      const { parentSigner, childSigner, childChain } = await testSetup()

      const l1Gateway = await L1WethGateway__factory.connect(
        childChain.tokenBridge.l1WethGateway,
        parentSigner
      )
      const l2Gateway = await L2WethGateway__factory.connect(
        childChain.tokenBridge.l2WethGateway,
        childSigner
      )

      const l1Weth = await l1Gateway.l1Weth()
      expectIgnoreCase(l1Weth, childChain.tokenBridge.l1Weth)

      const l2Weth = await l2Gateway.l2Weth()
      expectIgnoreCase(l2Weth, childChain.tokenBridge.l2Weth)

      const l1GatewayCounterParty = await l1Gateway.counterpartGateway()
      expectIgnoreCase(
        l1GatewayCounterParty,
        childChain.tokenBridge.l2WethGateway
      )

      const l2GatewayCounterParty = await l2Gateway.counterpartGateway()
      expectIgnoreCase(
        l2GatewayCounterParty,
        childChain.tokenBridge.l1WethGateway
      )

      const l1Router = await l1Gateway.router()
      expectIgnoreCase(l1Router, childChain.tokenBridge.l1GatewayRouter)

      const l2Router = await l2Gateway.router()
      expectIgnoreCase(l2Router, childChain.tokenBridge.l2GatewayRouter)
    }
  )

  itOnlyWhenEth('aeWETh public vars properly set', async () => {
    const { childSigner, childChain } = await testSetup()

    const aeWeth = AeWETH__factory.connect(
      childChain.tokenBridge.l2Weth,
      childSigner
    )

    const l2GatewayOnAeWeth = await aeWeth.l2Gateway()
    expectIgnoreCase(l2GatewayOnAeWeth, childChain.tokenBridge.l2WethGateway)

    const l1AddressOnAeWeth = await aeWeth.l1Address()
    expectIgnoreCase(l1AddressOnAeWeth, childChain.tokenBridge.l1Weth)
  })

  itOnlyWhenEth('l1 gateway router points to right weth gateways', async () => {
    const { adminErc20Bridger, parentSigner, childChain } = await testSetup()

    const gateway = await adminErc20Bridger.getL1GatewayAddress(
      childChain.tokenBridge.l1Weth,
      parentSigner.provider!
    )

    expect(gateway).to.equal(childChain.tokenBridge.l1WethGateway)
  })

  it('parent and child chain implementations of calculateL2ERC20Address match', async () => {
    const { parentSigner, childSigner, childChain, erc20Bridger } =
      await testSetup()

    const address = hexlify(randomBytes(20))

    const erc20L2AddressAsPerL1 = await erc20Bridger.getL2ERC20Address(
      address,
      parentSigner.provider!
    )
    const l2gr = L2GatewayRouter__factory.connect(
      childChain.tokenBridge.l2GatewayRouter,
      childSigner.provider!
    )
    const erc20L2AddressAsPerL2 = await l2gr.calculateL2TokenAddress(address)

    expect(erc20L2AddressAsPerL2).to.equal(erc20L2AddressAsPerL1)
  })
})
