/**
 * Gas estimation functions for ethers v5 users.
 *
 * Functions that accept a provider use ethers v5 Provider.
 */
import type { providers } from 'ethers'
import {
  estimateSubmissionFee as coreEstimateSubmissionFee,
  estimateRetryableTicketGasLimit as coreEstimateRetryableTicketGasLimit,
  estimateMaxFeePerGas as coreEstimateMaxFeePerGas,
  estimateAll as coreEstimateAll,
  populateFunctionParams as corePopulateFunctionParams,
} from '@arbitrum/core'
import type {
  ArbitrumNetwork,
  PercentIncrease,
  GasOverrides,
  RetryableTicketGasParams,
  GasEstimateResult,
  PopulateFunctionGasParams,
  PopulateFunctionTxRequest,
  PopulateFunctionResult,
} from '@arbitrum/core'
import { wrapProvider, type Ethers5Provider } from './adapter'

export async function estimateSubmissionFee(
  parentProvider: providers.Provider,
  network: ArbitrumNetwork,
  callDataSize: number,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateSubmissionFee(
    wrapProvider(parentProvider as unknown as Ethers5Provider),
    network,
    callDataSize,
    opts
  )
}

export async function estimateRetryableTicketGasLimit(
  childProvider: providers.Provider,
  params: RetryableTicketGasParams,
  senderDeposit?: bigint
): Promise<bigint> {
  return coreEstimateRetryableTicketGasLimit(
    wrapProvider(childProvider as unknown as Ethers5Provider),
    params,
    senderDeposit
  )
}

export async function estimateMaxFeePerGas(
  childProvider: providers.Provider,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateMaxFeePerGas(
    wrapProvider(childProvider as unknown as Ethers5Provider),
    opts
  )
}

export async function estimateAll(
  parentProvider: providers.Provider,
  childProvider: providers.Provider,
  network: ArbitrumNetwork,
  params: RetryableTicketGasParams,
  opts?: GasOverrides
): Promise<GasEstimateResult> {
  return coreEstimateAll(
    wrapProvider(parentProvider as unknown as Ethers5Provider),
    wrapProvider(childProvider as unknown as Ethers5Provider),
    network,
    params,
    opts
  )
}

export async function populateFunctionParams(
  dataFunc: (params: PopulateFunctionGasParams) => PopulateFunctionTxRequest,
  parentProvider: providers.Provider,
  childProvider: providers.Provider,
  network: ArbitrumNetwork,
  gasOverrides?: GasOverrides
): Promise<PopulateFunctionResult> {
  return corePopulateFunctionParams(
    dataFunc,
    wrapProvider(parentProvider as unknown as Ethers5Provider),
    wrapProvider(childProvider as unknown as Ethers5Provider),
    network,
    gasOverrides
  )
}
