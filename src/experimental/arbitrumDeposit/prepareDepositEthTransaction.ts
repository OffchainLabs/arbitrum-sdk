import { Account, Address, encodeFunctionData, PublicClient } from 'viem'
import { inboxAbi } from './abis/inbox'

export type PrepareDepositEthTransaction = {
  amount: bigint
  account: Account
  inbox: Address
}
export async function prepareDepositEthTransaction(
  publicClient: PublicClient,
  { amount, account, inbox }: PrepareDepositEthTransaction
) {
  return publicClient.prepareTransactionRequest({
    chain: publicClient.chain,
    to: inbox,
    data: encodeFunctionData({
      abi: inboxAbi,
      functionName: 'depositEth',
    }),
    value: amount,
    account,
  })
}
