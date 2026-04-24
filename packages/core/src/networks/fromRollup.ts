/**
 * Discover Arbitrum network information by reading a Rollup contract.
 *
 * Reads bridge, inbox, outbox, sequencerInbox, and confirmPeriodBlocks
 * from the RollupAdminLogic contract, and the native token from the bridge.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { RollupAdminLogicAbi } from '../abi/RollupAdminLogic'
import { IERC20BridgeAbi } from '../abi/IERC20Bridge'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumNetworkInformationFromRollup } from '../networks'
import { ADDRESS_ZERO } from '../constants'

/**
 * Read the native token address from the bridge contract.
 * Falls back to ADDRESS_ZERO if the call reverts (ETH-native bridge).
 */
async function getNativeToken(
  bridgeAddress: string,
  provider: ArbitrumProvider
): Promise<string> {
  try {
    const bridge = new ArbitrumContract(
      IERC20BridgeAbi,
      bridgeAddress
    ).connect(provider)

    const [nativeToken] = await bridge.read('nativeToken', [])
    return nativeToken as string
  } catch {
    return ADDRESS_ZERO
  }
}

/**
 * Query a rollup contract on the parent chain to discover the core
 * Arbitrum network information: bridge, inbox, outbox, sequencerInbox,
 * confirmPeriodBlocks, and native token.
 *
 * @param rollupAddress - Address of the RollupAdminLogic contract on the parent chain
 * @param parentProvider - Provider connected to the parent chain
 * @returns The discovered network information
 */
export async function getArbitrumNetworkInformationFromRollup(
  rollupAddress: string,
  parentProvider: ArbitrumProvider
): Promise<ArbitrumNetworkInformationFromRollup> {
  const rollup = new ArbitrumContract(
    RollupAdminLogicAbi,
    rollupAddress
  ).connect(parentProvider)

  const [
    [bridge],
    [inbox],
    [sequencerInbox],
    [outbox],
    [confirmPeriodBlocks],
  ] = await Promise.all([
    rollup.read('bridge', []),
    rollup.read('inbox', []),
    rollup.read('sequencerInbox', []),
    rollup.read('outbox', []),
    rollup.read('confirmPeriodBlocks', []),
  ])

  const parentChainId = await parentProvider.getChainId()

  const nativeToken = await getNativeToken(
    bridge as string,
    parentProvider
  )

  return {
    parentChainId,
    confirmPeriodBlocks: Number(confirmPeriodBlocks as bigint),
    ethBridge: {
      bridge: bridge as string,
      inbox: inbox as string,
      sequencerInbox: sequencerInbox as string,
      outbox: outbox as string,
      rollup: rollupAddress,
    },
    nativeToken,
  }
}
