import { type WalletClient } from 'viem'
import { depositEth, DepositEthParams } from './depositEth'

export type ArbitrumWalletActions = {
  depositEth: (args: DepositEthParams) => Promise<`0x${string}`>
}

export function arbitrumWalletActions() {
  return <TClient extends WalletClient>(
    walletClient: TClient
  ): ArbitrumWalletActions => {
    return {
      depositEth: args => depositEth(walletClient, args),
    }
  }
}
