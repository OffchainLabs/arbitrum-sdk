import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  getBlockRangesForL1Block,
  getFirstBlockForL1Block,
} from '../../src/lib/utils/lib'
import { ArbitrumProvider } from '../../src/lib/utils/arbProvider'
import { ArbBlock } from '../../src/lib/dataEntities/rpc'

describe('Child blocks lookup for a Parent block', () => {
  const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
  const arbProvider = new ArbitrumProvider(provider)

  async function validateChildBlocks({
    childBlocks,
    childBlocksCount,
    type = 'number',
  }: {
    childBlocks: (number | undefined)[]
    childBlocksCount: number
    type?: 'number' | 'undefined'
  }) {
    if (childBlocks.length !== childBlocksCount) {
      throw new Error(
        `Expected Child block range to have the array length of ${childBlocksCount}, got ${childBlocks.length}.`
      )
    }

    if (childBlocks.some(block => typeof block !== type)) {
      throw new Error(`Expected all blocks to be ${type}.`)
    }

    if (type === 'undefined') {
      return
    }

    const promises: Promise<ArbBlock>[] = []

    childBlocks.forEach((childBlock, index) => {
      if (!childBlock) {
        throw new Error('Child block is undefined.')
      }
      const isStartBlock = index === 0
      promises.push(arbProvider.getBlock(childBlock))
      // Search for previous or next block.
      promises.push(arbProvider.getBlock(childBlock + (isStartBlock ? -1 : 1)))
    })

    const [startBlock, blockBeforeStartBlock, endBlock, blockAfterEndBlock] =
      await Promise.all(promises).then(result =>
        result.map(block => BigNumber.from(block.l1BlockNumber))
      )

    if (startBlock && blockBeforeStartBlock) {
      const startBlockCondition = startBlock.gt(blockBeforeStartBlock)

      // Check if Arbitrum start block is the first block for this parent block.
      expect(
        startBlockCondition,
        `Child block is not the first block in range for parent block.`
      ).to.be.true
    }

    if (endBlock && blockAfterEndBlock) {
      const endBlockCondition = endBlock.lt(blockAfterEndBlock)

      // Check if Arbitrum end block is the last block for this parent block.
      expect(
        endBlockCondition,
        `Child block is not the last block in range for parent block.`
      ).to.be.true
    }
  }

  it('successfully searches for an Child block range', async function () {
    const childBlocks = await getBlockRangesForL1Block({
      arbitrumProvider: arbProvider,
      forL1Block: 17926532,
      // Expected result: 121907680. Narrows down the range to speed up the search.
      minArbitrumBlock: 121800000,
      maxArbitrumBlock: 122000000,
    })
    await validateChildBlocks({ childBlocks, childBlocksCount: 2 })
  })

  it('fails to search for an Child block range', async function () {
    const childBlocks = await getBlockRangesForL1Block({
      arbitrumProvider: arbProvider,
      forL1Block: 17926533,
      minArbitrumBlock: 121800000,
      maxArbitrumBlock: 122000000,
    })
    await validateChildBlocks({
      childBlocks,
      childBlocksCount: 2,
      type: 'undefined',
    })
  })

  it('successfully searches for the first Child block', async function () {
    const childBlocks = [
      await getFirstBlockForL1Block({
        arbitrumProvider: arbProvider,
        forL1Block: 17926532,
        // Expected result: 121907680. Narrows down the range to speed up the search.
        minArbitrumBlock: 121800000,
        maxArbitrumBlock: 122000000,
      }),
    ]
    await validateChildBlocks({ childBlocks, childBlocksCount: 1 })
  })

  it('fails to search for the first Child block, while not using `allowGreater` flag', async function () {
    const childBlocks = [
      await getFirstBlockForL1Block({
        arbitrumProvider: arbProvider,
        forL1Block: 17926533,
        allowGreater: false,
        minArbitrumBlock: 121800000,
        maxArbitrumBlock: 122000000,
      }),
    ]
    await validateChildBlocks({
      childBlocks,
      childBlocksCount: 1,
      type: 'undefined',
    })
  })

  it('successfully searches for the first Child block, while using `allowGreater` flag', async function () {
    const childBlocks = [
      await getFirstBlockForL1Block({
        arbitrumProvider: arbProvider,
        forL1Block: 17926533,
        allowGreater: true,
        // Expected result: 121907740. Narrows down the range to speed up the search.
        minArbitrumBlock: 121800000,
        maxArbitrumBlock: 122000000,
      }),
    ]
    await validateChildBlocks({ childBlocks, childBlocksCount: 1 })
  })
})
