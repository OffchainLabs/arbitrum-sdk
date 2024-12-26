import { expect } from 'chai'
import { BigNumber, providers } from 'ethers'
import { createPublicClient, defineChain, http, TransactionReceipt } from 'viem'
import { arbitrumSepolia, mainnet } from 'viem/chains'

import {
  publicClientToProvider,
  viemTransactionReceiptToEthersTransactionReceipt,
} from '../src/compatibility'

const testChain = defineChain({
  ...mainnet,
  rpcUrls: {
    default: {
      http: ['https://example.com'],
    },
    public: {
      http: ['https://example.com'],
    },
  },
})

describe('viem compatibility', () => {
  describe('publicClientToProvider', () => {
    it('converts a public client to a provider', () => {
      const transport = http('https://example.com')
      const publicClient = createPublicClient({
        chain: testChain,
        transport,
      })

      const provider = publicClientToProvider(publicClient)
      expect(provider).to.be.instanceOf(providers.StaticJsonRpcProvider)
      expect(provider.network.chainId).to.equal(testChain.id)
      expect(provider.network.name).to.equal(testChain.name)
      expect(provider.connection.url).to.equal('https://example.com')
    })

    it('successfully converts PublicClient to Provider', () => {
      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(),
      })

      const provider = publicClientToProvider(publicClient)

      expect(provider.network.chainId).to.equal(publicClient.chain!.id)
      expect(provider.network.name).to.equal(publicClient.chain!.name)
      expect(provider.connection.url).to.equal(
        'https://sepolia-rollup.arbitrum.io/rpc'
      )
    })

    it('successfully converts PublicClient to Provider (custom Transport)', () => {
      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http('https://arbitrum-sepolia.gateway.tenderly.co'),
      })

      const provider = publicClientToProvider(publicClient)

      expect(provider.network.chainId).to.equal(publicClient.chain!.id)
      expect(provider.network.name).to.equal(publicClient.chain!.name)
      expect(provider.connection.url).to.equal(
        'https://arbitrum-sepolia.gateway.tenderly.co'
      )
    })

    it('throws error when chain is undefined', () => {
      const transport = http('https://example.com')
      const publicClient = createPublicClient({
        chain: undefined,
        transport,
      })

      expect(() => publicClientToProvider(publicClient)).to.throw(
        '[publicClientToProvider] "chain" is undefined'
      )
    })
  })

  describe('viemTransactionReceiptToEthersTransactionReceipt', () => {
    it('converts viem transaction receipt to ethers format', () => {
      const viemReceipt: TransactionReceipt = {
        to: '0x1234',
        from: '0x5678',
        contractAddress: '0xabcd',
        transactionIndex: 1,
        gasUsed: BigInt(21000),
        logsBloom: '0x',
        blockHash: '0xblock',
        transactionHash: '0xtx',
        logs: [
          {
            address: '0xcontract',
            blockHash: '0xblock',
            blockNumber: BigInt(123),
            data: '0xdata',
            logIndex: 0,
            removed: false,
            transactionHash: '0xtx',
            transactionIndex: 1,
            topics: [],
          },
        ],
        blockNumber: BigInt(123),
        cumulativeGasUsed: BigInt(42000),
        effectiveGasPrice: BigInt(2000000000),
        status: 'success',
        type: 'eip1559',
      }

      const ethersReceipt =
        viemTransactionReceiptToEthersTransactionReceipt(viemReceipt)

      expect(ethersReceipt.to).to.equal('0x1234')
      expect(ethersReceipt.from).to.equal('0x5678')
      expect(ethersReceipt.contractAddress).to.equal('0xabcd')
      expect(ethersReceipt.transactionIndex).to.equal(1)
      expect(ethersReceipt.gasUsed.eq(BigNumber.from(21000))).to.equal(true)
      expect(ethersReceipt.blockNumber).to.equal(123)
      expect(ethersReceipt.status).to.equal(1)
      expect(ethersReceipt.logs[0].address).to.equal('0xcontract')
      expect(ethersReceipt.byzantium).to.equal(true)
    })

    it('handles failed transaction status', () => {
      const viemReceipt: TransactionReceipt = {
        to: '0x1234',
        from: '0x5678',
        contractAddress: '0xabcd',
        transactionIndex: 1,
        gasUsed: BigInt(21000),
        logsBloom: '0x',
        blockHash: '0xblock',
        transactionHash: '0xtx',
        logs: [],
        blockNumber: BigInt(123),
        cumulativeGasUsed: BigInt(42000),
        effectiveGasPrice: BigInt(2000000000),
        status: 'reverted',
        type: 'eip1559' as const,
      }

      const ethersReceipt =
        viemTransactionReceiptToEthersTransactionReceipt(viemReceipt)
      expect(ethersReceipt.status).to.equal(0)
    })
  })
})
