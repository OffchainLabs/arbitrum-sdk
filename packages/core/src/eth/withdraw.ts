/**
 * ETH withdrawal request functions.
 *
 * Returns TransactionRequestData for withdrawing ETH from the child chain
 * back to the parent chain. The SDK never signs or sends.
 */
import { ArbitrumContract } from '../contracts/Contract'
import { ArbSysAbi } from '../abi/ArbSys'
import { ARB_SYS_ADDRESS } from '../constants'
import type { ArbitrumNetwork } from '../networks'
import type { TransactionRequestData } from '../interfaces/types'

export interface GetWithdrawalRequestParams {
  /** The Arbitrum network (child chain). */
  network: ArbitrumNetwork
  /** Amount of ETH to withdraw (wei). */
  amount: bigint
  /** Destination address on the parent chain. */
  destinationAddress: string
  /** Sender address on the child chain. */
  from: string
}

/**
 * Build a transaction request for withdrawing ETH from the child chain
 * to the parent chain.
 *
 * Calls `ArbSys.withdrawEth(address)` at the ArbSys precompile.
 */
export function getWithdrawalRequest(
  params: GetWithdrawalRequestParams
): TransactionRequestData {
  const { amount, destinationAddress, from } = params

  const arbSys = new ArbitrumContract(ArbSysAbi, ARB_SYS_ADDRESS)
  const data = arbSys.encodeFunctionData('withdrawEth', [destinationAddress])

  return {
    to: ARB_SYS_ADDRESS,
    data,
    value: amount,
    from,
  }
}
