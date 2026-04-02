import { describe, it, expect, vi } from 'vitest'
import {
  isBold,
  getSendProps,
} from '../../src/message/rollupUtils'
import { RollupUserLogicAbi } from '../../src/abi/RollupUserLogic'
import { BoldRollupUserLogicAbi } from '../../src/abi/BoldRollupUserLogic'
import { BridgeAbi } from '../../src/abi/Bridge'
import { encodeFunctionData, encodeEventTopic } from '../../src/encoding/abi'
import { ContractCallError } from '../../src/errors'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import type { ArbitrumNetwork } from '../../src/networks'

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(1),
    getBlockNumber: vi.fn().mockResolvedValue(100000),
    getBlock: vi.fn().mockResolvedValue(null),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x' + '00'.repeat(32)),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi
      .fn()
      .mockResolvedValue({
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      }),
    ...overrides,
  }
}

const testNetwork: ArbitrumNetwork = {
  name: 'Arbitrum One',
  chainId: 42161,
  parentChainId: 1,
  ethBridge: {
    bridge: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    inbox: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    sequencerInbox: '0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6',
    outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
    rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
  },
  confirmPeriodBlocks: 45818,
  isTestnet: false,
  isCustom: false,
}

describe('isBold', () => {
  it('returns false for classic rollup (extraChallengeTimeBlocks succeeds)', async () => {
    // Classic rollup: call to extraChallengeTimeBlocks returns a uint64
    const encodedResponse =
      '0x0000000000000000000000000000000000000000000000000000000000000064' // 100
    const mockProvider = createMockProvider({
      call: vi.fn().mockResolvedValue(encodedResponse),
    })

    const result = await isBold(
      mockProvider,
      testNetwork.ethBridge.rollup
    )
    expect(result).toBe(false)
  })

  it('returns true for BOLD rollup (extraChallengeTimeBlocks reverts)', async () => {
    // BOLD rollup: call to extraChallengeTimeBlocks reverts
    const mockProvider = createMockProvider({
      call: vi.fn().mockRejectedValue(
        new ContractCallError('Call reverted', {
          isCallException: true,
        })
      ),
    })

    const result = await isBold(
      mockProvider,
      testNetwork.ethBridge.rollup
    )
    expect(result).toBe(true)
  })

  it('rethrows network-level errors', async () => {
    const mockProvider = createMockProvider({
      call: vi.fn().mockRejectedValue(new Error('network timeout')),
    })

    await expect(
      isBold(mockProvider, testNetwork.ethBridge.rollup)
    ).rejects.toThrow('network timeout')
  })
})

