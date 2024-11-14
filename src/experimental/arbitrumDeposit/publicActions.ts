import { PublicClient } from 'viem'
import { sendDepositEth, SendDepositEthParams } from './sendDepositEth'

export type ArbitrumPublicActions = {
  sendDepositEth: (args: SendDepositEthParams) => Promise<`0x${string}`>
}

export function arbitrumPublicActions() {
  return <TClient extends PublicClient>(
    publicClient: TClient
  ): ArbitrumPublicActions => {
    return {
      sendDepositEth: args => sendDepositEth(publicClient, args),
    }
  }
}
