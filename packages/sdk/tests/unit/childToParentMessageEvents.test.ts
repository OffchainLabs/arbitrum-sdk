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

import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { ChildToParentMessage } from '../../src/lib/message/ChildToParentMessage'
import {
  getArbitrumNetwork,
  getNitroGenesisBlock,
} from '../../src/lib/dataEntities/networks'
import { providers } from 'ethers'
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito'

describe('ChildToParentMessage events', () => {
  // ChildToParentTransaction
  const classicTopic =
    '0x5baaa87db386365b5c161be377bc3d8e317e8d98d71a3ca7ed7d555340c8f767'
  // ChildToParentTx
  const nitroTopic =
    '0x3e7aafa77dbf186b7fd488006beff893744caa3c4f6f299e8a709fa2087374fc'

  const arbSys = '0x0000000000000000000000000000000000000064'

  const createProviderMock = async (networkChoiceOverride?: number) => {
    const l2Network = await getArbitrumNetwork(networkChoiceOverride || 42161)

    const l2ProviderMock = mock(providers.JsonRpcProvider)
    const latestBlock = getNitroGenesisBlock(l2Network) + 1000
    when(l2ProviderMock.getBlockNumber()).thenResolve(latestBlock)
    when(l2ProviderMock.getNetwork()).thenResolve({
      chainId: l2Network.chainId,
    } as any)
    when(l2ProviderMock._isProvider).thenReturn(true)
    when(l2ProviderMock.getLogs(anything())).thenResolve([])
    const l2Provider = instance(l2ProviderMock)

    return {
      l2ProviderMock,
      l2Provider,
      l2Network,
      latestBlock,
    }
  }

  it('does call for classic events', async () => {
    const { l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = 0
    const toBlock = 1000

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    verify(l2ProviderMock.getLogs(anything())).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [classicTopic],
          fromBlock: 0,
          toBlock: 1000,
        })
      )
    ).once()
  })

  it('does call for nitro events', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = getNitroGenesisBlock(l2Network)
    const toBlock = getNitroGenesisBlock(l2Network) + 500

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    verify(l2ProviderMock.getLogs(anything())).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: fromBlock,
          toBlock: toBlock,
        })
      )
    ).once()
  })

  it('does call for classic and nitro events', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = 0
    const toBlock = getNitroGenesisBlock(l2Network) + 500

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    verify(l2ProviderMock.getLogs(anything())).twice()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [classicTopic],
          fromBlock: fromBlock,
          toBlock: getNitroGenesisBlock(l2Network),
        })
      )
    ).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: getNitroGenesisBlock(l2Network),
          toBlock: toBlock,
        })
      )
    ).once()
  })

  it('does call for classic and nitro events from earliest to latest', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = 'earliest'
    const toBlock = 'latest'

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    verify(l2ProviderMock.getLogs(anything())).twice()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [classicTopic],
          fromBlock: 0,
          toBlock: getNitroGenesisBlock(l2Network),
        })
      )
    ).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: getNitroGenesisBlock(l2Network),
          toBlock: 'latest',
        })
      )
    ).once()
  })

  it('does call for only nitro for latest', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = getNitroGenesisBlock(l2Network) + 2
    const toBlock = 'latest'

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    verify(l2ProviderMock.getLogs(anything())).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: fromBlock,
          toBlock: 'latest',
        })
      )
    ).once()
  })

  it('doesnt call classic when nitro genesis is 0', async () => {
    const { l2Provider, l2ProviderMock } = await createProviderMock(421614)
    const fromBlock = 'earliest'
    const toBlock = 'latest'

    await ChildToParentMessage.getChildToParentEvents(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    // we dont expect classic to be called ever on sepolia
    verify(l2ProviderMock.getLogs(anything())).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: 0,
          toBlock: toBlock,
        })
      )
    ).once()
  })
})
