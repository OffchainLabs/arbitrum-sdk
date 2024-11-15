import { Address, PublicClient, WalletClient } from 'viem'
import { arbitrum, arbitrumNova, arbitrumSepolia } from 'viem/chains'
import { prepareDepositEthTransaction } from './arbitrumDeposit/prepareDepositEthTransaction'

function getInboxFromChainId(
  chainId:
    | typeof arbitrum.id
    | typeof arbitrumNova.id
    | typeof arbitrumSepolia.id
) {
  return {
    [arbitrum.id]: '0x...',
    [arbitrumNova.id]: '0x...',
    [arbitrumSepolia.id]: '0x...',
  }[chainId]
}

export async function createArbitrumClient({
  parentChainPublicClient,
  parentChainWalletClient,
  childChainPublicClient,
  childChainWalletClient,
}: {
  parentChainPublicClient: PublicClient
  parentChainWalletClient: WalletClient
  childChainPublicClient: PublicClient
  childChainWalletClient: WalletClient
}): Promise<{
  depositEth: (amount: bigint) => void
}> {
  return {
    async depositEth(amount: bigint) {
      const tx = await prepareDepositEthTransaction(parentChainPublicClient, {
        amount,
        account: parentChainWalletClient.account!,
        inbox: getInboxFromChainId(
          childChainWalletClient.chain?.id!
        ) as Address,
      })
      const hash = await parentChainPublicClient.sendRawTransaction({
        serializedTransaction: await parentChainWalletClient.signTransaction(
          tx
        ),
      })

      // Await on childChainPublicClient for the transaction
      return hash
    },
  }
}

/**
 * const { depositEth } = createArbitrumClient({
 *   parentChainPublicClient,
 *   parentChainWalletClient,
 *   childChainPublicClient,
 *   childChainWalletClient,
 * })
 *
 * depositEth({ amount: 150000n })
 *
 */