describe('getSendProps', () => {
  it('returns confirmed=true when confirmed assertion sendCount > event position', async () => {
    // The flow:
    // 1. Call latestConfirmed() -> returns nodeNum 5
    // 2. Call getNode(5) -> returns node with createdAtBlock
    // 3. getLogs for NodeCreated event at that block
    // 4. Parse the event to get afterState.globalState (blockHash, sendRoot)
    // 5. Provider getBlock(blockHash) to get sendCount
    // 6. Compare sendCount > event.position

    // We will mock the provider's call method to respond appropriately to
    // different function selectors
    const callMock = vi.fn()

    // latestConfirmed() returns 5
    const latestConfirmedResult =
      '0x0000000000000000000000000000000000000000000000000000000000000005'
    // getNode(5) returns a Node struct with createdAtBlock = 1000
    // The Node struct has: stateHash, challengeHash, confirmData, prevNum, deadlineBlock,
    // noChildConfirmedBeforeBlock, stakerCount, childStakerCount, firstChildBlock,
    // latestChildNumber, createdAtBlock, nodeHash
    const nodeCreatedAtBlock = 1000n
    const nodeResult =
      '0x' +
      '00'.repeat(32) + // stateHash
      '00'.repeat(32) + // challengeHash
      '00'.repeat(32) + // confirmData
      '0000000000000000000000000000000000000000000000000000000000000001' + // prevNum
      '00000000000000000000000000000000000000000000000000000000000003e8' + // deadlineBlock = 1000
      '0000000000000000000000000000000000000000000000000000000000000000' + // noChildConfirmedBeforeBlock
      '0000000000000000000000000000000000000000000000000000000000000000' + // stakerCount
      '0000000000000000000000000000000000000000000000000000000000000000' + // childStakerCount
      '0000000000000000000000000000000000000000000000000000000000000000' + // firstChildBlock
      '0000000000000000000000000000000000000000000000000000000000000000' + // latestChildNumber
      '00000000000000000000000000000000000000000000000000000000000003e8' + // createdAtBlock = 1000
      '00'.repeat(32) // nodeHash

    callMock.mockImplementation(async (request: { to: string; data: string }) => {
      const data = request.data
      // extraChallengeTimeBlocks selector
      if (data.startsWith('0x771b2f97')) {
        return '0x0000000000000000000000000000000000000000000000000000000000000064'
      }
      // latestConfirmed selector
      if (data.startsWith('0x65f7f80d')) {
        return latestConfirmedResult
      }
      // getNode selector
      if (data.startsWith('0x92c8134c')) {
        return nodeResult
      }
      return '0x'
    })

    const blockHash = '0x' + 'ab'.repeat(32)
    const sendRoot = '0x' + 'cd'.repeat(32)

    // NodeCreated event for node 5
    const nodeCreatedTopic = encodeEventTopic(RollupUserLogicAbi, 'NodeCreated')
    const nodeCreatedLogs = [
      {
        address: testNetwork.ethBridge.rollup,
        topics: [
          nodeCreatedTopic,
          '0x0000000000000000000000000000000000000000000000000000000000000005', // nodeNum
          '0x' + '00'.repeat(32), // parentNodeHash
          '0x' + '00'.repeat(32), // nodeHash
        ],
        data:
          '0x' +
          '00'.repeat(32) + // executionHash
          // assertion tuple:
          // beforeState: { globalState: { bytes32Vals: [0,0], u64Vals: [0,0] }, machineStatus: 0 }
          '00'.repeat(32) + // beforeState.globalState.bytes32Vals[0]
          '00'.repeat(32) + // beforeState.globalState.bytes32Vals[1]
          '0000000000000000000000000000000000000000000000000000000000000000' + // beforeState.globalState.u64Vals[0]
          '0000000000000000000000000000000000000000000000000000000000000000' + // beforeState.globalState.u64Vals[1]
          '0000000000000000000000000000000000000000000000000000000000000000' + // beforeState.machineStatus
          // afterState: { globalState: { bytes32Vals: [blockHash, sendRoot], u64Vals: [0,0] }, machineStatus: 0 }
          blockHash.slice(2) + // afterState.globalState.bytes32Vals[0] = blockHash
          sendRoot.slice(2) + // afterState.globalState.bytes32Vals[1] = sendRoot
          '0000000000000000000000000000000000000000000000000000000000000000' + // afterState.globalState.u64Vals[0]
          '0000000000000000000000000000000000000000000000000000000000000000' + // afterState.globalState.u64Vals[1]
          '0000000000000000000000000000000000000000000000000000000000000000' + // afterState.machineStatus
          '0000000000000000000000000000000000000000000000000000000000000064' + // numBlocks = 100
          '00'.repeat(32) + // afterInboxBatchAcc
          '0000000000000000000000000000000000000000000000000000000000000000' + // wasmModuleRoot
          '00'.repeat(32), // inboxMaxCount
        blockNumber: 1000,
        blockHash: '0x' + 'ff'.repeat(32),
        transactionHash: '0x' + 'ee'.repeat(32),
        transactionIndex: 0,
        logIndex: 0,
        removed: false,
      },
    ]

    // Mock provider for child chain - returns block with sendCount > event.position
    const childProvider = createMockProvider({
      getBlock: vi.fn().mockResolvedValue({
        hash: blockHash,
        parentHash: '0x' + '00'.repeat(32),
        number: 50000,
        timestamp: 1000000,
        nonce: '0x0',
        difficulty: 0n,
        gasLimit: 0n,
        gasUsed: 0n,
        miner: '0x' + '00'.repeat(20),
        baseFeePerGas: null,
        transactions: [],
        // Arbitrum-specific: sendRoot and sendCount
        sendRoot: sendRoot,
        sendCount: '0x100', // 256 in hex — larger than position 0x42
      }),
    })

    const parentProvider = createMockProvider({
      call: callMock,
      getLogs: vi.fn().mockResolvedValue(nodeCreatedLogs),
    })

    const event = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 1000000000000000000n,
      data: '0xdeadbeef',
    }

    const result = await getSendProps(
      parentProvider,
      childProvider,
      event,
      testNetwork
    )

    expect(result.sendRootConfirmed).toBe(true)
    expect(result.sendRootHash).toBe(sendRoot)
    expect(result.sendRootSize).toBeGreaterThan(0x42n)
  })

  it('returns confirmed=false when confirmed assertion sendCount <= event position', async () => {
    const callMock = vi.fn()

    // latestConfirmed() returns 5
    callMock.mockImplementation(async (request: { to: string; data: string }) => {
      const data = request.data
      // extraChallengeTimeBlocks
      if (data.startsWith('0x771b2f97')) {
        return '0x0000000000000000000000000000000000000000000000000000000000000064'
      }
      // latestConfirmed
      if (data.startsWith('0x65f7f80d')) {
        return '0x0000000000000000000000000000000000000000000000000000000000000005'
      }
      // getNode
      if (data.startsWith('0x92c8134c')) {
        return (
          '0x' +
          '00'.repeat(32) + // stateHash
          '00'.repeat(32) + // challengeHash
          '00'.repeat(32) + // confirmData
          '0000000000000000000000000000000000000000000000000000000000000001' + // prevNum
          '00000000000000000000000000000000000000000000000000000000000003e8' + // deadlineBlock
          '00'.repeat(32) + // noChildConfirmedBeforeBlock
          '00'.repeat(32) + // stakerCount
          '00'.repeat(32) + // childStakerCount
          '00'.repeat(32) + // firstChildBlock
          '00'.repeat(32) + // latestChildNumber
          '00000000000000000000000000000000000000000000000000000000000003e8' + // createdAtBlock = 1000
          '00'.repeat(32) // nodeHash
        )
      }
      // latestNodeCreated
      if (data.startsWith('0x7ba9534a')) {
        return '0x0000000000000000000000000000000000000000000000000000000000000005'
      }
      return '0x'
    })

    const blockHash = '0x' + 'ab'.repeat(32)
    const sendRoot = '0x' + 'cd'.repeat(32)

    const nodeCreatedTopic = encodeEventTopic(RollupUserLogicAbi, 'NodeCreated')

    const parentProvider = createMockProvider({
      call: callMock,
      getLogs: vi.fn().mockResolvedValue([
        {
          address: testNetwork.ethBridge.rollup,
          topics: [
            nodeCreatedTopic,
            '0x0000000000000000000000000000000000000000000000000000000000000005',
            '0x' + '00'.repeat(32),
            '0x' + '00'.repeat(32),
          ],
          data:
            '0x' +
            '00'.repeat(32) + // executionHash
            '00'.repeat(32) + '00'.repeat(32) + // beforeState bytes32Vals
            '00'.repeat(32) + '00'.repeat(32) + // beforeState u64Vals
            '00'.repeat(32) + // beforeState machineStatus
            blockHash.slice(2) + sendRoot.slice(2) + // afterState bytes32Vals
            '00'.repeat(32) + '00'.repeat(32) + // afterState u64Vals
            '00'.repeat(32) + // afterState machineStatus
            '00'.repeat(32) + // numBlocks
            '00'.repeat(32) + '00'.repeat(32) + '00'.repeat(32), // remaining
          blockNumber: 1000,
          blockHash: '0x' + 'ff'.repeat(32),
          transactionHash: '0x' + 'ee'.repeat(32),
          transactionIndex: 0,
          logIndex: 0,
          removed: false,
        },
      ]),
    })

    // sendCount = 0x10 = 16, which is < event position 0x42 = 66
    const childProvider = createMockProvider({
      getBlock: vi.fn().mockResolvedValue({
        hash: blockHash,
        parentHash: '0x' + '00'.repeat(32),
        number: 50000,
        timestamp: 1000000,
        nonce: '0x0',
        difficulty: 0n,
        gasLimit: 0n,
        gasUsed: 0n,
        miner: '0x' + '00'.repeat(20),
        baseFeePerGas: null,
        transactions: [],
        sendRoot: sendRoot,
        sendCount: '0x10', // 16 — smaller than position 0x42 = 66
      }),
    })

    const event = {
      caller: '0xB2e06c19eE14255889f0eC0ca37F6d0778D06754',
      destination: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      hash: 0x1234n,
      position: 0x42n,
      arbBlockNum: 0xabcdefn,
      ethBlockNum: 0xfedcban,
      timestamp: 0x63ffffffn,
      callvalue: 1000000000000000000n,
      data: '0xdeadbeef',
    }

    const result = await getSendProps(
      parentProvider,
      childProvider,
      event,
      testNetwork
    )

    expect(result.sendRootConfirmed).toBe(false)
  })
})
