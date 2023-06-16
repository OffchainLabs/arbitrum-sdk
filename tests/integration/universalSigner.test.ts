import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import { providers } from 'ethers'
import { createPublicClient, createWalletClient, http } from 'viem'
import { config } from '../../scripts/testSetup'
import { EthBridger, addDefaultLocalNetwork } from '../../src'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
// fetch-polyfill.js
import fetch, { Headers, Request, Response } from 'node-fetch'

if (!globalThis.fetch) {
  //@ts-expect-error -test
  globalThis.fetch = fetch
  //@ts-expect-error -test
  globalThis.Headers = Headers
  //@ts-expect-error -test
  globalThis.Request = Request
  //@ts-expect-error -test
  globalThis.Response = Response
}

// addDefaultLocalNetwork()

describe('provider', () => {
  it('should convert viem wallet client to ethers-v5 provider', async () => {
    const walletClient = createWalletClient({
      transport: http(config.ethUrl),
    }) as any

    const ethersV5Provider = new JsonRpcProvider(walletClient.transport.url)
    walletClient.provider = ethersV5Provider
    walletClient.getAddress = async () => {
      const addresses = await walletClient.getAddresses()
      return addresses[0]
    }
    walletClient.sendTransaction = async (params: any) => {
      walletClient.sendTransaction({
        ...params,
        account: await walletClient.getAddress(),
      })
    }
    const addrs = await walletClient.getAddress()
    const l1Signer = ethersV5Provider.getSigner()
    const addrt = await l1Signer.getAddress()
    expect(addrs).to.equal(addrt)
    const publicClient = createPublicClient({ transport: http(config.arbUrl) })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)
    // debugger
    const ethDepositTxResponse = await viemEthBridger.deposit({
      amount: parseEther('0.0001'),
      l1Signer: walletClient,
      // l1Signer,
    })

    const ethDepositTxReceipt = await ethDepositTxResponse.wait()
    console.log('ethDepositTxReceipt', ethDepositTxReceipt)
  })
})
