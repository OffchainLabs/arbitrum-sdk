import { createPublicClient, http } from 'viem'
import { mainnet, arbitrumGoerli, localhost } from 'viem/chains'

export const setupViemEthProvider = ({ ethUrl }: { ethUrl: string }) => {
  const provider = createPublicClient({
    chain: localhost,
    transport: http(ethUrl),
  }) as any
  return provider
}
export const ethLocalhost = {
  ...mainnet,
  id: 1337,
  name: 'Ethereum',
  network: 'ethereum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
}
const arbLocalhost = {
  ...arbitrumGoerli,
  id: 412346,
  name: 'Arbitrum Goerli',
  network: 'arbitrum-localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8547'],
    },
    public: {
      http: ['http://127.0.0.1:8547'],
    },
  },
}

export const setupViemArbProvider = ({ arbUrl }: { arbUrl: string }) => {
  const provider = createPublicClient({
    chain: arbLocalhost,
    transport: http(arbUrl),
  }) as any
  return provider
}
