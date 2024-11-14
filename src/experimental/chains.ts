import { type Chain } from 'viem'

export const localEthChain = {
  id: 1337,
  name: 'EthLocal',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
    public: { http: ['http://localhost:8545'] },
  }
} as const satisfies Chain

export const localArbChain = {
  id: 412346,
  name: 'ArbLocal',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://localhost:8547'] },
    public: { http: ['http://localhost:8547'] },
  }
} as const satisfies Chain

function getChainConfig(chainId: number) {
  const chains = {
    [localEthChain.id]: localEthChain,
    [localArbChain.id]: localArbChain
  }
  return chains[chainId as keyof typeof chains]
}

export { getChainConfig } 