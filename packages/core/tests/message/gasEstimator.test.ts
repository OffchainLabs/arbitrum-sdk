import { describe, it, expect, vi } from 'vitest'
import {
  estimateSubmissionFee,
  estimateMaxFeePerGas,
  estimateRetryableTicketGasLimit,
  estimateAll,
  populateFunctionParams,
} from '../../src/message/gasEstimator'
import { getArbitrumNetwork } from '../../src/networks'
import type { ArbitrumProvider } from '../../src/interfaces/provider'
import { encodeFunctionData, decodeFunctionResult } from '../../src/encoding/abi'
import { InboxAbi } from '../../src/abi/Inbox'

function createMockProvider(
  overrides: Partial<ArbitrumProvider> = {}
): ArbitrumProvider {
  return {
    getChainId: vi.fn().mockResolvedValue(1),
    getBlockNumber: vi.fn().mockResolvedValue(100),
    getBlock: vi.fn().mockResolvedValue({
      hash: '0x',
      parentHash: '0x',
      number: 100,
      timestamp: 1000,
      nonce: '0x',
      difficulty: 0n,
      gasLimit: 30000000n,
      gasUsed: 0n,
      miner: '0x0000000000000000000000000000000000000000',
      baseFeePerGas: 1000000000n, // 1 gwei
      transactions: [],
    }),
    getTransactionReceipt: vi.fn().mockResolvedValue(null),
    call: vi.fn().mockResolvedValue('0x' + '0'.repeat(64)),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getBalance: vi.fn().mockResolvedValue(0n),
    getCode: vi.fn().mockResolvedValue('0x'),
    getStorageAt: vi.fn().mockResolvedValue('0x0'),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    getLogs: vi.fn().mockResolvedValue([]),
    getFeeData: vi.fn().mockResolvedValue({
      gasPrice: 100000000n, // 0.1 gwei
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    }),
    ...overrides,
  }
}

