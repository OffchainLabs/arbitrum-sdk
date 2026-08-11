/**
 * ERC-20 L1→L3 teleportation functions.
 *
 * Returns TransactionRequestData for teleporting ERC-20 tokens from L1 to L3
 * via the IL1Teleporter contract. The SDK never signs or sends.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { IL1TeleporterAbi } from '../abi/IL1Teleporter'
import { ERC20Abi } from '../abi/ERC20'
import type { ArbitrumNetwork } from '../networks'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { TransactionRequestData } from '../interfaces/types'
import { ADDRESS_ZERO } from '../constants'
import { ArbSdkError } from '../errors'

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Gas parameters for the teleporter's retryable tickets.
 * These map directly to IL1Teleporter.RetryableGasParams.
 */
export interface TeleporterRetryableGasParams {
  l2GasPriceBid: bigint
  l3GasPriceBid: bigint
  l2ForwarderFactoryGasLimit: bigint
  l1l2FeeTokenBridgeGasLimit: bigint
  l1l2TokenBridgeGasLimit: bigint
  l2l3TokenBridgeGasLimit: bigint
  l2ForwarderFactoryMaxSubmissionCost: bigint
  l1l2FeeTokenBridgeMaxSubmissionCost: bigint
  l1l2TokenBridgeMaxSubmissionCost: bigint
  l2l3TokenBridgeMaxSubmissionCost: bigint
}

export interface GetErc20L1L3DepositRequestParams {
  /** The L2 network (parent of L3). Must have teleporter contracts. */
  l2Network: ArbitrumNetwork
  /** The L3 network (child). */
  l3Network: ArbitrumNetwork
  /** L1 address of the ERC-20 token. */
  erc20L1Address: string
  /** Amount of tokens to teleport. */
  amount: bigint
  /** Sender/depositor address on L1. */
  from: string
  /** L1 provider (for reading teleporter fees). */
  l1Provider: ArbitrumProvider
  /** L2 provider. */
  l2Provider: ArbitrumProvider
  /** L3 provider. */
  l3Provider: ArbitrumProvider
  /** Destination address on L3. Defaults to `from`. */
  destinationAddress?: string
  /** Gas parameters for the teleporter's retryable tickets. */
  gasParams: TeleporterRetryableGasParams
  /**
   * L1 address of the L3's fee token. Defaults to ADDRESS_ZERO for ETH-native L3s.
   * For custom fee token L3s, set this to the fee token's L1 address.
   */
  l3FeeTokenL1Addr?: string
}

export interface Erc20L1L3DepositRequestResult {
  /** Transaction request to send. */
  txRequest: TransactionRequestData
  /** Amount of fee token required (0 for ETH-native L3s). */
  gasTokenAmount: bigint
}

export interface GetErc20L1L3ApproveTokenRequestParams {
  /** The L2 network. Must have teleporter contracts. */
  l2Network: ArbitrumNetwork
  /** L1 address of the ERC-20 token. */
  erc20L1Address: string
  /** Sender address. */
  from: string
  /** Amount to approve. Defaults to max uint256. */
  amount?: bigint
}

export interface GetErc20L1L3ApproveGasTokenRequestParams {
  /** The L2 network. Must have teleporter contracts. */
  l2Network: ArbitrumNetwork
  /** L1 address of the gas token (the L3's fee token on L1). */
  gasTokenL1Address: string
  /** Sender address. */
  from: string
  /** Amount to approve. Defaults to max uint256. */
  amount?: bigint
}

// ────────────────────────────────────────────────────────────────────────────
// Functions
// ────────────────────────────────────────────────────────────────────────────

function assertHasTeleporter(
  network: ArbitrumNetwork
): asserts network is ArbitrumNetwork & { teleporter: NonNullable<ArbitrumNetwork['teleporter']> } {
  if (!network.teleporter) {
    throw new ArbSdkError(
      `Network ${network.name} does not have teleporter contracts`
    )
  }
}

/**
 * Build a transaction request for teleporting ERC-20 tokens from L1 to L3
 * via the IL1Teleporter contract.
 *
 * The caller must provide gas parameters for the retryable tickets.
 * The function calls `determineTypeAndFees` on-chain to get the required
 * ETH value and fee token amount.
 */
