import { JsonRpcProvider } from '@ethersproject/providers'
import { constants } from 'ethers'
import { expect } from 'chai'
import { loadEnv } from '../../src/lib/utils/env'

import {
  getArbitrumNetwork,
  getArbitrumNetworkInformationFromRollup,
} from '../../src/lib/dataEntities/networks'

loadEnv()

describe('getArbitrumNetworkInformationFromRollup', () => {
  it('fetches information about arbitrum one', async () => {
    const arb1 = getArbitrumNetwork(42161)
    const ethProvider = new JsonRpcProvider(
      process.env['MAINNET_RPC'] as string
    )

    const { parentChainId, confirmPeriodBlocks, ethBridge, nativeToken } =
      await getArbitrumNetworkInformationFromRollup(
        arb1.ethBridge.rollup,
        ethProvider
      )

    expect(parentChainId, 'parentChainId is not correct').to.eq(
      arb1.parentChainId
    )

    expect(confirmPeriodBlocks, 'confirmPeriodBlocks is not correct').to.eq(
      arb1.confirmPeriodBlocks
    )

    const { bridge, inbox, sequencerInbox, outbox, rollup } = ethBridge
    const arb1EthBridge = arb1.ethBridge

    expect(bridge, 'Bridge contract is not correct').to.eq(arb1EthBridge.bridge)
    expect(inbox, 'Inbox contract is not correct').to.eq(arb1EthBridge.inbox)
    expect(sequencerInbox, 'SequencerInbox contract is not correct').to.eq(
      arb1EthBridge.sequencerInbox
    )
    expect(outbox, 'Outbox contract is not correct').to.eq(arb1EthBridge.outbox)
    expect(rollup, 'Rollup contract is not correct').to.eq(arb1EthBridge.rollup)

    expect(nativeToken, 'Native token is not correct').to.eq(
      constants.AddressZero
    )
  })

  it('fetches information about xai', async () => {
    const { parentChainId, confirmPeriodBlocks, ethBridge, nativeToken } =
      await getArbitrumNetworkInformationFromRollup(
        '0xC47DacFbAa80Bd9D8112F4e8069482c2A3221336',
        new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
      )

    expect(parentChainId, 'parentChainId is not correct').to.eq(42161)

    expect(confirmPeriodBlocks, 'confirmPeriodBlocks is not correct').to.eq(
      45818
    )

    const { bridge, inbox, sequencerInbox, outbox, rollup } = ethBridge

    expect(bridge, 'Bridge contract is not correct').to.eq(
      '0x7dd8A76bdAeBE3BBBaCD7Aa87f1D4FDa1E60f94f'
    )
    expect(inbox, 'Inbox contract is not correct').to.eq(
      '0xaE21fDA3de92dE2FDAF606233b2863782Ba046F9'
    )
    expect(sequencerInbox, 'SequencerInbox contract is not correct').to.eq(
      '0x995a9d3ca121D48d21087eDE20bc8acb2398c8B1'
    )
    expect(outbox, 'Outbox contract is not correct').to.eq(
      '0x1E400568AD4840dbE50FB32f306B842e9ddeF726'
    )
    expect(rollup, 'Rollup contract is not correct').to.eq(
      '0xC47DacFbAa80Bd9D8112F4e8069482c2A3221336'
    )

    expect(nativeToken, 'Native token is not correct').to.eq(
      '0x4Cb9a7AE498CEDcBb5EAe9f25736aE7d428C9D66'
    )
  })
})
