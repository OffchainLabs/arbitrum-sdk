import { describe, it, expect } from 'vitest'
import { getArbitrumNetworkInformationFromRollup } from '../../src/networks/fromRollup'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { ADDRESS_ZERO } from '../../src/constants'

/**
 * Minimal JSON-RPC provider that implements ArbitrumProvider.
 * Only `call` and `getChainId` are exercised by getArbitrumNetworkInformationFromRollup,
 * so the other methods throw if called unexpectedly.
 */
function createJsonRpcProvider(rpcUrl: string): ArbitrumProvider {
  let nextId = 1

  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
    })
    const json = (await res.json()) as {
      result?: unknown
      error?: { message: string }
    }
    if (json.error) {
      throw new Error(json.error.message)
    }
    return json.result
  }

  return {
    async getChainId() {
      const hex = (await rpc('eth_chainId', [])) as string
      return Number(hex)
    },
    async call(request) {
      const result = (await rpc('eth_call', [
        { to: request.to, data: request.data },
        request.blockTag ? `0x${request.blockTag.toString(16)}` : 'latest',
      ])) as string
      return result
    },
    // Methods below are not used by getArbitrumNetworkInformationFromRollup
    // but must exist to satisfy the ArbitrumProvider interface.
    getBlockNumber: () => {
      throw new Error('not implemented')
    },
    getBlock: () => {
      throw new Error('not implemented')
    },
    getTransactionReceipt: () => {
      throw new Error('not implemented')
    },
    estimateGas: () => {
      throw new Error('not implemented')
    },
    getBalance: () => {
      throw new Error('not implemented')
    },
    getCode: () => {
      throw new Error('not implemented')
    },
    getStorageAt: () => {
      throw new Error('not implemented')
    },
    getTransactionCount: () => {
      throw new Error('not implemented')
    },
    getLogs: () => {
      throw new Error('not implemented')
    },
    getFeeData: () => {
      throw new Error('not implemented')
    },
  }
}

// Known rollup addresses
const ARB_ONE_ROLLUP = '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35'
const XAI_ROLLUP = '0xC47DacFbAa80Bd9D8112F4e8069482c2A3221336'

describe('getArbitrumNetworkInformationFromRollup (integration)', () => {
  it('fetches information about Arbitrum One', async () => {
    const rpcUrl = process.env['MAINNET_RPC']
    if (!rpcUrl) {
      return // skip if no mainnet RPC configured
    }

    const provider = createJsonRpcProvider(rpcUrl)

    const { parentChainId, confirmPeriodBlocks, ethBridge, nativeToken } =
      await getArbitrumNetworkInformationFromRollup(ARB_ONE_ROLLUP, provider)

    expect(parentChainId, 'parentChainId should be Ethereum mainnet').toBe(1)
    expect(
      confirmPeriodBlocks,
      'confirmPeriodBlocks should be positive'
    ).toBeGreaterThan(0)

    // All bridge addresses should be non-zero
    expect(ethBridge.bridge).not.toBe(ADDRESS_ZERO)
    expect(ethBridge.inbox).not.toBe(ADDRESS_ZERO)
    expect(ethBridge.sequencerInbox).not.toBe(ADDRESS_ZERO)
    expect(ethBridge.outbox).not.toBe(ADDRESS_ZERO)
    expect(ethBridge.rollup).toBe(ARB_ONE_ROLLUP)

    // Arbitrum One uses ETH as native token
    expect(nativeToken, 'Arb1 native token should be zero (ETH)').toBe(
      ADDRESS_ZERO
    )
  })

  it('fetches information about XAI', async () => {
    const rpcUrl = process.env['ARB1_RPC']
    if (!rpcUrl) {
      return // skip if no Arb1 RPC configured
    }

    const provider = createJsonRpcProvider(rpcUrl)

    const { parentChainId, confirmPeriodBlocks, ethBridge, nativeToken } =
      await getArbitrumNetworkInformationFromRollup(XAI_ROLLUP, provider)

    expect(parentChainId, 'parentChainId should be Arbitrum One').toBe(42161)
    expect(confirmPeriodBlocks, 'confirmPeriodBlocks should be 45818').toBe(
      45818
    )

    expect(ethBridge.bridge, 'Bridge contract').toBe(
      '0x7dd8A76bdAeBE3BBBaCD7Aa87f1D4FDa1E60f94f'
    )
    expect(ethBridge.inbox, 'Inbox contract').toBe(
      '0xaE21fDA3de92dE2FDAF606233b2863782Ba046F9'
    )
    expect(ethBridge.sequencerInbox, 'SequencerInbox contract').toBe(
      '0x995a9d3ca121D48d21087eDE20bc8acb2398c8B1'
    )
    expect(ethBridge.outbox, 'Outbox contract').toBe(
      '0x1E400568AD4840dbE50FB32f306B842e9ddeF726'
    )
    expect(ethBridge.rollup, 'Rollup contract').toBe(XAI_ROLLUP)

    // XAI uses a custom native token
    expect(nativeToken, 'XAI native token').toBe(
      '0x4Cb9a7AE498CEDcBb5EAe9f25736aE7d428C9D66'
    )
  })
})
