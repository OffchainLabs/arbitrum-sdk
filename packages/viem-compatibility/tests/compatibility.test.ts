import { expect } from 'chai'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import {
  createPublicClient,
  defineChain,
  http,
  PublicClient,
  TransactionReceipt,
} from 'viem'
import { mainnet } from 'viem/chains'
import { BigNumber } from 'ethers'
import {
  publicClientToProvider,
  transformPublicClientToProvider,
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
      }) as unknown as PublicClient

      const provider = publicClientToProvider(publicClient)
      expect(provider).to.be.instanceOf(StaticJsonRpcProvider)
      expect(provider.network.chainId).to.equal(testChain.id)
      expect(provider.network.name).to.equal(testChain.name)
      expect(provider.connection.url).to.equal('https://example.com')
    })

    it('throws error when chain is undefined', () => {
      const publicClient = {
        chain: undefined,
      } as unknown as PublicClient

      expect(() => publicClientToProvider(publicClient)).to.throw(
        '[publicClientToProvider] "chain" is undefined'
      )
    })
  })

  describe('transformPublicClientToProvider', () => {
    it('transforms valid public client to provider', () => {
      const transport = http('https://example.com')
      const publicClient = createPublicClient({
        chain: testChain,
        transport,
      }) as unknown as PublicClient

      const provider = transformPublicClientToProvider(publicClient)
      expect(provider).to.be.instanceOf(StaticJsonRpcProvider)
    })

    it('throws error for invalid provider', () => {
      const invalidClient = {} as PublicClient

      expect(() => transformPublicClientToProvider(invalidClient)).to.throw(
        'Invalid provider'
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
            topics: ['0xtopic1'],
            data: '0xdata',
            blockNumber: BigInt(123),
            transactionHash: '0xtx',
            transactionIndex: 1,
            blockHash: '0xblock',
            logIndex: 0,
            removed: false,
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
