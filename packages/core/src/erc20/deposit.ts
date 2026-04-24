/**
 * ERC-20 deposit request functions.
 *
 * Returns TransactionRequestData for approving and depositing ERC-20 tokens
 * from the parent chain to the child chain.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { ERC20Abi } from '../abi/ERC20'
import { L1GatewayRouterAbi } from '../abi/L1GatewayRouter'
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumNetwork } from '../networks'
import {
  assertArbitrumNetworkHasTokenBridge,
  isArbitrumNetworkNativeTokenEther,
} from '../networks'
import type { TransactionRequestData } from '../interfaces/types'
import { getParentGatewayAddress } from './gateway'
import { isWethGateway } from './wethDetection'
import {
  estimateAll,
  type GasOverrides,
  type GasEstimateResult,
} from '../message/gasEstimator'
import { encodeFunctionData } from '../encoding/abi'

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

export interface GetApproveTokenRequestParams {
  /** The Arbitrum network. */
  network: ArbitrumNetwork
  /** Parent chain address of the ERC-20 token. */
  erc20ParentAddress: string
  /** Sender address. */
  from: string
  /** Parent chain provider (to resolve the gateway). */
  parentProvider: ArbitrumProvider
  /** Amount to approve. Defaults to max uint256. */
  amount?: bigint
}

export interface GetErc20DepositRequestParams {
  /** The Arbitrum network. */
  network: ArbitrumNetwork
  /** Parent chain address of the ERC-20 token. */
  erc20ParentAddress: string
  /** Amount of tokens to deposit. */
  amount: bigint
  /** Sender/depositor address. */
  from: string
  /** Destination address on the child chain. Defaults to `from`. */
  destinationAddress?: string
  /** Parent chain provider. */
  parentProvider: ArbitrumProvider
  /** Child chain provider. */
  childProvider: ArbitrumProvider
  /** Address for excess fee refunds. Defaults to `from`. */
  excessFeeRefundAddress?: string
  /** Address for call value refunds. Defaults to `from`. */
  callValueRefundAddress?: string
  /** Gas overrides for retryable ticket estimation. */
  retryableGasOverrides?: GasOverrides
}

/**
 * Minimal ABI for encoding `outboundTransfer(address,address,uint256,uint256,uint256,bytes)`.
 * We use the 6-param overload because that's what the L1GatewayRouter expects
 * when called with explicit gas parameters.
 */
const outboundTransfer6ParamAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransfer',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

/**
 * Minimal ABI for `outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)`.
 */
const outboundTransferCustomRefundAbi = [
  {
    type: 'function' as const,
    name: 'outboundTransferCustomRefund',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_refundTo', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_maxGas', type: 'uint256' },
      { name: '_gasPriceBid', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
  },
] as const

/**
 * Build a transaction request to approve an ERC-20 token for deposit.
 *
 * The tokens will be approved for the relevant gateway (resolved via the router).
 */
export async function getApproveTokenRequest(
  params: GetApproveTokenRequestParams
): Promise<TransactionRequestData> {
  const { network, erc20ParentAddress, from, parentProvider } = params
  const amount = params.amount ?? MAX_UINT256

  assertArbitrumNetworkHasTokenBridge(network)

  // Resolve the gateway that the router will use for this token
  const gatewayAddress = await getParentGatewayAddress(
    erc20ParentAddress,
    parentProvider,
    network
  )

  const erc20 = new ArbitrumContract(ERC20Abi, erc20ParentAddress)
  const data = erc20.encodeFunctionData('approve', [gatewayAddress, amount])

  return {
    to: erc20ParentAddress,
    data,
    value: 0n,
    from,
  }
}

/**
 * Encode the inner data parameter for outboundTransfer.
 *
 * For ETH-native chains: `abi.encode(uint256 maxSubmissionCost, bytes callHookData)`
 * For custom gas token chains: `abi.encode(uint256 maxSubmissionCost, bytes callHookData, uint256 nativeTokenTotalFee)`
 */
