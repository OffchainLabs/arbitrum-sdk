import { ARB1_NITRO_GENESIS_L2_BLOCK } from '../dataEntities/constants'
import { ArbitrumNetwork } from '../dataEntities/networks'

export function getNitroGenesisBlock(chainOrChainId: ArbitrumNetwork | number) {
  const chainId =
    typeof chainOrChainId === 'number' ? chainOrChainId : chainOrChainId.chainID

  // all networks except Arbitrum One started off with Nitro
  if (chainId === 42161) {
    return ARB1_NITRO_GENESIS_L2_BLOCK
  }

  return 0
}
