'use strict'

import { expect } from 'chai'

import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import {
  scaleFromNativeTokenDecimalsTo18Decimals,
  scaleFrom18DecimalsToNativeTokenDecimals,
} from '../../src/lib/utils/lib'

const AMOUNT_TO_SCALE = parseEther('1.23456789')

describe('Native token', () => {
  function decimalsToError(decimals: number) {
    return `incorrect scaling result for ${decimals} decimals`
  }

  it('scales to native token decimals', () => {
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 18,
      }).eq(BigNumber.from('1234567890000000000')),
      decimalsToError(18)
    ).to.be.true

    // Rounds up the last digit - in this case no decimals so rounds up 1 to 2
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 0,
      }).eq(BigNumber.from('2')),
      decimalsToError(0)
    ).to.be.true

    // Rounds up the last digit
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 1,
      }).eq(BigNumber.from('13')),
      decimalsToError(1)
    ).to.be.true

    // Rounds up the last digit
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 6,
      }).eq(BigNumber.from('1234568')),
      decimalsToError(6)
    ).to.be.true

    // Rounds up the last digit
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 7,
      }).eq(BigNumber.from('12345679')),
      decimalsToError(7)
    ).to.be.true

    // Does not round up the last digit because all original decimals are included
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 8,
      }).eq(BigNumber.from('123456789')),
      decimalsToError(8)
    ).to.be.true

    // Does not round up the last digit because all original decimals are included
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 9,
      }).eq(BigNumber.from('1234567890')),
      decimalsToError(9)
    ).to.be.true

    // Does not round up the last digit because all original decimals are included
    expect(
      scaleFrom18DecimalsToNativeTokenDecimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 24,
      }).eq(BigNumber.from('1234567890000000000000000')),
      decimalsToError(24)
    ).to.be.true
  })

  it('scales native token decimals to 18 decimals', () => {
    expect(
      scaleFromNativeTokenDecimalsTo18Decimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 16,
      }).eq(BigNumber.from('123456789000000000000')),
      decimalsToError(16)
    ).to.be.true

    expect(
      scaleFromNativeTokenDecimalsTo18Decimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 18,
      }).eq(BigNumber.from('1234567890000000000')),
      decimalsToError(18)
    ).to.be.true

    expect(
      scaleFromNativeTokenDecimalsTo18Decimals({
        amount: AMOUNT_TO_SCALE,
        decimals: 20,
      }).eq(BigNumber.from('12345678900000000')),
      decimalsToError(20)
    ).to.be.true
  })
})
