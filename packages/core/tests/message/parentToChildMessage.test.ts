import { describe, it, expect, vi } from 'vitest'
import {
  ParentToChildMessageReader,
  getParentToChildMessages,
  getRedeemRequest,
  getCancelRetryableRequest,
  getKeepAliveRequest,
} from '../../src/message/parentToChildMessage'
import { ParentToChildMessageStatus } from '../../src/message/types'
import { encodeEventTopic, encodeFunctionData } from '../../src/encoding/abi'
import { BridgeAbi } from '../../src/abi/Bridge'
import { InboxAbi } from '../../src/abi/Inbox'
import { ArbRetryableTxAbi } from '../../src/abi/ArbRetryableTx'
import { ARB_RETRYABLE_TX_ADDRESS } from '../../src/constants'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import type {
  ArbitrumLog,
  ArbitrumTransactionReceipt,
} from '../../src/interfaces/types'
import type { ArbitrumNetwork } from '../../src/networks'

function makeReceipt(logs: ArbitrumLog[]): ArbitrumTransactionReceipt {
  return {
    to: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
    from: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
    contractAddress: null,
    transactionHash:
      '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
    transactionIndex: 323,
    blockHash:
      '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
    blockNumber: 15500657,
    status: 1,
    logs,
    gasUsed: 21000n,
    effectiveGasPrice: 1000000000n,
    cumulativeGasUsed: 21000n,
  }
}

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(42161),
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

// Build the mainnet fixture logs
function getMainnetFixtureLogs(): ArbitrumLog[] {
  const bridgeTopic = encodeEventTopic(BridgeAbi, 'MessageDelivered')
  const inboxTopic = encodeEventTopic(InboxAbi, 'InboxMessageDelivered')

  const bridgeLog: ArbitrumLog = {
    address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    topics: [
      bridgeTopic,
      '0x000000000000000000000000000000000000000000000000000000000000504c',
      '0x2a5dcbed3d730861a810a913641dd7b8d5ff3ee20b716517934795dcef1fa7a7',
    ],
    data:
      '0x' +
      '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' +
      '0000000000000000000000000000000000000000000000000000000000000009' +
      '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' +
      '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' +
      '00000000000000000000000000000000000000000000000000000005e0fc4c58' +
      '00000000000000000000000000000000000000000000000000000000631abc80',
    blockNumber: 15500657,
    blockHash:
      '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
    transactionHash:
      '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
    transactionIndex: 323,
    logIndex: 446,
    removed: false,
  }

  const inboxLog: ArbitrumLog = {
    address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    topics: [
      inboxTopic,
      '0x000000000000000000000000000000000000000000000000000000000000504c',
    ],
    // Exact data from mainnet tx 0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba
    data: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000002640000000000000000000000006c411ad3e74de3e7bd422b94a27770f5b86c623b0000000000000000000000000000000000000000000000000853a0d2313c00000000000000000000000000000000000000000000000000000854e8ab1802ca800000000000000000000000000000000000000000000000000001270f6740d880000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000000000000000000000000000000000000001d5660000000000000000000000000000000000000000000000000000000011e1a30000000000000000000000000000000000000000000000000000000000000001442e567b36000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d067540000000000000000000000000000000000000000000000000853a0d2313c000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    blockNumber: 15500657,
    blockHash:
      '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
    transactionHash:
      '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
    transactionIndex: 323,
    logIndex: 447,
    removed: false,
  }

  return [bridgeLog, inboxLog]
}

