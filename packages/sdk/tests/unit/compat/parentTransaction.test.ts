import { describe, it, expect, vi } from 'vitest'
import { BigNumber, constants } from 'ethers'
import type { TransactionReceipt, Log } from '@ethersproject/providers'
import type { ContractTransaction } from '@ethersproject/contracts'
import {
  ParentTransactionReceipt,
  ParentEthDepositTransactionReceipt,
  ParentContractCallTransactionReceipt,
} from '../../../src/compat/parentTransaction'

/**
 * Build a minimal ethers TransactionReceipt for testing.
 */
function makeEthersReceipt(
  overrides: Partial<TransactionReceipt> = {}
): TransactionReceipt {
  return {
    to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    contractAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    transactionIndex: 5,
    gasUsed: BigNumber.from(21000),
    logsBloom: '0x' + '00'.repeat(256),
    blockHash: '0x' + 'ee'.repeat(32),
    transactionHash: '0x' + 'ff'.repeat(32),
    logs: [],
    blockNumber: 12345,
    confirmations: 10,
    cumulativeGasUsed: BigNumber.from(100000),
    effectiveGasPrice: BigNumber.from(1000000000),
    byzantium: true,
    type: 2,
    status: 1,
    ...overrides,
  }
}

describe('ParentTransactionReceipt', () => {
  it('constructor copies all receipt fields', () => {
    const receipt = makeEthersReceipt()
    const wrapped = new ParentTransactionReceipt(receipt)

    expect(wrapped.to).toBe(receipt.to)
    expect(wrapped.from).toBe(receipt.from)
    expect(wrapped.contractAddress).toBe(receipt.contractAddress)
    expect(wrapped.transactionIndex).toBe(receipt.transactionIndex)
    expect(wrapped.gasUsed.eq(receipt.gasUsed)).toBe(true)
    expect(wrapped.logsBloom).toBe(receipt.logsBloom)
    expect(wrapped.blockHash).toBe(receipt.blockHash)
    expect(wrapped.transactionHash).toBe(receipt.transactionHash)
    expect(wrapped.logs).toBe(receipt.logs)
    expect(wrapped.blockNumber).toBe(receipt.blockNumber)
    expect(wrapped.confirmations).toBe(receipt.confirmations)
    expect(wrapped.cumulativeGasUsed.eq(receipt.cumulativeGasUsed)).toBe(true)
    expect(wrapped.effectiveGasPrice.eq(receipt.effectiveGasPrice)).toBe(true)
    expect(wrapped.byzantium).toBe(receipt.byzantium)
    expect(wrapped.type).toBe(receipt.type)
    expect(wrapped.status).toBe(receipt.status)
  })

  describe('monkeyPatchWait', () => {
    it('returns a tx whose wait() returns ParentTransactionReceipt', async () => {
      const innerReceipt = makeEthersReceipt()
      const mockTx = {
        hash: '0x' + 'aa'.repeat(32),
        wait: vi.fn().mockResolvedValue(innerReceipt),
      } as unknown as ContractTransaction

      const patched = ParentTransactionReceipt.monkeyPatchWait(mockTx)
      const result = await patched.wait()

      expect(result).toBeInstanceOf(ParentTransactionReceipt)
      expect(result.transactionHash).toBe(innerReceipt.transactionHash)
    })
  })

  describe('monkeyPatchEthDepositWait', () => {
    it('returns a tx whose wait() returns ParentEthDepositTransactionReceipt', async () => {
      const innerReceipt = makeEthersReceipt()
      const mockTx = {
        hash: '0x' + 'aa'.repeat(32),
        wait: vi.fn().mockResolvedValue(innerReceipt),
      } as unknown as ContractTransaction

      const patched = ParentTransactionReceipt.monkeyPatchEthDepositWait(mockTx)
      const result = await patched.wait()

      expect(result).toBeInstanceOf(ParentEthDepositTransactionReceipt)
      expect(result.transactionHash).toBe(innerReceipt.transactionHash)
    })
  })

  describe('monkeyPatchContractCallWait', () => {
    it('returns a tx whose wait() returns ParentContractCallTransactionReceipt', async () => {
      const innerReceipt = makeEthersReceipt()
      const mockTx = {
        hash: '0x' + 'aa'.repeat(32),
        wait: vi.fn().mockResolvedValue(innerReceipt),
      } as unknown as ContractTransaction

      const patched =
        ParentTransactionReceipt.monkeyPatchContractCallWait(mockTx)
      const result = await patched.wait()

      expect(result).toBeInstanceOf(ParentContractCallTransactionReceipt)
      expect(result.transactionHash).toBe(innerReceipt.transactionHash)
    })
  })

  describe('getMessageDeliveredEvents', () => {
    it('parses MessageDelivered events from logs', () => {
      // MessageDelivered event topic (from Bridge contract)
      const messageDeliveredTopic =
        '0x5e3c1311ea442664e8b1611bfabef659120ea7a0a2cfc0667700bebc69cbffe1'

      const receipt = makeEthersReceipt({
        logs: [
          {
            address: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
            topics: [
              messageDeliveredTopic,
              '0x000000000000000000000000000000000000000000000000000000000000504c', // messageIndex
              '0x2a5dcbed3d730861a810a913641dd7b8d5ff3ee20b716517934795dcef1fa7a7', // beforeInboxAcc
            ],
            data:
              '0x' +
              '0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f' + // inbox
              '0000000000000000000000000000000000000000000000000000000000000009' + // kind
              '000000000000000000000000ea3123e9d9911199a6711321d1277285e6d4f3ec' + // sender
              '33b030be5f0dd0f325a650d7517584f9d94942bfcd0fa5f05d5ebeeb5e409af1' + // messageDataHash
              '00000000000000000000000000000000000000000000000000000005e0fc4c58' + // baseFeeL1
              '00000000000000000000000000000000000000000000000000000000631abc80', // timestamp
            blockNumber: 15500657,
            blockHash:
              '0xe5b6457bc2ec1bb39a88cee7f294ea3ad41b76d1069fd2e69c5959b4ffd6dd56',
            transactionHash:
              '0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba',
            transactionIndex: 323,
            logIndex: 446,
            removed: false,
          },
        ],
      })

      const wrapped = new ParentTransactionReceipt(receipt)
      const events = wrapped.getMessageDeliveredEvents()

      expect(events).toHaveLength(1)
      expect(events[0].args.messageIndex).toBe(0x504cn)
      expect(events[0].args.kind).toBe(9n)
    })

    it('returns empty array when no matching events', () => {
      const receipt = makeEthersReceipt({ logs: [] })
      const wrapped = new ParentTransactionReceipt(receipt)
      const events = wrapped.getMessageDeliveredEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('getInboxMessageDeliveredEvents', () => {
    it('returns empty array when no matching events', () => {
      const receipt = makeEthersReceipt({ logs: [] })
      const wrapped = new ParentTransactionReceipt(receipt)
      const events = wrapped.getInboxMessageDeliveredEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('getTokenDepositEvents', () => {
    it('returns empty array when no matching events', () => {
      const receipt = makeEthersReceipt({ logs: [] })
      const wrapped = new ParentTransactionReceipt(receipt)
      const events = wrapped.getTokenDepositEvents()
      expect(events).toHaveLength(0)
    })
  })
})
