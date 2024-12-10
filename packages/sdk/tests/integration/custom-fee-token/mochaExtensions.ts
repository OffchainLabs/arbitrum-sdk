import { isArbitrumNetworkWithCustomFeeToken } from './customFeeTokenTestHelpers'

const customGasTokenEnvironment = isArbitrumNetworkWithCustomFeeToken()

/**
 * Only run when in an eth chain environment
 */
export const describeOnlyWhenEth = customGasTokenEnvironment
  ? describe.skip
  : describe

/**
 * Only run when in a custom gas token chain environment
 */
export const describeOnlyWhenCustomGasToken = customGasTokenEnvironment
  ? describe
  : describe.skip

/**
 * Only run when in an eth chain environment
 */
export const itOnlyWhenEth = customGasTokenEnvironment ? it.skip : it

/**
 * Only run when in a custom gas token chain environment
 */
export const itOnlyWhenCustomGasToken = customGasTokenEnvironment ? it : it.skip
