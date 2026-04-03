/**
 * Viem harness -- implements TestHarness using viem.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { wrapPublicClient, fromViemReceipt } from '../../src/adapter'
import type { TestHarness } from '../../../core/tests/integration/harness'
import type {
  ArbitrumProvider,
  ArbitrumTransactionReceipt,
  TransactionRequestData,
} from '@arbitrum/core'

/** Ensure private key has 0x prefix */
function ensureHexKey(key: string): `0x${string}` {
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`
}

/**
 * Create a minimal viem Chain definition for a given chain ID and RPC URL.
 */
function localChain(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: 'local',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  } as Chain
}

/** Cache chainId per RPC URL to avoid repeated calls */
const chainIdCache = new Map<string, number>()

async function getChainIdForUrl(rpcUrl: string): Promise<number> {
  const cached = chainIdCache.get(rpcUrl)
  if (cached !== undefined) return cached
  const client = createPublicClient({ transport: http(rpcUrl) })
  const chainId = await client.getChainId()
  chainIdCache.set(rpcUrl, chainId)
  return chainId
}

export const viemHarness: TestHarness = {
  createProvider(rpcUrl: string): ArbitrumProvider {
    const client = createPublicClient({
      transport: http(rpcUrl),
    })
    return wrapPublicClient(client as any)
  },

  async sendTransaction(
    privateKey: string,
    rpcUrl: string,
    tx: TransactionRequestData
  ): Promise<ArbitrumTransactionReceipt> {
    const account = privateKeyToAccount(ensureHexKey(privateKey))
    const chainId = await getChainIdForUrl(rpcUrl)
    const chain = localChain(chainId, rpcUrl)

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: tx.value,
      chain,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    return fromViemReceipt(receipt as any)
  },

  async getBalance(rpcUrl: string, address: string): Promise<bigint> {
    const client = createPublicClient({
      transport: http(rpcUrl),
    })
    return client.getBalance({ address: address as `0x${string}` })
  },

  getAddress(privateKey: string): string {
    const account = privateKeyToAccount(ensureHexKey(privateKey))
    return account.address
  },

  async sendEth(
    privateKey: string,
    rpcUrl: string,
    to: string,
    value: bigint
  ): Promise<ArbitrumTransactionReceipt> {
    const account = privateKeyToAccount(ensureHexKey(privateKey))
    const chainId = await getChainIdForUrl(rpcUrl)
    const chain = localChain(chainId, rpcUrl)

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    const hash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      value,
      chain,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    return fromViemReceipt(receipt as any)
  },

  async deployContract(
    privateKey: string,
    rpcUrl: string,
    bytecode: string
  ): Promise<{ address: string; receipt: ArbitrumTransactionReceipt }> {
    const account = privateKeyToAccount(ensureHexKey(privateKey))
    const chainId = await getChainIdForUrl(rpcUrl)
    const chain = localChain(chainId, rpcUrl)

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    const hash = await walletClient.sendTransaction({
      data: bytecode as `0x${string}`,
      chain,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const coreReceipt = fromViemReceipt(receipt as any)
    if (!coreReceipt.contractAddress) {
      throw new Error('Contract deployment failed: no contract address')
    }
    return { address: coreReceipt.contractAddress, receipt: coreReceipt }
  },
}
