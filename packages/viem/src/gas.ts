/**
 * Gas estimation functions with viem-native type signatures.
 *
 * Functions that accept a provider use viem PublicClient.
 */
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
import { wrapPublicClient, type ViemPublicClient } from './adapter'

export async function estimateSubmissionFee(
  parentProvider: ViemPublicClient,
  network: ArbitrumNetwork,
  callDataSize: number,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateSubmissionFee(
    wrapPublicClient(parentProvider),
    network,
    callDataSize,
    opts
  )
}

export async function estimateRetryableTicketGasLimit(
  childProvider: ViemPublicClient,
  params: RetryableTicketGasParams,
  senderDeposit?: bigint
): Promise<bigint> {
  return coreEstimateRetryableTicketGasLimit(
    wrapPublicClient(childProvider),
    params,
    senderDeposit
  )
}

export async function estimateMaxFeePerGas(
  childProvider: ViemPublicClient,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateMaxFeePerGas(wrapPublicClient(childProvider), opts)
}

export async function estimateAll(
  parentProvider: ViemPublicClient,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork,
  params: RetryableTicketGasParams,
  opts?: GasOverrides
): Promise<GasEstimateResult> {
  return coreEstimateAll(
    wrapPublicClient(parentProvider),
    wrapPublicClient(childProvider),
    network,
    params,
    opts
  )
}

export async function populateFunctionParams(
  dataFunc: (params: PopulateFunctionGasParams) => PopulateFunctionTxRequest,
  parentProvider: ViemPublicClient,
  childProvider: ViemPublicClient,
  network: ArbitrumNetwork,
  gasOverrides?: GasOverrides
): Promise<PopulateFunctionResult> {
  return corePopulateFunctionParams(
    dataFunc,
    wrapPublicClient(parentProvider),
    wrapPublicClient(childProvider),
    network,
    gasOverrides
  )
}
