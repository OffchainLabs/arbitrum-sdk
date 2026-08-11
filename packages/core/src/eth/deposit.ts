/**
 * ETH deposit request functions.
 *
 * Returns TransactionRequestData for depositing ETH (or custom gas token)
 * from the parent chain to the child chain. The SDK never signs or sends.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { IInboxAbi } from '../abi/IInbox'
import { ERC20InboxAbi } from '../abi/ERC20Inbox'
import { ERC20Abi } from '../abi/ERC20'
import type { ArbitrumNetwork } from '../networks'
import { isArbitrumNetworkNativeTokenEther } from '../networks'
import type { TransactionRequestData } from '../interfaces/types'
import { ADDRESS_ZERO } from '../constants'

const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

export interface GetDepositRequestParams {
  /** The Arbitrum network (child chain) to deposit to. */
  network: ArbitrumNetwork
  /** Amount to deposit (wei). */
  amount: bigint
  /** Sender address on the parent chain. */
  from: string
}

export interface GetApproveGasTokenRequestParams {
  /** The Arbitrum network (child chain). */
  network: ArbitrumNetwork
  /** Amount to approve. Defaults to max uint256. */
  amount?: bigint
  /** Sender address on the parent chain. */
  from: string
}

/**
 * Build a transaction request for depositing ETH (or the native gas token)
 * from the parent chain into the child chain.
 *
 * For ETH-native chains: calls `Inbox.depositEth()` with `value = amount`.
 * For custom gas token chains: calls `ERC20Inbox.depositERC20(uint256)` with `value = 0`.
 */
export function getDepositRequest(
  params: GetDepositRequestParams
): TransactionRequestData {
  const { network, amount, from } = params
  const nativeTokenIsEth = isArbitrumNetworkNativeTokenEther(network)

  if (nativeTokenIsEth) {
    // Use IInboxAbi which has the no-args depositEth() (avoids overload ambiguity)
    const inbox = new ArbitrumContract(IInboxAbi, network.ethBridge.inbox)
    const data = inbox.encodeFunctionData('depositEth', [])
    return {
      to: network.ethBridge.inbox,
      data,
      value: amount,
      from,
    }
  }

  // Custom gas token chain — call ERC20Inbox.depositERC20(amount)
  const erc20Inbox = new ArbitrumContract(
    ERC20InboxAbi,
    network.ethBridge.inbox
  )
  const data = erc20Inbox.encodeFunctionData('depositERC20', [amount])
  return {
    to: network.ethBridge.inbox,
    data,
    value: 0n,
    from,
  }
}

/**
 * Build a transaction request to approve the custom gas token to be spent
 * by the inbox on the parent chain.
 *
 * Throws if the chain uses ETH as its native/gas token.
 */
export function getApproveGasTokenRequest(
  params: GetApproveGasTokenRequestParams
): TransactionRequestData {
  const { network, from } = params
  const amount = params.amount ?? MAX_UINT256

  if (isArbitrumNetworkNativeTokenEther(network)) {
    throw new Error('chain uses ETH as its native/gas token')
  }

  const nativeToken = network.nativeToken ?? ADDRESS_ZERO
  const erc20 = new ArbitrumContract(ERC20Abi, nativeToken)
  const data = erc20.encodeFunctionData('approve', [
    network.ethBridge.inbox,
    amount,
  ])

  return {
    to: nativeToken,
    data,
    value: 0n,
    from,
  }
}
