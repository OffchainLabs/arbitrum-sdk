import { describe, it, expect } from 'vitest'
import { BigNumber, constants } from 'ethers'
import type { TransactionReceipt, Log } from '@ethersproject/providers'
import type { ArbitrumTransactionReceipt, ArbitrumLog } from '@arbitrum/core'
import {
  toBigInt,
  toBigNumber,
  toCoreReceipt,
  toEthersReceipt,
  toCoreLog,
  toEthersLog,
} from '../../../src/compat/convert'

describe('convert utilities', () => {
  describe('toBigInt / toBigNumber round-trips', () => {
    it('converts BigNumber(0) to 0n and back', () => {
      const bn = BigNumber.from(0)
      const bi = toBigInt(bn)
      expect(bi).toBe(0n)
      expect(toBigNumber(bi).eq(bn)).toBe(true)
    })

    it('converts a large BigNumber to bigint and back', () => {
      const bn = BigNumber.from('123456789012345678901234567890')
      const bi = toBigInt(bn)
      expect(bi).toBe(123456789012345678901234567890n)
      expect(toBigNumber(bi).eq(bn)).toBe(true)
    })

    it('converts negative BigNumber to bigint and back', () => {
      const bn = BigNumber.from(-42)
      const bi = toBigInt(bn)
      expect(bi).toBe(-42n)
      expect(toBigNumber(bi).eq(bn)).toBe(true)
    })

    it('converts BigNumber.from(1) to 1n', () => {
      expect(toBigInt(BigNumber.from(1))).toBe(1n)
    })

    it('converts 1n to BigNumber(1)', () => {
      expect(toBigNumber(1n).eq(BigNumber.from(1))).toBe(true)
    })
  })

  describe('Log conversion', () => {
    const ethersLog: Log = {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      topics: [
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      data: '0xdeadbeef',
      blockNumber: 100,
      blockHash:
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      transactionHash:
        '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      transactionIndex: 3,
      logIndex: 7,
      removed: false,
    }

    it('toCoreLog preserves all fields', () => {
      const coreLog = toCoreLog(ethersLog)
      expect(coreLog.address).toBe(ethersLog.address)
      expect(coreLog.topics).toEqual(ethersLog.topics)
      expect(coreLog.data).toBe(ethersLog.data)
      expect(coreLog.blockNumber).toBe(ethersLog.blockNumber)
      expect(coreLog.blockHash).toBe(ethersLog.blockHash)
      expect(coreLog.transactionHash).toBe(ethersLog.transactionHash)
      expect(coreLog.transactionIndex).toBe(ethersLog.transactionIndex)
      expect(coreLog.logIndex).toBe(ethersLog.logIndex)
      expect(coreLog.removed).toBe(ethersLog.removed)
    })

    it('toEthersLog preserves all fields', () => {
      const coreLog: ArbitrumLog = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        topics: ['0xaa' + '00'.repeat(31)],
        data: '0x1234',
        blockNumber: 200,
        blockHash: '0x' + 'ee'.repeat(32),
        transactionHash: '0x' + 'ff'.repeat(32),
        transactionIndex: 5,
        logIndex: 10,
        removed: true,
      }

      const result = toEthersLog(coreLog)
      expect(result.address).toBe(coreLog.address)
      expect(result.topics).toEqual(coreLog.topics)
      expect(result.data).toBe(coreLog.data)
      expect(result.blockNumber).toBe(coreLog.blockNumber)
      expect(result.blockHash).toBe(coreLog.blockHash)
      expect(result.transactionHash).toBe(coreLog.transactionHash)
      expect(result.transactionIndex).toBe(coreLog.transactionIndex)
      expect(result.logIndex).toBe(coreLog.logIndex)
      expect(result.removed).toBe(coreLog.removed)
    })

    it('round-trips ethers Log -> core Log -> ethers Log', () => {
      const coreLog = toCoreLog(ethersLog)
      const backToEthers = toEthersLog(coreLog)
      expect(backToEthers.address).toBe(ethersLog.address)
      expect(backToEthers.topics).toEqual(ethersLog.topics)
      expect(backToEthers.data).toBe(ethersLog.data)
      expect(backToEthers.blockNumber).toBe(ethersLog.blockNumber)
      expect(backToEthers.logIndex).toBe(ethersLog.logIndex)
    })
  })

  describe('Receipt conversion', () => {
    const ethersReceipt: TransactionReceipt = {
      to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      contractAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      transactionIndex: 5,
      root: '0x' + 'dd'.repeat(32),
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
    }

    it('toCoreReceipt converts all fields', () => {
      const coreReceipt = toCoreReceipt(ethersReceipt)
      expect(coreReceipt.to).toBe(ethersReceipt.to)
      expect(coreReceipt.from).toBe(ethersReceipt.from)
      expect(coreReceipt.contractAddress).toBe(ethersReceipt.contractAddress)
      expect(coreReceipt.transactionIndex).toBe(ethersReceipt.transactionIndex)
      expect(coreReceipt.blockHash).toBe(ethersReceipt.blockHash)
      expect(coreReceipt.transactionHash).toBe(ethersReceipt.transactionHash)
      expect(coreReceipt.blockNumber).toBe(ethersReceipt.blockNumber)
      expect(coreReceipt.status).toBe(ethersReceipt.status)
      expect(coreReceipt.gasUsed).toBe(21000n)
      expect(coreReceipt.cumulativeGasUsed).toBe(100000n)
      expect(coreReceipt.effectiveGasPrice).toBe(1000000000n)
      expect(coreReceipt.logs).toEqual([])
    })

    it('toCoreReceipt converts logs inside the receipt', () => {
      const receiptWithLogs: TransactionReceipt = {
        ...ethersReceipt,
        logs: [
          {
            address: '0x1111111111111111111111111111111111111111',
            topics: ['0x' + 'ab'.repeat(32)],
            data: '0xcd',
            blockNumber: 12345,
            blockHash: '0x' + 'ee'.repeat(32),
            transactionHash: '0x' + 'ff'.repeat(32),
            transactionIndex: 5,
            logIndex: 0,
            removed: false,
          },
        ],
      }

      const coreReceipt = toCoreReceipt(receiptWithLogs)
      expect(coreReceipt.logs).toHaveLength(1)
      expect(coreReceipt.logs[0].address).toBe(
        '0x1111111111111111111111111111111111111111'
      )
    })

    it('toEthersReceipt converts all fields', () => {
      const coreReceipt: ArbitrumTransactionReceipt = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        contractAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        transactionIndex: 5,
        blockHash: '0x' + 'ee'.repeat(32),
        transactionHash: '0x' + 'ff'.repeat(32),
        blockNumber: 12345,
        status: 1,
        logs: [],
        gasUsed: 21000n,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
      }

      const result = toEthersReceipt(coreReceipt)
      expect(result.to).toBe(coreReceipt.to)
      expect(result.from).toBe(coreReceipt.from)
      expect(result.contractAddress).toBe(coreReceipt.contractAddress)
      expect(result.transactionIndex).toBe(coreReceipt.transactionIndex)
      expect(result.blockHash).toBe(coreReceipt.blockHash)
      expect(result.transactionHash).toBe(coreReceipt.transactionHash)
      expect(result.blockNumber).toBe(coreReceipt.blockNumber)
      expect(result.status).toBe(coreReceipt.status)
      expect(result.gasUsed.eq(BigNumber.from(21000))).toBe(true)
      expect(result.cumulativeGasUsed.eq(BigNumber.from(100000))).toBe(true)
      expect(result.effectiveGasPrice.eq(BigNumber.from(1000000000))).toBe(true)
      expect(result.byzantium).toBe(true)
      expect(result.confirmations).toBe(0)
      expect(result.type).toBe(0)
    })

    it('round-trips receipt ethers -> core -> ethers preserving values', () => {
      const coreReceipt = toCoreReceipt(ethersReceipt)
      const backToEthers = toEthersReceipt(coreReceipt)
      expect(backToEthers.to).toBe(ethersReceipt.to)
      expect(backToEthers.from).toBe(ethersReceipt.from)
      expect(backToEthers.transactionHash).toBe(ethersReceipt.transactionHash)
      expect(backToEthers.gasUsed.eq(ethersReceipt.gasUsed)).toBe(true)
      expect(
        backToEthers.effectiveGasPrice.eq(ethersReceipt.effectiveGasPrice)
      ).toBe(true)
    })
  })
})