export async function getErc20L1L3DepositRequest(
  params: GetErc20L1L3DepositRequestParams
): Promise<Erc20L1L3DepositRequestResult> {
  const {
    l2Network,
    l3Network,
    erc20L1Address,
    amount,
    from,
    l1Provider,
    gasParams,
  } = params

  assertHasTeleporter(l2Network)

  const destinationAddress = params.destinationAddress ?? from

  // Determine the fee token address on L1.
  // For ETH-native L3s, this is ADDRESS_ZERO.
  const l3FeeTokenL1Addr = params.l3FeeTokenL1Addr ?? ADDRESS_ZERO

  // Determine whether to use the L3 token bridge router or L3 inbox.
  // If the token being bridged IS the fee token, the L2 forwarder sends via
  // the inbox (OnlyGasToken path). Otherwise it uses the L2→L3 gateway router.
  const tokenIsFeeToken =
    l3FeeTokenL1Addr !== ADDRESS_ZERO &&
    erc20L1Address.toLowerCase() === l3FeeTokenL1Addr.toLowerCase()

  const l2l3RouterOrInbox = tokenIsFeeToken
    ? l3Network.ethBridge.inbox
    : l3Network.tokenBridge
      ? l3Network.tokenBridge.parentGatewayRouter
      : l3Network.ethBridge.inbox

  // Build the TeleportParams struct
  const teleportParams = {
    l1Token: erc20L1Address,
    l3FeeTokenL1Addr,
    l1l2Router: l2Network.tokenBridge!.parentGatewayRouter,
    l2l3RouterOrInbox,
    to: destinationAddress,
    amount,
    gasParams: {
      l2GasPriceBid: gasParams.l2GasPriceBid,
      l3GasPriceBid: gasParams.l3GasPriceBid,
      l2ForwarderFactoryGasLimit: gasParams.l2ForwarderFactoryGasLimit,
      l1l2FeeTokenBridgeGasLimit: gasParams.l1l2FeeTokenBridgeGasLimit,
      l1l2TokenBridgeGasLimit: gasParams.l1l2TokenBridgeGasLimit,
      l2l3TokenBridgeGasLimit: gasParams.l2l3TokenBridgeGasLimit,
      l2ForwarderFactoryMaxSubmissionCost:
        gasParams.l2ForwarderFactoryMaxSubmissionCost,
      l1l2FeeTokenBridgeMaxSubmissionCost:
        gasParams.l1l2FeeTokenBridgeMaxSubmissionCost,
      l1l2TokenBridgeMaxSubmissionCost:
        gasParams.l1l2TokenBridgeMaxSubmissionCost,
      l2l3TokenBridgeMaxSubmissionCost:
        gasParams.l2l3TokenBridgeMaxSubmissionCost,
    },
  }

  // Call determineTypeAndFees on-chain to get required ETH and fee token amounts
  const teleporterContract = new ArbitrumContract(
    IL1TeleporterAbi,
    l2Network.teleporter.l1Teleporter,
    l1Provider
  )

  const [ethAmount, feeTokenAmount] = await teleporterContract.read(
    'determineTypeAndFees',
    [teleportParams]
  )

  // Encode the teleport calldata
  const teleporter = new ArbitrumContract(
    IL1TeleporterAbi,
    l2Network.teleporter.l1Teleporter
  )
  const data = teleporter.encodeFunctionData('teleport', [teleportParams])

  return {
    txRequest: {
      to: l2Network.teleporter.l1Teleporter,
      data,
      value: ethAmount as bigint,
      from,
    },
    gasTokenAmount: feeTokenAmount as bigint,
  }
}

/**
 * Build a transaction request to approve ERC-20 tokens for teleportation.
 * The tokens will be approved for the L1Teleporter contract.
 */
export function getErc20L1L3ApproveTokenRequest(
  params: GetErc20L1L3ApproveTokenRequestParams
): TransactionRequestData {
  const { l2Network, erc20L1Address, from } = params
  const amount = params.amount ?? MAX_UINT256

  assertHasTeleporter(l2Network)

  const erc20 = new ArbitrumContract(ERC20Abi, erc20L1Address)
  const data = erc20.encodeFunctionData('approve', [
    l2Network.teleporter.l1Teleporter,
    amount,
  ])

  return {
    to: erc20L1Address,
    data,
    value: 0n,
    from,
  }
}

/**
 * Build a transaction request to approve the L3's fee token for teleportation.
 * The tokens will be approved for the L1Teleporter contract.
 *
 * This is only needed for custom fee token L3s where the fee token
 * also needs to be bridged from L1.
 */
export function getErc20L1L3ApproveGasTokenRequest(
  params: GetErc20L1L3ApproveGasTokenRequestParams
): TransactionRequestData {
  const { l2Network, gasTokenL1Address, from } = params
  const amount = params.amount ?? MAX_UINT256

  assertHasTeleporter(l2Network)

  const erc20 = new ArbitrumContract(ERC20Abi, gasTokenL1Address)
  const data = erc20.encodeFunctionData('approve', [
    l2Network.teleporter.l1Teleporter,
    amount,
  ])

  return {
    to: gasTokenL1Address,
    data,
    value: 0n,
    from,
  }
}
