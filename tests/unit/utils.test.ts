import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import { getBlockRangesForL1Block } from '../../src/lib/utils/lib'
import { ArbitrumProvider } from '../../src/lib/utils/arbProvider'

describe('Utils functions', () => {
  it('searches for an L2 block range corresponding to an L1 block', async function () {
    const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const arbProvider = new ArbitrumProvider(provider)

    async function validateL2Blocks(blocks: BigNumber[]) {
      if (blocks.length !== 2) {
        throw new Error()
      }

      if (!blocks[0]._isBigNumber || !blocks[1]._isBigNumber) {
        throw new Error()
      }

      const [startBlock, blockBeforeStartBlock, endBlock, blockAfterEndBlock] =
        await Promise.all([
          arbProvider.getBlock(blocks[0].toNumber()),
          arbProvider.getBlock(blocks[0].toNumber() - 1),
          arbProvider.getBlock(blocks[1].toNumber()),
          arbProvider.getBlock(blocks[1].toNumber() + 1),
        ]).then(result =>
          result.map(block => BigNumber.from(block.l1BlockNumber))
        )

      const startBlockCondition = startBlock.gt(blockBeforeStartBlock)
      const endBlockCondition = endBlock.lt(blockAfterEndBlock)

      // Check if Arbitrum start block is the first block for this L1 block.
      expect(
        startBlockCondition,
        `L2 block is not the first block in range for L1 block`
      ).to.be.true

      // Check if Arbitrum end block is the last block for this L1 block.
      expect(
        endBlockCondition,
        `L2 block is not the last block in range for L1 block`
      ).to.be.true
    }

    const l2Blocks = await getBlockRangesForL1Block({
      provider: arbProvider,
      targetL1BlockNumber: 16500000,
    })

    await validateL2Blocks(l2Blocks)
  })
})
