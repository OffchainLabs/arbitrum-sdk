import { 
  type PublicClient, 
  type WalletClient, 
  type Client,
  encodeFunctionData, 
  Account, 
  Address, 
  parseTransaction, 
  serializeTransaction 
} from 'viem'
import { localEthChain } from '../chains'
import { inboxAbi } from './abis/inbox'

export type ArbitrumDepositActions = {
  depositEth: (args: { 
    amount: bigint; 
    account: Account | Address;
    walletClient: WalletClient;
  }) => Promise<`0x${string}`>
}

type ArbitrumChainConfig = {
  ethBridge: {
    inbox: `0x${string}`
  }
}

export function arbitrumDepositActions(childChain: ArbitrumChainConfig) {
  return <TClient extends PublicClient>(parentPublicClient: TClient): ArbitrumDepositActions => {
    const getDepositRequest = async ({ 
      amount, 
      account
    }: {
      amount: bigint
      account: Account | Address
    }) => {
      const from = typeof account === 'string' ? account : account.address

      return {
        to: childChain.ethBridge.inbox,
        value: amount,
        data: encodeFunctionData({
          abi: inboxAbi,
          functionName: 'depositEth',
          args: []
        }),
        from
      }
    }

    return {
      async depositEth({ amount, account, walletClient }) {
        const request = await getDepositRequest({ 
          amount, 
          account
        })

        const gasPrice = await parentPublicClient.getGasPrice()
        
        const nonce = await parentPublicClient.getTransactionCount({
          address: typeof account === 'string' ? account as `0x${string}` : account.address,
          blockTag: 'latest'
        })
        
        const signedTx = await walletClient.signTransaction({
          ...request,
          account,
          chain: localEthChain,
          gas: BigInt('130000'),
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
          nonce
        })

        // Parse and serialize with L2 chain ID
        const parsedTx = parseTransaction((signedTx as any).raw)
        const serializedTx = serializeTransaction({
          ...parsedTx,
        })

        // Send to L2
        const hash = await parentPublicClient.sendRawTransaction({
          serializedTransaction: serializedTx
        })

        return hash
      }
    }
  }
} 