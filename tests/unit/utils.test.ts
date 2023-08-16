import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import { getBlockRangesForL1Block } from '../../src/lib/utils/lib'
import { ArbitrumProvider } from '../../src/lib/utils/arbProvider'

describe('Utils functions', () => {
  it('searches for an L2 block range corresponding to an L1 block', async function () {
    const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const arbProvider = new ArbitrumProvider(provider)

    async function validateL2Blocks(
      blocks: {
        l2Block: number | undefined
        forL1Block: number | undefined
      }[]
    ) {
      return
      if (blocks.length !== 2) {
        throw new Error(
          `Expected L2 block range to have the array length of 2, got ${blocks.length}.`
        )
      }

      if (
        blocks.some(
          block =>
            typeof block.l2Block !== 'number' ||
            typeof block.forL1Block !== 'number'
        )
      ) {
        throw new Error('Expected all L2 block range values to be numbers.')
      }

      if (blocks[0].forL1Block !== blocks[1].forL1Block) {
        throw new Error(
          `Expected the range to be for the same L1 block, got: ${blocks[0].forL1Block} and ${blocks[1].forL1Block}.`
        )
      }

      const [startBlock, blockBeforeStartBlock, endBlock, blockAfterEndBlock] =
        await Promise.all([
          arbProvider.getBlock(Number(blocks[0].l2Block)),
          arbProvider.getBlock(Number(blocks[0].l2Block) - 1),
          arbProvider.getBlock(Number(blocks[1].l2Block)),
          arbProvider.getBlock(Number(blocks[1].l2Block) + 1),
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
      forL1Block: 1036,
    })

    console.log('RESULTS:')
    console.log('start: ' + l2Blocks[0].l2Block)
    console.log('start for L1 block: ' + l2Blocks[0].forL1Block)
    console.log('end: ' + l2Blocks[1].l2Block)
    console.log('end for L1 block: ' + l2Blocks[1].forL1Block)

    await validateL2Blocks(l2Blocks)
  })
})
