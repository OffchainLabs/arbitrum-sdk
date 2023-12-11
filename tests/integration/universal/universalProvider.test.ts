import { expect } from 'chai'
import 'dotenv/config'
import { providers } from 'ethers'
import { JsonRpcProvider } from 'ethers-v6'
import { createPublicClient, defineChain, http } from 'viem'
import { arbitrumGoerli } from 'viem/chains'
import Web3 from 'web3'
import { config } from '../../../scripts/testSetup'
import { EthBridger, addDefaultLocalNetwork } from '../../../src'

const defaultUrl = config.arbUrl

addDefaultLocalNetwork()

export const arbLocal = {
  ...arbitrumGoerli,
  id: 412346,
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8547'],
    },
    public: {
      http: ['http://127.0.0.1:8547'],
    },
  },
}

describe('universal provider', () => {
  it('should convert viem public client to ethers-v5 provider', async () => {
    const publicClient = createPublicClient({
      transport: http(defaultUrl),
      chain: arbLocal,
    })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(viemEthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert generic web3 provider to ethers-v5 provider', async () => {
    const l2Provider = new Web3(defaultUrl)

    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 HttpProvider to ethers-v5 provider', async () => {
    const l2Provider = new Web3.providers.HttpProvider(defaultUrl)
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 WebSocket to ethers-v5 provider', async () => {
    const url = 'ws://localhost:8548'

    const l2Provider = new Web3.providers.WebsocketProvider(url)
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)
    const provider = new providers.WebSocketProvider(url)
    const ethersEthBridger = await EthBridger.fromProvider(provider)
    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert ethers-v6 Provider to ethers-v5 provider', async () => {
    const l2Provider = new JsonRpcProvider(defaultUrl)
    const EthersV6EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(EthersV6EthBridger).to.be.deep.equal(ethersEthBridger)
  })
})
