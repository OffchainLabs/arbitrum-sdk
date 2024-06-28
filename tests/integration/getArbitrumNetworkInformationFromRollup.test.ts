import dotenv from 'dotenv'
import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import {
  getArbitrumNetwork,
  getArbitrumNetworkInformationFromRollup,
} from '../../src/lib/dataEntities/networks'

dotenv.config()

describe('getArbitrumNetworkInformationFromRollup.test', () => {
  it('fetches information about arbitrum one', async () => {
    const arb1 = await getArbitrumNetwork(42161)
    const ethProvider = new JsonRpcProvider(
      process.env['MAINNET_RPC'] as string
    )

    const { parentChainId, confirmPeriodBlocks, ethBridge } =
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
  })
})
