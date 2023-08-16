import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import { getBlockRangesForL1Block } from '../../src/lib/utils/lib'
import { ArbitrumProvider } from '../../src/lib/utils/arbProvider'

describe('Utils functions', () => {
  it('searches for an L2 block range corresponding to an L1 block', async function () {
    const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const arbProvider = new ArbitrumProvider(provider)

    async function validateL2Blocks(blocks: (number | undefined)[]) {
      if (blocks.length !== 2) {
        throw new Error(
          `Expected L2 block range to have the array length of 2, got ${blocks.length}.`
        )
      }

      if (typeof blocks[0] !== 'number' || typeof blocks[1] !== 'number') {
        throw new Error('Expected both blocks to be numbers.')
      }

      const [startBlock, blockBeforeStartBlock, endBlock, blockAfterEndBlock] =
        await Promise.all([
          arbProvider.getBlock(blocks[0]),
          arbProvider.getBlock(blocks[0] - 1),
          arbProvider.getBlock(blocks[1]),
          arbProvider.getBlock(blocks[1] + 1),
        ]).then(result =>
          result.map(block => BigNumber.from(block.l1BlockNumber))
        )

      const startBlockCondition = startBlock.gt(blockBeforeStartBlock)
      const endBlockCondition = endBlock.lt(blockAfterEndBlock)

      // Check if Arbitrum start block is the first block for this L1 block.
      expect(
        startBlockCondition,
        `L2 block is not the first block in range for L1 block.`
      ).to.be.true

      // Check if Arbitrum end block is the last block for this L1 block.
      expect(
        endBlockCondition,
        `L2 block is not the last block in range for L1 block.`
      ).to.be.true
    }

    const l2Blocks = await getBlockRangesForL1Block({
      provider: arbProvider,
      forL1Block: 16500000,
    })

    await validateL2Blocks(l2Blocks)
  })
})
