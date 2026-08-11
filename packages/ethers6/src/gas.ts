/**
 * Gas estimation functions for ethers v6 users.
 *
 * Functions that accept a provider use ethers v6 Provider.
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
import { wrapProvider, type Ethers6Provider } from './adapter'

export async function estimateSubmissionFee(
  parentProvider: Ethers6Provider,
  network: ArbitrumNetwork,
  callDataSize: number,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateSubmissionFee(
    wrapProvider(parentProvider),
    network,
    callDataSize,
    opts
  )
}

export async function estimateRetryableTicketGasLimit(
  childProvider: Ethers6Provider,
  params: RetryableTicketGasParams,
  senderDeposit?: bigint
): Promise<bigint> {
  return coreEstimateRetryableTicketGasLimit(
    wrapProvider(childProvider),
    params,
    senderDeposit
  )
}

export async function estimateMaxFeePerGas(
  childProvider: Ethers6Provider,
  opts?: PercentIncrease
): Promise<bigint> {
  return coreEstimateMaxFeePerGas(wrapProvider(childProvider), opts)
}

export async function estimateAll(
  parentProvider: Ethers6Provider,
  childProvider: Ethers6Provider,
  network: ArbitrumNetwork,
  params: RetryableTicketGasParams,
  opts?: GasOverrides
): Promise<GasEstimateResult> {
  return coreEstimateAll(
    wrapProvider(parentProvider),
    wrapProvider(childProvider),
    network,
    params,
    opts
  )
}

export async function populateFunctionParams(
  dataFunc: (params: PopulateFunctionGasParams) => PopulateFunctionTxRequest,
  parentProvider: Ethers6Provider,
  childProvider: Ethers6Provider,
  network: ArbitrumNetwork,
  gasOverrides?: GasOverrides
): Promise<PopulateFunctionResult> {
  return corePopulateFunctionParams(
    dataFunc,
    wrapProvider(parentProvider),
    wrapProvider(childProvider),
    network,
    gasOverrides
  )
}
