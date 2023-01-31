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
import { L2ToL1Message } from '../../src'
import { getL2Network } from '../../src/lib/dataEntities/networks'
import { providers } from 'ethers'
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito'

describe('L2ToL1Message events', () => {
  // L2ToL1Transaction
  const classicTopic =
    '0x5baaa87db386365b5c161be377bc3d8e317e8d98d71a3ca7ed7d555340c8f767'
  // L2ToL1Tx
  const nitroTopic =
    '0x3e7aafa77dbf186b7fd488006beff893744caa3c4f6f299e8a709fa2087374fc'

  const arbSys = '0x0000000000000000000000000000000000000064'

  const createProviderMock = async (networkChoiceOverride?: number) => {
    const l2Network = await getL2Network(networkChoiceOverride || 42161)

    const l2ProviderMock = mock(providers.JsonRpcProvider)
    const latestBlock = l2Network.nitroGenesisBlock + 1000
    when(l2ProviderMock.getBlockNumber()).thenResolve(latestBlock)
    when(l2ProviderMock.getNetwork()).thenResolve({
      chainId: l2Network.chainID,
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

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
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
    const fromBlock = l2Network.nitroGenesisBlock
    const toBlock = l2Network.nitroGenesisBlock + 500

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
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
    const toBlock = l2Network.nitroGenesisBlock + 500

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
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
          toBlock: l2Network.nitroGenesisBlock,
        })
      )
    ).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: l2Network.nitroGenesisBlock,
          toBlock: toBlock,
        })
      )
    ).once()
  })

  it('does call for classic and nitro events from earliest to latest', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = 'earliest'
    const toBlock = 'latest'

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
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
          toBlock: l2Network.nitroGenesisBlock,
        })
      )
    ).once()
    verify(
      l2ProviderMock.getLogs(
        deepEqual({
          address: arbSys,
          topics: [nitroTopic],
          fromBlock: l2Network.nitroGenesisBlock,
          toBlock: 'latest',
        })
      )
    ).once()
  })

  it('does call for only nitro for latest', async () => {
    const { l2Network, l2Provider, l2ProviderMock } = await createProviderMock()
    const fromBlock = l2Network.nitroGenesisBlock + 2
    const toBlock = 'latest'

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
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
    const { l2Provider, l2ProviderMock } = await createProviderMock(421613)
    const fromBlock = 'earliest'
    const toBlock = 'latest'

    await L2ToL1Message.getL2ToL1Events(l2Provider, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    })

    // we dont expect classic to be called ever on goerli
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
