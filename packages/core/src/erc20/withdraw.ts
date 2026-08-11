/**
 * ERC-20 withdrawal request functions.
 *
 * Returns TransactionRequestData for withdrawing ERC-20 tokens from the child
 * chain back to the parent chain.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { L2GatewayRouterAbi } from '../abi/L2GatewayRouter'
import type { ArbitrumNetwork } from '../networks'
import { assertArbitrumNetworkHasTokenBridge } from '../networks'
import type { TransactionRequestData } from '../interfaces/types'

export interface GetErc20WithdrawalRequestParams {
  /** The Arbitrum network (child chain). */
  network: ArbitrumNetwork
  /** Parent chain address of the ERC-20 token. */
  erc20ParentAddress: string
  /** Amount of tokens to withdraw. */
  amount: bigint
  /** Destination address on the parent chain. */
  destinationAddress: string
  /** Sender address on the child chain. */
  from: string
}

/**
 * Build a transaction request for withdrawing ERC-20 tokens from the child chain
 * to the parent chain.
 *
 * Calls `L2GatewayRouter.outboundTransfer(address,address,uint256,bytes)` on the child chain.
 * The 4-param overload is used (token, to, amount, data).
 */
export function getErc20WithdrawalRequest(
  params: GetErc20WithdrawalRequestParams
): TransactionRequestData {
  const { network, erc20ParentAddress, amount, destinationAddress, from } =
    params

  assertArbitrumNetworkHasTokenBridge(network)

  // The L2GatewayRouter ABI has two outboundTransfer overloads.
  // The first one in the ABI is the 4-param version we need:
  // outboundTransfer(address _l1Token, address _to, uint256 _amount, bytes _data)
  const router = new ArbitrumContract(
    L2GatewayRouterAbi,
    network.tokenBridge.childGatewayRouter
  )

  const data = router.encodeFunctionData('outboundTransfer', [
    erc20ParentAddress,
    destinationAddress,
    amount,
    '0x',
  ])

  return {
    to: network.tokenBridge.childGatewayRouter,
    data,
    value: 0n,
    from,
  }
}
