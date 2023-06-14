import { expect } from 'chai'
import { providers } from 'ethers'
import { createPublicClient, http } from 'viem'
import Web3 from 'web3'
import { config } from '../../scripts/testSetup'
import { EthBridger, addDefaultLocalNetwork } from '../../src'
import 'dotenv/config'

addDefaultLocalNetwork()

describe('provider', () => {
  it('should convert viem public client to ethers provider', async () => {
    const url = config.arbUrl

    const publicClient = createPublicClient({ transport: http(url) })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)

    const provider = new providers.StaticJsonRpcProvider(url)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(viemEthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert generic web3 provider to ethers provider', async () => {
    const url = config.arbUrl

    const l2Provider = new Web3(url)
    //@ts-expect-error - TODO: update Providerish type
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(url)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 HttpProvider to ethers provider', async () => {
    const url = config.arbUrl

    const l2Provider = new Web3.providers.HttpProvider(url)
    //@ts-expect-error - TODO: update Providerish type
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)

    const provider = new providers.StaticJsonRpcProvider(url)
    const ethersEthBridger = await EthBridger.fromProvider(provider)

    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })

  it('should convert web3 WebSocket to ethers provider', async () => {
    const url = 'ws://localhost:8548'

    const l2Provider = new Web3.providers.WebsocketProvider(url)
    //@ts-expect-error - TODO: update Providerish type
    const web3EthBridger = await EthBridger.fromProvider(l2Provider)
    const provider = new providers.WebSocketProvider(url)
    const ethersEthBridger = await EthBridger.fromProvider(provider)
    expect(web3EthBridger).to.be.deep.equal(ethersEthBridger)
  })
})
