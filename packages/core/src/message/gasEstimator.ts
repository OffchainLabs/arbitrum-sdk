/**
 * Gas estimation for retryable tickets (Parent -> Child messages).
 *
 * All functions are read-only and use ArbitrumProvider for chain calls.
 * No ethers/viem dependencies.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { InboxAbi } from '../abi/Inbox'
import { NodeInterfaceAbi } from '../abi/NodeInterface'
import { NODE_INTERFACE_ADDRESS } from '../constants'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumNetwork } from '../networks'

/**
 * Per-field override options for gas estimation.
 */
export interface PercentIncrease {
  /** If provided, overrides the estimated base value. */
  base?: bigint
  /** Percentage increase to apply. e.g. 300 = 3x buffer. */
  percentIncrease?: bigint
}

export interface GasOverrides {
  gasLimit?: PercentIncrease & { min?: bigint }
  maxSubmissionFee?: PercentIncrease
  maxFeePerGas?: PercentIncrease
  deposit?: Pick<PercentIncrease, 'base'>
}

export interface RetryableTicketGasParams {
  /** Sender on the parent chain. */
  from: string
  /** Destination on the child chain. */
  to: string
  /** Value to send to the L2 destination. */
  l2CallValue: bigint
  /** Address for excess fee refunds. */
  excessFeeRefundAddress: string
  /** Address for call value refunds. */
  callValueRefundAddress: string
  /** Calldata for the L2 execution. */
  data: string
}

export interface GasEstimateResult {
  /** Estimated gas limit for the retryable ticket. */
  gasLimit: bigint
  /** Maximum submission cost. */
  maxSubmissionCost: bigint
  /** Maximum fee per gas on the child chain. */
  maxFeePerGas: bigint
  /** Total deposit required = gasLimit * maxFeePerGas + maxSubmissionCost + l2CallValue. */
  deposit: bigint
}

// Defaults match the old SDK
const DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE = 300n
const DEFAULT_GAS_PRICE_PERCENT_INCREASE = 500n
const DEFAULT_GAS_LIMIT_PERCENT_INCREASE = 0n

function percentIncrease(num: bigint, increase: bigint): bigint {
  return num + (num * increase) / 100n
}

/**
 * Estimate the submission fee for a retryable ticket.
 *
 * Calls `Inbox.calculateRetryableSubmissionFee(dataLength, baseFee)` on the parent chain.
 */
export async function estimateSubmissionFee(
  parentProvider: ArbitrumProvider,
  network: ArbitrumNetwork,
  callDataSize: number,
  opts?: PercentIncrease
): Promise<bigint> {
  const increase =
    opts?.percentIncrease ?? DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE

  if (opts?.base !== undefined) {
    return percentIncrease(opts.base, increase)
  }

  // Get parent base fee from latest block
  const block = await parentProvider.getBlock('latest')
  const baseFee = block?.baseFeePerGas ?? 0n

  const inbox = new ArbitrumContract(
    InboxAbi,
    network.ethBridge.inbox
  ).connect(parentProvider)

  const [fee] = await inbox.read('calculateRetryableSubmissionFee', [
    callDataSize,
    baseFee,
  ])

  return percentIncrease(fee as bigint, increase)
}

/**
 * Estimate the gas limit for a retryable ticket by calling
 * `NodeInterface.estimateRetryableTicket()` on the child chain.
 *
 * The NodeInterface is a precompile at a fixed address on Arbitrum chains.
 */
export async function estimateRetryableTicketGasLimit(
  childProvider: ArbitrumProvider,
  params: RetryableTicketGasParams,
  senderDeposit?: bigint
): Promise<bigint> {
  const deposit =
    senderDeposit ?? 10n ** 18n + params.l2CallValue // 1 ETH + l2CallValue

  const nodeInterface = new ArbitrumContract(
    NodeInterfaceAbi,
    NODE_INTERFACE_ADDRESS
  ).connect(childProvider)

  // estimateRetryableTicket is a non-view function that uses estimateGas
  // We simulate it via estimateGas on the child chain
  const data = nodeInterface.encodeFunctionData('estimateRetryableTicket', [
    params.from,
    deposit,
    params.to,
    params.l2CallValue,
    params.excessFeeRefundAddress,
    params.callValueRefundAddress,
    params.data,
  ])

  return childProvider.estimateGas({
    to: NODE_INTERFACE_ADDRESS,
    data,
    from: params.from,
  })
}

/**
 * Estimate the max fee per gas on the child chain.
 *
 * Queries the child chain's current gas price and applies a buffer.
 */
export async function estimateMaxFeePerGas(
  childProvider: ArbitrumProvider,
  opts?: PercentIncrease
): Promise<bigint> {
  const increase =
    opts?.percentIncrease ?? DEFAULT_GAS_PRICE_PERCENT_INCREASE

  if (opts?.base !== undefined) {
    return percentIncrease(opts.base, increase)
  }

  const feeData = await childProvider.getFeeData()
  const gasPrice = feeData.gasPrice ?? 0n

  return percentIncrease(gasPrice, increase)
}

/**
 * Estimate all gas parameters for a retryable ticket at once.
 *
 * Returns gasLimit, maxSubmissionCost, maxFeePerGas, and total deposit.
 */
export async function estimateAll(
  parentProvider: ArbitrumProvider,
  childProvider: ArbitrumProvider,
  network: ArbitrumNetwork,
  params: RetryableTicketGasParams,
  opts?: GasOverrides
): Promise<GasEstimateResult> {
  const gasLimitIncrease =
    opts?.gasLimit?.percentIncrease ?? DEFAULT_GAS_LIMIT_PERCENT_INCREASE
  const gasLimitMin = opts?.gasLimit?.min ?? 0n

  // Get hex data length for submission fee calculation
  const dataHex = params.data.startsWith('0x')
    ? params.data.slice(2)
    : params.data
  const callDataSize = dataHex.length / 2

  // Run estimates in parallel
  const [maxFeePerGasResult, maxSubmissionCostResult, gasLimitBase] =
    await Promise.all([
      estimateMaxFeePerGas(childProvider, opts?.maxFeePerGas),
      estimateSubmissionFee(
        parentProvider,
        network,
        callDataSize,
        opts?.maxSubmissionFee
      ),
      opts?.gasLimit?.base !== undefined
        ? Promise.resolve(opts.gasLimit.base)
        : estimateRetryableTicketGasLimit(
            childProvider,
            params,
            opts?.deposit?.base
          ),
    ])

  const calculatedGasLimit = percentIncrease(gasLimitBase, gasLimitIncrease)
  const gasLimit =
    calculatedGasLimit > gasLimitMin ? calculatedGasLimit : gasLimitMin

  const deposit =
    opts?.deposit?.base ??
    gasLimit * maxFeePerGasResult +
      maxSubmissionCostResult +
      params.l2CallValue

  return {
    gasLimit,
    maxSubmissionCost: maxSubmissionCostResult,
    maxFeePerGas: maxFeePerGasResult,
    deposit,
  }
}
