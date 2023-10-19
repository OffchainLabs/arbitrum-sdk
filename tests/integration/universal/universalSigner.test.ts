import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers'
import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import { createPublicClient, createWalletClient, http } from 'viem'
import { config } from '../../../scripts/testSetup'
import { EthBridger } from '../../../src'
// fetch-polyfill.js
import fetch, { Headers, Request, Response } from 'node-fetch'
import { Signer } from 'ethers'

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

describe('universal signer', () => {
  it('should convert viem wallet client to ethers-v5 provider', async () => {
    const walletClient = createWalletClient({
      transport: http(config.ethUrl),
    })
    const ethersV5Provider = new JsonRpcProvider(walletClient.transport.url)

    const l1Signer = ethersV5Provider.getSigner()

    const viemAddresses = await walletClient.getAddresses()
    const ethersAddress = await l1Signer.getAddress()
    expect(viemAddresses[0]).to.equal(ethersAddress)
    const publicClient = createPublicClient({ transport: http(config.arbUrl) })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)
    const ethDepositTxResponse = await viemEthBridger.deposit({
      amount: parseEther('0.0001'),
      // l1Signer: walletClient,
      l1Signer,
    })

    console.log('ethDepositTxResponse', ethDepositTxResponse)
    // const ethDepositTxReceipt = await ethDepositTxResponse.wait()
  })
})
