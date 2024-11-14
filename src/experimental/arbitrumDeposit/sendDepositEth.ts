import { parseTransaction, PublicClient, serializeTransaction } from 'viem'

export type SendDepositEthParams = {
  signedTx: any
}
export async function sendDepositEth(
  publicClient: PublicClient,
  { signedTx }: SendDepositEthParams
) {
  // Parse and serialize with L2 chain ID
  const parsedTx = parseTransaction(signedTx.raw)
  const serializedTx = serializeTransaction({
    ...parsedTx,
  })

  // Send to L2
  const hash = await publicClient.sendRawTransaction({
    serializedTransaction: serializedTx,
  })

  return hash
}