describe('getParentToChildMessages', () => {
  it('returns ParentToChildMessageReader instances from receipt events', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt(getMainnetFixtureLogs())

    const messages = getParentToChildMessages(receipt, mockProvider, testNetwork)

    expect(messages).toHaveLength(1)
    expect(messages[0]).toBeInstanceOf(ParentToChildMessageReader)
  })

  it('computes correct retryableCreationId from mainnet fixture', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt(getMainnetFixtureLogs())

    const messages = getParentToChildMessages(receipt, mockProvider, testNetwork)

    // Known retryable creation ID from the SDK test fixture
    expect(messages[0].retryableCreationId).toBe(
      '0x8ba13904639c7444d8578cc582a230b8501c9f0f7903f5069d276fdd3a7dea44'
    )
  })

  it('parses message data correctly', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt(getMainnetFixtureLogs())

    const messages = getParentToChildMessages(receipt, mockProvider, testNetwork)
    const msg = messages[0]

    expect(msg.chainId).toBe(42161)
    expect(msg.sender).toBe('0xeA3123E9d9911199a6711321d1277285e6d4F3EC')
    expect(msg.messageNumber).toBe(0x504cn)
    expect(msg.parentBaseFee).toBe(0x05e0fc4c58n)
    expect(msg.messageData.destAddress).toBe(
      '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B'
    )
    expect(msg.messageData.l2CallValue).toBe(0x0853a0d2313c0000n)
    expect(msg.messageData.l1Value).toBe(0x0854e8ab1802ca80n)
    expect(msg.messageData.maxSubmissionFee).toBe(0x01270f6740d880n)
    expect(msg.messageData.excessFeeRefundAddress).toBe(
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754'
    )
    expect(msg.messageData.callValueRefundAddress).toBe(
      '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754'
    )
    expect(msg.messageData.gasLimit).toBe(0x01d566n)
    expect(msg.messageData.maxFeePerGas).toBe(0x11e1a300n)
  })

  it('returns empty array when no retryable events exist', () => {
    const mockProvider = createMockProvider()
    const receipt = makeReceipt([])
    const messages = getParentToChildMessages(receipt, mockProvider, testNetwork)
    expect(messages).toHaveLength(0)
  })
})

describe('ParentToChildMessageReader status', () => {
  it('returns NOT_YET_CREATED when no creation receipt exists', async () => {
    const mockProvider = createMockProvider({
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
    })

    const reader = new ParentToChildMessageReader(
      mockProvider,
      42161,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      0x504cn,
      0x05e0fc4c58n,
      {
        destAddress: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
        l2CallValue: 0x0853a0d2313c0000n,
        l1Value: 0x0854e8ab1802ca80n,
        maxSubmissionFee: 0x01270f6740d880n,
        excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        gasLimit: 0x01d566n,
        maxFeePerGas: 0x11e1a300n,
        data: '0x',
      }
    )

    const status = await reader.status()
    expect(status).toBe(ParentToChildMessageStatus.NOT_YET_CREATED)
  })

  it('returns CREATION_FAILED when creation receipt has status 0', async () => {
    const failedReceipt: ArbitrumTransactionReceipt = {
      to: null,
      from: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      contractAddress: null,
      transactionHash: '0x' + 'cc'.repeat(32),
      transactionIndex: 0,
      blockHash: '0x' + 'dd'.repeat(32),
      blockNumber: 50000,
      status: 0, // failure
      logs: [],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }

    const mockProvider = createMockProvider({
      getTransactionReceipt: vi.fn().mockResolvedValue(failedReceipt),
    })

    const reader = new ParentToChildMessageReader(
      mockProvider,
      42161,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      0x504cn,
      0x05e0fc4c58n,
      {
        destAddress: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
        l2CallValue: 0x0853a0d2313c0000n,
        l1Value: 0x0854e8ab1802ca80n,
        maxSubmissionFee: 0x01270f6740d880n,
        excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        gasLimit: 0x01d566n,
        maxFeePerGas: 0x11e1a300n,
        data: '0x',
      }
    )

    const status = await reader.status()
    expect(status).toBe(ParentToChildMessageStatus.CREATION_FAILED)
  })

  it('returns REDEEMED when auto-redeem succeeded', async () => {
    // Build a creation receipt that contains a RedeemScheduled event
    const redeemTopic = encodeEventTopic(ArbRetryableTxAbi, 'RedeemScheduled')
    const ticketId = '0x' + 'ab'.repeat(32)
    const retryTxHash = '0x' + 'cd'.repeat(32)
    const sequenceNum =
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    const redeemLog: ArbitrumLog = {
      address: ARB_RETRYABLE_TX_ADDRESS,
      topics: [redeemTopic, ticketId, retryTxHash, sequenceNum],
      data:
        '0x' +
        '0000000000000000000000000000000000000000000000000000000000002710' +
        '000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754' +
        '00000000000000000000000000000000000000000000000000038d7ea4c68000' +
        '00000000000000000000000000000000000000000000000000005af3107a4000',
      blockNumber: 50000100,
      blockHash: '0x' + 'ee'.repeat(32),
      transactionHash: '0x' + 'ff'.repeat(32),
      transactionIndex: 0,
      logIndex: 2,
      removed: false,
    }

    const creationReceipt: ArbitrumTransactionReceipt = {
      to: null,
      from: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      contractAddress: null,
      transactionHash: '0x' + 'ff'.repeat(32),
      transactionIndex: 0,
      blockHash: '0x' + 'ee'.repeat(32),
      blockNumber: 50000100,
      status: 1,
      logs: [redeemLog],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }

    const redeemReceipt: ArbitrumTransactionReceipt = {
      to: null,
      from: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      contractAddress: null,
      transactionHash: retryTxHash,
      transactionIndex: 0,
      blockHash: '0x' + '11'.repeat(32),
      blockNumber: 50000101,
      status: 1,
      logs: [],
      gasUsed: 21000n,
      effectiveGasPrice: 1000000000n,
      cumulativeGasUsed: 21000n,
    }

    // Mock: first call returns creation receipt, second returns redeem receipt
    const getTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce(creationReceipt) // getRetryableCreationReceipt
      .mockResolvedValueOnce(redeemReceipt) // getAutoRedeemAttempt -> getTransactionReceipt(retryTxHash)

    const mockProvider = createMockProvider({ getTransactionReceipt })

    const reader = new ParentToChildMessageReader(
      mockProvider,
      42161,
      '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      0x504cn,
      0x05e0fc4c58n,
      {
        destAddress: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
        l2CallValue: 0x0853a0d2313c0000n,
        l1Value: 0x0854e8ab1802ca80n,
        maxSubmissionFee: 0x01270f6740d880n,
        excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
        gasLimit: 0x01d566n,
        maxFeePerGas: 0x11e1a300n,
        data: '0x',
      }
    )

    const result = await reader.getSuccessfulRedeem()
    expect(result.status).toBe(ParentToChildMessageStatus.REDEEMED)
    if (result.status === ParentToChildMessageStatus.REDEEMED) {
      expect(result.childTxReceipt.transactionHash).toBe(retryTxHash)
    }
  })
})

