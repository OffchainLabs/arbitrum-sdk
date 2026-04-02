import { describe, it, expect } from 'vitest'
import { RetryableDataTools } from '../src/retryableData'
import { encodeFunctionData } from '../src/encoding/abi'

/**
 * The error ABI for RetryableData:
 * error RetryableData(
 *   address from, address to, uint256 l2CallValue, uint256 deposit,
 *   uint256 maxSubmissionCost, address excessFeeRefundAddress,
 *   address callValueRefundAddress, uint256 gasLimit, uint256 maxFeePerGas,
 *   bytes data
 * )
 *
 * We encode sample data to create a known error payload, then parse it.
 */

// ABI for encoding the error as if it were a function (same parameter shape)
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
const sampleL2CallValue = 1000000n
const sampleDeposit = 2000000n
const sampleMaxSubmissionCost = 300000n
const sampleExcessFeeRefundAddress =
  '0x3333333333333333333333333333333333333333'
const sampleCallValueRefundAddress =
  '0x4444444444444444444444444444444444444444'
const sampleGasLimit = 500000n
const sampleMaxFeePerGas = 100000000n
const sampleData = '0xdeadbeef'

// Build the encoded error data. The error selector is the first 4 bytes of
// keccak256('RetryableData(address,address,uint256,uint256,uint256,address,address,uint256,uint256,bytes)')
// which happens to match the function selector since the signature is the same.
const encodedCalldata = encodeFunctionData(
  retryableErrorAbi as unknown as readonly unknown[],
  'RetryableData',
  [
    sampleFrom,
    sampleTo,
    sampleL2CallValue,
    sampleDeposit,
    sampleMaxSubmissionCost,
    sampleExcessFeeRefundAddress,
    sampleCallValueRefundAddress,
    sampleGasLimit,
    sampleMaxFeePerGas,
    sampleData,
  ]
)

describe('RetryableDataTools', () => {
  describe('tryParseError', () => {
    it('parses known error data string correctly', () => {
      const result = RetryableDataTools.tryParseError(encodedCalldata)
      expect(result).not.toBeNull()
      expect(result!.from.toLowerCase()).toBe(sampleFrom.toLowerCase())
      expect(result!.to.toLowerCase()).toBe(sampleTo.toLowerCase())
      expect(result!.l2CallValue).toBe(sampleL2CallValue)
      expect(result!.deposit).toBe(sampleDeposit)
      expect(result!.maxSubmissionCost).toBe(sampleMaxSubmissionCost)
      expect(result!.excessFeeRefundAddress.toLowerCase()).toBe(
        sampleExcessFeeRefundAddress.toLowerCase()
      )
      expect(result!.callValueRefundAddress.toLowerCase()).toBe(
        sampleCallValueRefundAddress.toLowerCase()
      )
      expect(result!.gasLimit).toBe(sampleGasLimit)
      expect(result!.maxFeePerGas).toBe(sampleMaxFeePerGas)
      expect(result!.data).toBe(sampleData)
    })

    it('returns null for non-error data', () => {
      expect(RetryableDataTools.tryParseError('not-error-data')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(RetryableDataTools.tryParseError('')).toBeNull()
    })

    it('returns null for random hex', () => {
      expect(RetryableDataTools.tryParseError('0xabcdef')).toBeNull()
    })

    it('parses error from error object with errorData field', () => {
      const result = RetryableDataTools.tryParseError({
        errorData: encodedCalldata,
      })
      expect(result).not.toBeNull()
      expect(result!.from.toLowerCase()).toBe(sampleFrom.toLowerCase())
    })

    it('parses error from error object with data field', () => {
      const errorObj = new Error('some error') as Error & { data?: string }
      errorObj.data = encodedCalldata
      const result = RetryableDataTools.tryParseError(errorObj)
      expect(result).not.toBeNull()
      expect(result!.from.toLowerCase()).toBe(sampleFrom.toLowerCase())
    })

    it('returns null for Error without data', () => {
      expect(RetryableDataTools.tryParseError(new Error('no data'))).toBeNull()
    })

    it('has ErrorTriggeringParams with bigint values', () => {
      expect(RetryableDataTools.ErrorTriggeringParams.gasLimit).toBe(1n)
      expect(RetryableDataTools.ErrorTriggeringParams.maxFeePerGas).toBe(1n)
    })
  })
})
