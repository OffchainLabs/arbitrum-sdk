import { Account, Address, encodeFunctionData, WalletClient } from 'viem'
import { inboxAbi } from './abis/inbox'
import { localEthChain } from '../chains'
import { ArbitrumNetwork } from '../../lib/dataEntities/networks'

export type DepositEthParams = {
  amount: bigint
  account: Account | Address
  gasPrice: bigint
  to: ArbitrumNetwork
}
export async function depositEth(
  walletClient: WalletClient,
  { amount, account, gasPrice, to }: DepositEthParams
) {
  const signedTx = await walletClient.signTransaction({
    to: to.ethBridge.inbox as Address,
    value: amount,
    data: encodeFunctionData({
      abi: inboxAbi,
      functionName: 'depositEth',
    }),
    from: typeof account === 'string' ? account : account.address,
    account,
    chain: localEthChain,
    gas: BigInt('130000'),
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas: gasPrice,
  })

  return signedTx
}
