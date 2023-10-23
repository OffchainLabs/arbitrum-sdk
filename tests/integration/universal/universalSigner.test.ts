import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import { createPublicClient, createWalletClient, http } from 'viem'
import { config } from '../../../scripts/testSetup'
import { EthBridger } from '../../../src'
// fetch-polyfill.js
import fetch, { Headers, Request, Response } from 'node-fetch'
import { Wallet } from 'ethers'
import { fundL1 } from '../testHelpers'
import { privateKeyToAccount } from 'viem/accounts'

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

describe('universal signer', async () => {
  it('should get the same addresses with viem', async () => {
    const walletClient = createWalletClient({
      transport: http(config.ethUrl),
    })
    const ethersV5Provider = new JsonRpcProvider(walletClient.transport.url)
    const l1Signer = ethersV5Provider.getSigner()
    const viemAddresses = await walletClient.getAddresses()
    const ethersAddress = await l1Signer.getAddress()
    expect(viemAddresses[0]).to.equal(ethersAddress)
  })
  it('should convert viem wallet client to ethers-v5 signer', async () => {
    const seed = Wallet.createRandom()
    const pk = seed._signingKey().privateKey as `0x${string}`
    const walletClient = createWalletClient({
      account: privateKeyToAccount(pk),
      transport: http(config.ethUrl),
    })
    const ethersV5Provider = new JsonRpcProvider(walletClient.transport.url)
    const l1Signer = seed.connect(ethersV5Provider)

    await fundL1(l1Signer)

    const publicClient = createPublicClient({ transport: http(config.arbUrl) })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)

    const ethDepositTxResponse = await viemEthBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer, // should accept a `WalletClient`
    })

    console.log('ethDepositTxResponse', ethDepositTxResponse)
    // const ethDepositTxReceipt = await ethDepositTxResponse.wait()
  })
})