describe('Action request functions', () => {
  it('getRedeemRequest returns TransactionRequestData with correct target', () => {
    const ticketId = '0x' + 'ab'.repeat(32)
    const request = getRedeemRequest(ticketId)

    expect(request.to).toBe(ARB_RETRYABLE_TX_ADDRESS)
    expect(request.value).toBe(0n)
    expect(request.data).toBeTruthy()

    // Verify the calldata encodes redeem(bytes32)
    const expectedData = encodeFunctionData(ArbRetryableTxAbi, 'redeem', [
      ticketId,
    ])
    expect(request.data).toBe(expectedData)
  })

  it('getCancelRetryableRequest returns correct TransactionRequestData', () => {
    const ticketId = '0x' + 'ab'.repeat(32)
    const request = getCancelRetryableRequest(ticketId)

    expect(request.to).toBe(ARB_RETRYABLE_TX_ADDRESS)
    expect(request.value).toBe(0n)

    const expectedData = encodeFunctionData(ArbRetryableTxAbi, 'cancel', [
      ticketId,
    ])
    expect(request.data).toBe(expectedData)
  })

  it('getKeepAliveRequest returns correct TransactionRequestData', () => {
    const ticketId = '0x' + 'ab'.repeat(32)
    const request = getKeepAliveRequest(ticketId)

    expect(request.to).toBe(ARB_RETRYABLE_TX_ADDRESS)
    expect(request.value).toBe(0n)

    const expectedData = encodeFunctionData(ArbRetryableTxAbi, 'keepalive', [
      ticketId,
    ])
    expect(request.data).toBe(expectedData)
  })
})