function encodeOutboundTransferInnerData(
  maxSubmissionCost: bigint,
  nativeTokenIsEth: boolean,
  nativeTokenTotalFee?: bigint
): string {
  if (!nativeTokenIsEth) {
    // For custom gas token: encode (uint256, bytes, uint256)
    return encodeFunctionData(
      [
        {
          type: 'function',
          name: 'f',
          inputs: [
            { name: 'maxSubmissionCost', type: 'uint256' },
            { name: 'callHookData', type: 'bytes' },
            { name: 'nativeTokenTotalFee', type: 'uint256' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ] as const,
      'f',
      [maxSubmissionCost, '0x', nativeTokenTotalFee ?? 0n]
    ).slice(10) // Strip the function selector, keep only the ABI-encoded params
  }

  // For ETH-native: encode (uint256, bytes)
  return encodeFunctionData(
    [
      {
        type: 'function',
        name: 'f',
        inputs: [
          { name: 'maxSubmissionCost', type: 'uint256' },
          { name: 'callHookData', type: 'bytes' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ] as const,
    'f',
    [maxSubmissionCost, '0x']
  ).slice(10) // Strip the function selector
}

/**
 * Build a transaction request to deposit ERC-20 tokens from the parent chain
 * to the child chain via the gateway router.
 *
 * This performs gas estimation for the retryable ticket.
 */
export async function getErc20DepositRequest(
  params: GetErc20DepositRequestParams
): Promise<TransactionRequestData & { gasEstimates: GasEstimateResult }> {
  const {
    network,
    erc20ParentAddress,
    amount,
    from,
    parentProvider,
    childProvider,
    retryableGasOverrides,
  } = params

  assertArbitrumNetworkHasTokenBridge(network)

  const destinationAddress = params.destinationAddress ?? from
  const excessFeeRefundAddress = params.excessFeeRefundAddress ?? from
  const callValueRefundAddress = params.callValueRefundAddress ?? from
  const nativeTokenIsEth = isArbitrumNetworkNativeTokenEther(network)

  // Resolve gateway
  const parentGatewayAddress = await getParentGatewayAddress(
    erc20ParentAddress,
    parentProvider,
    network
  )

  // Check if custom gateway (add minimum gas limit)
  let gasOverrides = retryableGasOverrides
  if (
    parentGatewayAddress.toLowerCase() ===
    network.tokenBridge.parentCustomGateway.toLowerCase()
  ) {
    gasOverrides = {
      ...gasOverrides,
      gasLimit: {
        ...gasOverrides?.gasLimit,
        min: gasOverrides?.gasLimit?.min ?? 275000n,
      },
    }
  }

  // The WETH gateway is the only deposit that requires callvalue in the child
  // user-tx (i.e., the recently un-wrapped ETH). Check if this is a WETH deposit
  // and include the callvalue for the gas estimate query if so.
  const isWeth = await isWethGateway(parentGatewayAddress, parentProvider)
  const l2CallValue = isWeth ? amount : 0n

  // Estimate gas for the retryable
  const estimates = await estimateAll(
    parentProvider,
    childProvider,
    network,
    {
      from,
      to: destinationAddress,
      l2CallValue,
      excessFeeRefundAddress,
      callValueRefundAddress,
      data: '0x',
    },
    gasOverrides
  )

  // Encode the inner data for the outboundTransfer call
  const innerData = '0x' + encodeOutboundTransferInnerData(
    estimates.maxSubmissionCost,
    nativeTokenIsEth,
    nativeTokenIsEth ? undefined : estimates.gasLimit * estimates.maxFeePerGas + estimates.maxSubmissionCost
  )

  // Compute call value
  const callValue = nativeTokenIsEth
    ? estimates.gasLimit * estimates.maxFeePerGas + estimates.maxSubmissionCost
    : 0n

  // Encode the router call
  let routerCallData: string
  if (excessFeeRefundAddress.toLowerCase() !== from.toLowerCase()) {
    routerCallData = encodeFunctionData(
      outboundTransferCustomRefundAbi,
      'outboundTransferCustomRefund',
      [
        erc20ParentAddress,
        excessFeeRefundAddress,
        destinationAddress,
        amount,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        innerData,
      ]
    )
  } else {
    routerCallData = encodeFunctionData(
      outboundTransfer6ParamAbi,
      'outboundTransfer',
      [
        erc20ParentAddress,
        destinationAddress,
        amount,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        innerData,
      ]
    )
  }

  return {
    to: network.tokenBridge.parentGatewayRouter,
    data: routerCallData,
    value: callValue,
    from,
    gasEstimates: estimates,
  }
}
