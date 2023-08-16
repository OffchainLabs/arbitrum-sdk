import { BigNumber } from 'ethers'
import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  getBlockRangesForL1Block,
  getFirstBlockForL1Block,
} from '../../src/lib/utils/lib'
import { ArbitrumProvider } from '../../src/lib/utils/arbProvider'
import { ArbBlock } from '../../src/lib/dataEntities/rpc'

describe('L2 blocks lookup for an L1 block', () => {
  const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
  const arbProvider = new ArbitrumProvider(provider)

  async function validateL2Blocks({
    l2Blocks,
    l2BlocksCount,
    type = 'number',
  }: {
    l2Blocks: (number | undefined)[]
    l2BlocksCount: number
    type?: 'number' | 'undefined'
  }) {
    if (l2Blocks.length !== l2BlocksCount) {
      throw new Error(
        `Expected L2 block range to have the array length of ${l2BlocksCount}, got ${l2Blocks.length}.`
      )
    }

    if (l2Blocks.some(block => typeof block !== type)) {
      throw new Error(`Expected all blocks to be ${type}.`)
    }

    if (type === 'undefined') {
      return
    }

    const promises: Promise<ArbBlock>[] = []

    l2Blocks.forEach((l2Block, index) => {
      if (!l2Block) {
        throw new Error('L2 block is undefined.')
      }
      const isStartBlock = index === 0
      promises.push(arbProvider.getBlock(l2Block))
      // Search for previous or next block.
      promises.push(arbProvider.getBlock(l2Block + (isStartBlock ? -1 : 1)))
    })

    const [startBlock, blockBeforeStartBlock, endBlock, blockAfterEndBlock] =
      await Promise.all(promises).then(result =>
        result.map(block => BigNumber.from(block.l1BlockNumber))
      )

    if (startBlock && blockBeforeStartBlock) {
      const startBlockCondition = startBlock.gt(blockBeforeStartBlock)

      // Check if Arbitrum start block is the first block for this L1 block.
      expect(
        startBlockCondition,
        `L2 block is not the first block in range for L1 block.`
      ).to.be.true
    }

    if (endBlock && blockAfterEndBlock) {
      const endBlockCondition = endBlock.lt(blockAfterEndBlock)

      // Check if Arbitrum end block is the last block for this L1 block.
      expect(
        endBlockCondition,
        `L2 block is not the last block in range for L1 block.`
      ).to.be.true
    }
  }

  it('successfully searches for an L2 block range', async function () {
    const l2Blocks = await getBlockRangesForL1Block({
      provider: arbProvider,
      forL1Block: 17926532,
      // Expected result: 121907680. Narrows down the range to speed up the search.
      minL2Block: 121800000,
      maxL2Block: 122000000,
    })
    await validateL2Blocks({ l2Blocks, l2BlocksCount: 2 })
  })

  it('fails to search for an L2 block range', async function () {
    const l2Blocks = await getBlockRangesForL1Block({
      provider: arbProvider,
      forL1Block: 17926533,
      minL2Block: 121800000,
      maxL2Block: 122000000,
    })
    await validateL2Blocks({ l2Blocks, l2BlocksCount: 2, type: 'undefined' })
  })

  it('successfully searches for the first L2 block', async function () {
    const l2Blocks = [
      await getFirstBlockForL1Block({
        provider: arbProvider,
        forL1Block: 17926532,
        // Expected result: 121907680. Narrows down the range to speed up the search.
        minL2Block: 121800000,
        maxL2Block: 122000000,
      }),
    ]
    await validateL2Blocks({ l2Blocks, l2BlocksCount: 1 })
  })

  it('fails to search for the first L2 block, while not using `allowGreater` flag', async function () {
    const l2Blocks = [
      await getFirstBlockForL1Block({
        provider: arbProvider,
        forL1Block: 17926533,
        allowGreater: false,
        minL2Block: 121800000,
        maxL2Block: 122000000,
      }),
    ]
    await validateL2Blocks({ l2Blocks, l2BlocksCount: 1, type: 'undefined' })
  })

  it('successfully searches for the first L2 block, while using `allowGreater` flag', async function () {
    const l2Blocks = [
      await getFirstBlockForL1Block({
        provider: arbProvider,
        forL1Block: 17926533,
        allowGreater: true,
        // Expected result: 121907740. Narrows down the range to speed up the search.
        minL2Block: 121800000,
        maxL2Block: 122000000,
      }),
    ]
    await validateL2Blocks({ l2Blocks, l2BlocksCount: 1 })
  })
})
