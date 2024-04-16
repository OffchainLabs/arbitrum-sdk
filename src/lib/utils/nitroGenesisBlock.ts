import { ArbitrumNetwork } from '../dataEntities/networks'

/**
 * The L1 block at which Nitro was activated for Arbitrum One.
 *
 * @see https://etherscan.io/block/15447158
 */
const ARB1_NITRO_GENESIS_L1_BLOCK = 15447158

export function getNitroGenesisParentBlock(
  chainOrChainId: ArbitrumNetwork | number
) {
  const chainId =
    typeof chainOrChainId === 'number' ? chainOrChainId : chainOrChainId.chainID

  // all networks except Arbitrum One started off with Nitro
  if (chainId === 42161) {
    return ARB1_NITRO_GENESIS_L1_BLOCK
  }

  return 0
}

/**
 * The L2 block at which Nitro was activated for Arbitrum One.
 *
 * @see https://arbiscan.io/block/22207817
 */
const ARB1_NITRO_GENESIS_L2_BLOCK = 22207817

export function getNitroGenesisBlock(chainOrChainId: ArbitrumNetwork | number) {
  const chainId =
    typeof chainOrChainId === 'number' ? chainOrChainId : chainOrChainId.chainID

  // all networks except Arbitrum One started off with Nitro
  if (chainId === 42161) {
    return ARB1_NITRO_GENESIS_L2_BLOCK
  }

  return 0
}
