import { expect } from 'chai'
import { providers } from 'ethers'
import { JsonRpcProvider } from 'ethers-v6'
import { createPublicClient, http } from 'viem'
import Web3 from 'web3'
import { config } from '../../scripts/testSetup'
import { EthBridger, addDefaultLocalNetwork } from '../../src'
import 'dotenv/config'

addDefaultLocalNetwork()
const defaultUrl = config.arbUrl

describe('provider', () => {
  it('should convert viem public client to ethers-v5 provider', async () => {
    const publicClient = createPublicClient({ transport: http(defaultUrl) })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(viemEthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert generic web3 provider to ethers-v5 provider', async () => {
    const l2Provider = new Web3(defaultUrl)
    //@ts-expect-error - TODO: update Providerish type
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 HttpProvider to ethers-v5 provider', async () => {
    const l2Provider = new Web3.providers.HttpProvider(defaultUrl)
    //@ts-expect-error - TODO: update Providerish type
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(defaultUrl)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 WebSocket to ethers-v5 provider', async () => {
    const url = 'ws://localhost:8548'

    const l2Provider = new Web3.providers.WebsocketProvider(url)
    //@ts-expect-error - TODO: update Providerish type
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
