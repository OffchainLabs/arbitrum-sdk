import {
  config,
  testSetup as sdkTestSetup,
} from '@arbitrum/sdk/tests/testSetup'
import { Address, Chain, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  ArbitrumClients,
  createArbitrumClient,
} from '../src/createArbitrumClient'

export type ViemTestSetup = {
  localEthChain: Chain
  localArbChain: Chain
  parentAccount: ReturnType<typeof privateKeyToAccount>
  parentPublicClient: ArbitrumClients['parentPublicClient']
  parentWalletClient: ArbitrumClients['parentWalletClient']
  childPublicClient: ArbitrumClients['childPublicClient']
  childWalletClient: ArbitrumClients['childWalletClient']
  childChain: Awaited<ReturnType<typeof sdkTestSetup>>['childChain']
  parentSigner: Awaited<ReturnType<typeof sdkTestSetup>>['parentSigner']
}

function generateViemChain(
  networkData: {
    chainId: number
    name: string
  },
  rpcUrl: string
): Chain {
  return {
    id: networkData.chainId,
    name: networkData.name,
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  } as const
}

export async function testSetup(): Promise<ViemTestSetup> {
  const setup = await sdkTestSetup()

  const parentPrivateKey = setup.seed._signingKey().privateKey as Address
  const parentAccount = privateKeyToAccount(parentPrivateKey)

  // Generate Viem chains using the network data we already have
  const localEthChain = generateViemChain(
    {
      chainId: setup.childChain.parentChainId,
      name: 'EthLocal',
    },
    config.ethUrl
  )

  const localArbChain = generateViemChain(
    {
      chainId: setup.childChain.chainId,
      name: setup.childChain.name,
    },
    config.arbUrl
  )

  const baseParentWalletClient = createWalletClient({
    account: parentAccount,
    chain: localEthChain,
    transport: http(config.ethUrl),
  })

  const baseChildWalletClient = createWalletClient({
    account: parentAccount,
    chain: localArbChain,
    transport: http(config.arbUrl),
  })

  const {
    childPublicClient,
    childWalletClient,
    parentWalletClient,
    parentPublicClient,
  } = createArbitrumClient({
    parentChain: localEthChain,
    childChain: localArbChain,
    parentWalletClient: baseParentWalletClient,
    childWalletClient: baseChildWalletClient,
  })

  return {
    ...setup,
    localEthChain,
    localArbChain,
    parentAccount,
    childPublicClient,
    childWalletClient,
    parentWalletClient,
    parentPublicClient,
  }
}

export { config }
