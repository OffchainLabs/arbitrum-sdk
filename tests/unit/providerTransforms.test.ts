import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import { JsonRpcProvider as JsonRpcProviderv6 } from 'ethers-v6'
import { createPublicClient, http } from 'viem'
import Web3 from 'web3'
import {
  getEthersV5Url,
  getEthersV6Url,
  getWeb3Url,
  isEthers6Provider,
  isEthersV5JsonRpcProvider,
  isHttpProvider,
  isPublicClient,
} from '../../src/lib/utils/universal/providerTransforms'

describe('Provider Utilities', () => {
  describe('ethers v5', () => {
    it('should return the URL for an actual EthersV5 provider', () => {
      const provider = new JsonRpcProvider('http://localhost:8545')
      const url = getEthersV5Url(provider)
      expect(url).to.be.equal('http://localhost:8545')
    })

    it('should correctly identify an actual EthersV5 JsonRpcProvider', () => {
      const provider = new JsonRpcProvider('http://localhost:8545')
      expect(isEthersV5JsonRpcProvider(provider)).to.be.true
    })

    it('should return false for an EthersV6 provider', () => {
      const provider = new JsonRpcProviderv6('http://localhost:8546')
      expect(isEthersV5JsonRpcProvider(provider)).to.be.false
    })

    it('should return false for a Web3 provider', () => {
      const provider = new Web3.providers.HttpProvider('http://localhost:8545')
      expect(isEthersV5JsonRpcProvider(provider)).to.be.false
    })

    it('should return false for a Viem PublicClient', () => {
      const provider = createPublicClient({
        transport: http('http://localhost:8545'),
      })
      expect(isEthersV5JsonRpcProvider(provider)).to.be.false
    })
  })

  describe('ethers v6', () => {
    it('should return the URL for an actual EthersV6 provider', async () => {
      const provider = new JsonRpcProviderv6('http://localhost:8546')
      const url = await getEthersV6Url(provider)
      expect(url).to.be.equal('http://localhost:8546')
    })

    it('should correctly identify an actual EthersV6 JsonRpcProvider', async () => {
      const provider = new JsonRpcProviderv6('http://localhost:8546')
      expect(await isEthers6Provider(provider)).to.be.true
    })

    it('should return false for an EthersV5 provider', () => {
      const provider = new JsonRpcProvider('http://localhost:8545')
      expect(isEthers6Provider(provider)).to.be.false
    })

    it('should return false for a Web3 provider', () => {
      const provider = new Web3.providers.HttpProvider('http://localhost:8545')
      expect(isEthers6Provider(provider)).to.be.false
    })

    it('should return false for a Viem PublicClient', async () => {
      const provider = createPublicClient({
        transport: http('http://localhost:8545'),
      })
      expect(await isEthers6Provider(provider)).to.be.false
    })
  })

  describe('web3', () => {
    it('should return the URL for an actual Web3 provider', () => {
      const provider = new Web3.providers.HttpProvider('http://localhost:8545')
      const web3Instance = new Web3(provider)
      const url = getWeb3Url(web3Instance)
      expect(url).to.be.equal('http://localhost:8545')
    })

    it('should correctly identify an actual Web3 HTTP provider', () => {
      const provider = new Web3.providers.HttpProvider('http://localhost:8545')
      expect(isHttpProvider(provider)).to.be.true
    })

    it('should return false for an EthersV5 provider', () => {
      const provider = new JsonRpcProvider('http://localhost:8545')
      expect(isHttpProvider(provider)).to.be.false
    })

    it('should return false for an EthersV6 provider', async () => {
      const provider = new JsonRpcProviderv6('http://localhost:8546')
      expect(isHttpProvider(provider)).to.be.false
    })

    it('should return false for a Viem PublicClient', () => {
      const provider = createPublicClient({
        transport: http('http://localhost:8545'),
      })
      expect(isHttpProvider(provider)).to.be.false
    })
  })

  describe('viem', () => {
    it('should return the URL for an actual Viem provider', () => {
      const provider = createPublicClient({
        transport: http('http://localhost:8545'),
      })
      expect(provider.transport.url).to.be.equal('http://localhost:8545')
    })

    it('should correctly identify an actual PublicClient', () => {
      const provider = createPublicClient({
        transport: http('http://localhost:8545'),
      })
      expect(isPublicClient(provider)).to.be.true
    })

    it('should return false for an EthersV5 provider in isPublicClient', () => {
      const provider = new JsonRpcProvider('http://localhost:8545')
      expect(isPublicClient(provider)).to.be.false
    })

    it('should return false for an EthersV6 provider in isPublicClient', async () => {
      const provider = new JsonRpcProviderv6('http://localhost:8546')
      expect(isPublicClient(provider)).to.be.false
    })

    it('should return false for a Web3 HTTP provider in isPublicClient', () => {
      const provider = new Web3.providers.HttpProvider('http://localhost:8545')
      const web3Instance = new Web3(provider)
      expect(isPublicClient(web3Instance)).to.be.false
    })
  })
})
