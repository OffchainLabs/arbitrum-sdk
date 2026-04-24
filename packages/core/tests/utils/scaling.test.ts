import { describe, it, expect } from 'vitest'
import {
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
} from '../../src/utils/lib'

// 1.23456789 ether = 1234567890000000000 wei
const AMOUNT_TO_SCALE = 1234567890000000000n

describe('Scaling functions', () => {
  describe('scaleFrom18DecimalsToNativeTokenDecimals', () => {
    it('identity for 18 decimals', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 18,
        })
      ).toBe(1234567890000000000n)
    })

    it('scales to 0 decimals and rounds up', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 0,
        })
      ).toBe(2n)
    })

    it('scales to 1 decimal and rounds up', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 1,
        })
      ).toBe(13n)
    })

    it('scales to 6 decimals and rounds up', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 6,
        })
      ).toBe(1234568n)
    })

    it('scales to 7 decimals and rounds up', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 7,
        })
      ).toBe(12345679n)
    })

    it('scales to 8 decimals without rounding (all digits included)', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 8,
        })
      ).toBe(123456789n)
    })

    it('scales to 9 decimals without rounding', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 9,
        })
      ).toBe(1234567890n)
    })

    it('scales up for 24 decimals', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 24,
        })
      ).toBe(1234567890000000000000000n)
    })

    it('rounds up: never returns zero for non-zero input with fewer decimals', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: 1n,
          decimals: 6,
        })
      ).toBe(1n)
    })

    it('returns zero for zero input', () => {
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: 0n,
          decimals: 6,
        })
      ).toBe(0n)
    })

    it('handles 1 ether scaled to 6 decimals', () => {
      // 1e18 -> 1e6
      expect(
        scaleFrom18DecimalsToNativeTokenDecimals({
          amount: 1000000000000000000n,
          decimals: 6,
        })
      ).toBe(1000000n)
    })
  })

  describe('scaleFromNativeTokenDecimalsTo18Decimals', () => {
    it('identity for 18 decimals', () => {
      expect(
        scaleFromNativeTokenDecimalsTo18Decimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 18,
        })
      ).toBe(1234567890000000000n)
    })

    it('scales up from 16 decimals to 18', () => {
      expect(
        scaleFromNativeTokenDecimalsTo18Decimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 16,
        })
      ).toBe(123456789000000000000n)
    })

    it('scales down from 20 decimals to 18', () => {
      expect(
        scaleFromNativeTokenDecimalsTo18Decimals({
          amount: AMOUNT_TO_SCALE,
          decimals: 20,
        })
      ).toBe(12345678900000000n)
    })

    it('scales up from 6 decimals: 1000000 -> 1e18', () => {
      expect(
        scaleFromNativeTokenDecimalsTo18Decimals({
          amount: 1000000n,
          decimals: 6,
        })
      ).toBe(1000000000000000000n)
    })
  })
})
