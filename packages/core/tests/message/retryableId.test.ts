import { describe, it, expect } from 'vitest'
import {
  calculateSubmitRetryableId,
  calculateDepositTxId,
} from '../../src/message/retryableId'

describe('calculateSubmitRetryableId', () => {
  it('computes the correct retryable ticket ID for a known mainnet transaction', () => {
    // Known values from mainnet tx 0x00000a61331187be51ab9ae792d74f601a5a21fb112f5b9ac5bccb23d4d5aaba
    // Expected retryable creation ID: 0x8ba13904639c7444d8578cc582a230b8501c9f0f7903f5069d276fdd3a7dea44
    // (from packages/sdk/tests/unit/parentToChildMessageEvents.test.ts)
    //
    // The sender is the L2 alias of the original sender:
    //   original sender = 0xd92023E9d9911199a6711321D1277285e6d4e2db (L1GatewayRouter)
    //   aliased sender = 0xeA3123E9d9911199a6711321d1277285e6d4F3EC
    const result = calculateSubmitRetryableId({
      chainId: 42161,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      messageNumber: 0x504cn,
      baseFee: 0x05e0fc4c58n,
      destAddress: '0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B',
      l2CallValue: 0x0853a0d2313c0000n,
      l1Value: 0x0854e8ab1802ca80n,
      maxSubmissionFee: 0x01270f6740d880n,
      excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      gasLimit: 0x01d566n,
      maxFeePerGas: 0x11e1a300n,
      data: '0x2e567b36000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d06754000000000000000000000000a2e06c19ee14255889f0ec0ca37f6d0778d067540000000000000000000000000000000000000000000000000853a0d2313c000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    })

    expect(result).toBe(
      '0x8ba13904639c7444d8578cc582a230b8501c9f0f7903f5069d276fdd3a7dea44'
    )
  })

  it('produces deterministic results for the same inputs', () => {
    const params = {
      chainId: 42161,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      messageNumber: 100n,
      baseFee: 1000000000n,
      destAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      l2CallValue: 0n,
      l1Value: 0x063eb89da4ed0000n,
      maxSubmissionFee: 0x2c912972d8n,
      excessFeeRefundAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      callValueRefundAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      gasLimit: 100000n,
      maxFeePerGas: 1000000000n,
      data: '0xdeadbeef',
    }

    const result1 = calculateSubmitRetryableId(params)
    const result2 = calculateSubmitRetryableId(params)

    expect(result1).toBe(result2)
    expect(result1).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('produces different IDs for different message numbers', () => {
    const baseParams = {
      chainId: 42161,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      baseFee: 1000000000n,
      destAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      l2CallValue: 0n,
      l1Value: 100000n,
      maxSubmissionFee: 50000n,
      excessFeeRefundAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      callValueRefundAddress: '0xa928c403Af1993eB309451a3559F8946E7d81F7F',
      gasLimit: 100000n,
      maxFeePerGas: 1000000000n,
      data: '0x',
    }

    const id1 = calculateSubmitRetryableId({ ...baseParams, messageNumber: 1n })
    const id2 = calculateSubmitRetryableId({ ...baseParams, messageNumber: 2n })

    expect(id1).not.toBe(id2)
  })

  it('handles zero address dest (treated as nil)', () => {
    // When destAddress is the zero address, the RLP encoding uses 0x (empty bytes)
    // instead of the address itself
    const withZero = calculateSubmitRetryableId({
      chainId: 42161,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      messageNumber: 1n,
      baseFee: 0n,
      destAddress: '0x0000000000000000000000000000000000000000',
      l2CallValue: 0n,
      l1Value: 0n,
      maxSubmissionFee: 0n,
      excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      gasLimit: 0n,
      maxFeePerGas: 0n,
      data: '0x',
    })

    const withNonZero = calculateSubmitRetryableId({
      chainId: 42161,
      fromAddress: '0xeA3123E9d9911199a6711321d1277285e6d4F3EC',
      messageNumber: 1n,
      baseFee: 0n,
      destAddress: '0x0000000000000000000000000000000000000001',
      l2CallValue: 0n,
      l1Value: 0n,
      maxSubmissionFee: 0n,
      excessFeeRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      callValueRefundAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      gasLimit: 0n,
      maxFeePerGas: 0n,
      data: '0x',
    })

    // Both should produce valid hashes but they should be different
    expect(withZero).toMatch(/^0x[0-9a-f]{64}$/)
    expect(withNonZero).toMatch(/^0x[0-9a-f]{64}$/)
    expect(withZero).not.toBe(withNonZero)
  })
})

describe('calculateDepositTxId', () => {
  it('computes a valid ETH deposit transaction ID', () => {
    const result = calculateDepositTxId({
      chainId: 42161,
      messageNumber: 1n,
      fromAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      toAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      value: 1000000000000000000n, // 1 ETH
    })

    // Should produce a valid 66-char hex hash
    expect(result).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('produces different IDs for different message numbers', () => {
    const params = {
      chainId: 42161,
      fromAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      toAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      value: 1000000000000000000n,
    }

    const id1 = calculateDepositTxId({ ...params, messageNumber: 1n })
    const id2 = calculateDepositTxId({ ...params, messageNumber: 2n })

    expect(id1).not.toBe(id2)
  })

  it('produces different IDs for different chain IDs', () => {
    const params = {
      messageNumber: 1n,
      fromAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      toAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      value: 1000000000000000000n,
    }

    const arb1 = calculateDepositTxId({ ...params, chainId: 42161 })
    const nova = calculateDepositTxId({ ...params, chainId: 42170 })

    expect(arb1).not.toBe(nova)
  })

  it('produces different IDs for different values', () => {
    const params = {
      chainId: 42161,
      messageNumber: 1n,
      fromAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      toAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
    }

    const id1 = calculateDepositTxId({ ...params, value: 1000000000000000000n })
    const id2 = calculateDepositTxId({ ...params, value: 2000000000000000000n })

    expect(id1).not.toBe(id2)
  })

  it('handles zero value deposits', () => {
    const result = calculateDepositTxId({
      chainId: 42161,
      messageNumber: 0n,
      fromAddress: '0xa2e06c19EE14255889f0Ec0cA37f6D0778D06754',
      toAddress: '0x0000000000000000000000000000000000000001',
      value: 0n,
    })

    expect(result).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