describe('Gas Estimator', () => {
  const network = getArbitrumNetwork(42161)

  describe('estimateMaxFeePerGas', () => {
    it('returns gas price with default 500% multiplier', async () => {
      const gasPrice = 100000000n // 0.1 gwei
      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
      })

      const result = await estimateMaxFeePerGas(childProvider)

      // 100000000 + (100000000 * 500 / 100) = 100000000 + 500000000 = 600000000
      expect(result).toBe(600000000n)
    })

    it('uses custom percent increase', async () => {
      const gasPrice = 1000n
      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
      })

      const result = await estimateMaxFeePerGas(childProvider, {
        percentIncrease: 100n,
      })

      // 1000 + (1000 * 100 / 100) = 2000
      expect(result).toBe(2000n)
    })

    it('uses base override when provided', async () => {
      const childProvider = createMockProvider()

      const result = await estimateMaxFeePerGas(childProvider, {
        base: 5000n,
        percentIncrease: 200n,
      })

      // 5000 + (5000 * 200 / 100) = 5000 + 10000 = 15000
      expect(result).toBe(15000n)
    })
  })

  describe('estimateSubmissionFee', () => {
    it('calls Inbox.calculateRetryableSubmissionFee on parent chain', async () => {
      // Encode a mock return value: a uint256 of 1000
      const mockReturnValue =
        '0x' + 1000n.toString(16).padStart(64, '0')

      const mockCall = vi.fn().mockResolvedValue(mockReturnValue)
      const parentProvider = createMockProvider({ call: mockCall })

      const result = await estimateSubmissionFee(
        parentProvider,
        network,
        100 // calldata size
      )

      // Should have called the parent provider
      expect(mockCall).toHaveBeenCalled()
      const callArg = mockCall.mock.calls[0][0]
      expect(callArg.to).toBe(network.ethBridge.inbox)

      // Default 300% increase: 1000 + (1000 * 300 / 100) = 4000
      expect(result).toBe(4000n)
    })

    it('uses base override when provided', async () => {
      const parentProvider = createMockProvider()

      const result = await estimateSubmissionFee(
        parentProvider,
        network,
        100,
        { base: 500n, percentIncrease: 100n }
      )

      // 500 + (500 * 100 / 100) = 1000
      expect(result).toBe(1000n)
    })
  })

  describe('estimateRetryableTicketGasLimit', () => {
    it('calls estimateGas targeting NodeInterface', async () => {
      const mockEstimateGas = vi.fn().mockResolvedValue(500000n)
      const childProvider = createMockProvider({
        estimateGas: mockEstimateGas,
      })

      const result = await estimateRetryableTicketGasLimit(childProvider, {
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        l2CallValue: 0n,
        excessFeeRefundAddress: '0x0000000000000000000000000000000000000001',
        callValueRefundAddress: '0x0000000000000000000000000000000000000001',
        data: '0x',
      })

      expect(result).toBe(500000n)
      expect(mockEstimateGas).toHaveBeenCalled()

      // Verify it targets the NodeInterface address
      const callArg = mockEstimateGas.mock.calls[0][0]
      expect(callArg.to).toBe('0x00000000000000000000000000000000000000C8')
    })
  })

  describe('estimateAll', () => {
    it('returns all gas parameters', async () => {
      const gasPrice = 1000000000n // 1 gwei
      const submissionFee = 10000000000000n // 0.00001 ETH

      const parentProvider = createMockProvider({
        call: vi.fn().mockResolvedValue(
          '0x' + submissionFee.toString(16).padStart(64, '0')
        ),
      })

      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        estimateGas: vi.fn().mockResolvedValue(100000n),
      })

      const result = await estimateAll(
        parentProvider,
        childProvider,
        network,
        {
          from: '0x0000000000000000000000000000000000000001',
          to: '0x0000000000000000000000000000000000000002',
          l2CallValue: 0n,
          excessFeeRefundAddress:
            '0x0000000000000000000000000000000000000001',
          callValueRefundAddress:
            '0x0000000000000000000000000000000000000001',
          data: '0x',
        }
      )

      expect(result.gasLimit).toBeTypeOf('bigint')
      expect(result.maxSubmissionCost).toBeTypeOf('bigint')
      expect(result.maxFeePerGas).toBeTypeOf('bigint')
      expect(result.deposit).toBeTypeOf('bigint')

      // gasLimit should be the estimated value (no default increase)
      expect(result.gasLimit).toBe(100000n)
      // maxFeePerGas = 1 gwei + 500% = 6 gwei
      expect(result.maxFeePerGas).toBe(6000000000n)
      // deposit = gasLimit * maxFeePerGas + maxSubmissionCost + l2CallValue
      expect(result.deposit).toBe(
        result.gasLimit * result.maxFeePerGas +
          result.maxSubmissionCost +
          0n
      )
    })

    it('respects gas limit min override', async () => {
      const parentProvider = createMockProvider({
        call: vi.fn().mockResolvedValue(
          '0x' + (1000n).toString(16).padStart(64, '0')
        ),
      })

      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice: 1000n,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        estimateGas: vi.fn().mockResolvedValue(100n), // very low
      })

      const result = await estimateAll(
        parentProvider,
        childProvider,
        network,
        {
          from: '0x0000000000000000000000000000000000000001',
          to: '0x0000000000000000000000000000000000000002',
          l2CallValue: 0n,
          excessFeeRefundAddress:
            '0x0000000000000000000000000000000000000001',
          callValueRefundAddress:
            '0x0000000000000000000000000000000000000001',
          data: '0x',
        },
        { gasLimit: { min: 275000n } }
      )

      // Should use the min because estimated (100) < min (275000)
      expect(result.gasLimit).toBe(275000n)
    })
  })

  describe('populateFunctionParams', () => {
    // ABI to encode a RetryableData error as if it were a function call
    // (same parameter shape, so the selector matches)
    const retryableErrorAbi = [
      {
        type: 'function',
        name: 'RetryableData',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'l2CallValue', type: 'uint256' },
          { name: 'deposit', type: 'uint256' },
          { name: 'maxSubmissionCost', type: 'uint256' },
          { name: 'excessFeeRefundAddress', type: 'address' },
          { name: 'callValueRefundAddress', type: 'address' },
          { name: 'gasLimit', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
        stateMutability: 'view',
      },
    ] as const

    const sampleFrom = '0x1111111111111111111111111111111111111111'
    const sampleTo = '0x2222222222222222222222222222222222222222'
    const routerAddress = '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef'

    it('performs two-pass gas estimation: dummy call -> parse revert -> estimate -> real call', async () => {
      // Build a mock RetryableData revert payload
      const retryableDataHex = encodeFunctionData(
        retryableErrorAbi as unknown as readonly unknown[],
        'RetryableData',
        [
          sampleFrom,
          sampleTo,
          0n, // l2CallValue
          2000000n, // deposit
          300000n, // maxSubmissionCost
          sampleFrom, // excessFeeRefundAddress
          sampleFrom, // callValueRefundAddress
          500000n, // gasLimit
          100000000n, // maxFeePerGas
          '0xdeadbeef', // data
        ]
      )

      const submissionFee = 10000n

      // Parent provider: first call returns RetryableData revert, subsequent calls return submission fee
      const parentCallMock = vi.fn().mockImplementation(() => {
        // Return the retryable data hex (simulating the revert data being returned as the response)
        return Promise.resolve(retryableDataHex)
      })

      // For submission fee, we also use call on the parent
      // We need to differentiate: first call is the dummy tx call, second is the inbox call
      let callCount = 0
      parentCallMock.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: dummy tx call returning retryable data
          return Promise.resolve(retryableDataHex)
        }
        // Subsequent calls: submission fee from inbox
        return Promise.resolve('0x' + submissionFee.toString(16).padStart(64, '0'))
      })

      const parentProvider = createMockProvider({
        call: parentCallMock,
      })

      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice: 1000000000n, // 1 gwei
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        estimateGas: vi.fn().mockResolvedValue(100000n),
      })

      // dataFunc: takes gas params and returns a tx request
      let dataFuncCallCount = 0
      const dataFunc = vi.fn().mockImplementation(
        (params: { gasLimit: bigint; maxFeePerGas: bigint; maxSubmissionCost: bigint }) => {
          dataFuncCallCount++
          return {
            to: routerAddress,
            data: '0x' + 'ab'.repeat(32),
            value: params.gasLimit * params.maxFeePerGas + params.maxSubmissionCost,
            from: sampleFrom,
          }
        }
      )

      const result = await populateFunctionParams(
        dataFunc,
        parentProvider,
        childProvider,
        network
      )

      // dataFunc should have been called twice: once with dummy params, once with real params
      expect(dataFunc).toHaveBeenCalledTimes(2)

      // First call should use error-triggering params
      const firstCallArgs = dataFunc.mock.calls[0][0]
      expect(firstCallArgs.gasLimit).toBe(1n)
      expect(firstCallArgs.maxFeePerGas).toBe(1n)

      // Second call should use real estimated params
      const secondCallArgs = dataFunc.mock.calls[1][0]
      expect(secondCallArgs.gasLimit).toBeTypeOf('bigint')
      expect(secondCallArgs.maxFeePerGas).toBeTypeOf('bigint')
      expect(secondCallArgs.maxSubmissionCost).toBeTypeOf('bigint')

      // Result should have estimates, retryable data, and final tx data
      expect(result.estimates).toBeDefined()
      expect(result.estimates.gasLimit).toBeTypeOf('bigint')
      expect(result.estimates.maxFeePerGas).toBeTypeOf('bigint')
      expect(result.estimates.maxSubmissionCost).toBeTypeOf('bigint')
      expect(result.estimates.deposit).toBeTypeOf('bigint')
      expect(result.retryable).toBeDefined()
      expect(result.retryable.from.toLowerCase()).toBe(sampleFrom.toLowerCase())
      expect(result.data).toBeDefined()
      expect(result.to).toBe(routerAddress)
      expect(result.value).toBeTypeOf('bigint')
    })

    it('parses retryable data from error when call throws', async () => {
      const retryableDataHex = encodeFunctionData(
        retryableErrorAbi as unknown as readonly unknown[],
        'RetryableData',
        [
          sampleFrom,
          sampleTo,
          0n,
          2000000n,
          300000n,
          sampleFrom,
          sampleFrom,
          500000n,
          100000000n,
          '0x',
        ]
      )

      const submissionFee = 10000n

      let callCount = 0
      const parentCallMock = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call throws with retryable data as data property
          const err = new Error('execution reverted') as Error & { data?: string }
          err.data = retryableDataHex
          return Promise.reject(err)
        }
        return Promise.resolve('0x' + submissionFee.toString(16).padStart(64, '0'))
      })

      const parentProvider = createMockProvider({
        call: parentCallMock,
      })

      const childProvider = createMockProvider({
        getFeeData: vi.fn().mockResolvedValue({
          gasPrice: 1000000000n,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        estimateGas: vi.fn().mockResolvedValue(100000n),
      })

      const dataFunc = vi.fn().mockImplementation(
        (params: { gasLimit: bigint; maxFeePerGas: bigint; maxSubmissionCost: bigint }) => ({
          to: routerAddress,
          data: '0x' + 'ab'.repeat(32),
          value: params.gasLimit * params.maxFeePerGas + params.maxSubmissionCost,
          from: sampleFrom,
        })
      )

      const result = await populateFunctionParams(
        dataFunc,
        parentProvider,
        childProvider,
        network
      )

      expect(result.retryable).toBeDefined()
      expect(result.retryable.from.toLowerCase()).toBe(sampleFrom.toLowerCase())
      expect(result.estimates).toBeDefined()
    })

    it('throws when no retryable data can be parsed', async () => {
      const parentProvider = createMockProvider({
        call: vi.fn().mockResolvedValue('0xdeadbeef'),
      })

      const childProvider = createMockProvider()

      const dataFunc = vi.fn().mockImplementation(() => ({
        to: routerAddress,
        data: '0xdeadbeef',
        value: 0n,
        from: sampleFrom,
      }))

      await expect(
        populateFunctionParams(dataFunc, parentProvider, childProvider, network)
      ).rejects.toThrow()
    })
  })
})
