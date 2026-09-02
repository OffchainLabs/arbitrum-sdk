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

import { providers } from 'ethers'
import { expect } from 'chai'
import { anything, instance, mock, when } from 'ts-mockito'
import { getNativeTokenDecimals } from '../../src/lib/utils/lib'
import { ArbitrumNetwork } from '../../src/lib/dataEntities/networks'

const nativeTokenAddress = '0x0000000000000000000000000000000000000009'

function buildChildNetwork(): ArbitrumNetwork {
  return {
    chainId: 42161,
    parentChainId: 1,
    confirmPeriodBlocks: 45818,
    isCustom: true,
    isTestnet: false,
    nativeToken: nativeTokenAddress,
    tokenBridge: undefined,
    teleporter: undefined,
    ethBridge: {
      bridge: '0x0000000000000000000000000000000000000001',
      inbox: '0x0000000000000000000000000000000000000002',
      sequencerInbox: '0x0000000000000000000000000000000000000003',
      outbox: '0x0000000000000000000000000000000000000004',
      rollup: '0x0000000000000000000000000000000000000005',
    },
  } as unknown as ArbitrumNetwork
}

describe('getNativeTokenDecimals', () => {
  it('propagates a provider failure instead of silently returning 0 decimals', async () => {
    const providerMock = mock(providers.JsonRpcProvider)
    when(providerMock._isProvider).thenReturn(true)
    when(providerMock.getNetwork()).thenResolve({ chainId: 1 } as any)
    // Simulate a transient RPC failure (rate limit, network blip) on the
    // underlying eth_call the generated ERC20 contract makes for decimals().
    when(providerMock.call(anything(), anything())).thenReject(
      new Error('could not detect network (transient RPC failure)')
    )

    const parentProvider = instance(providerMock)
    const childNetwork = buildChildNetwork()

    let thrown: unknown
    let result: number | undefined
    try {
      result = await getNativeTokenDecimals({ parentProvider, childNetwork })
    } catch (err) {
      thrown = err
    }

    // Under the old catch-and-return-0 bug, `result` would be 0 and `thrown`
    // would stay undefined. The fix must propagate the failure instead.
    expect(thrown).to.not.equal(undefined)
    expect(result).to.equal(undefined)
  })
})
