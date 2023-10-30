import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { config, testSetup } from '../../../scripts/testSetup'
import { EthBridger, enableExperimentalFeatures } from '../../../src'
// fetch-polyfill.js
import fetch, { Headers, Request, Response } from 'node-fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumGoerli, mainnet } from 'viem/chains'
import { fundL1, fundL2 } from '../testHelpers'
import { transformUniversalSignerToEthersV5Signer } from '../../../src/lib/utils/universal/signerTransforms'
// import { Signerish } from '../../../src/lib/assetBridger/ethBridger'

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
const arbRpcUrl = config.arbUrl

export const ethLocal = {
  ...mainnet,
  id: 1337,
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
}
const ethRpcUrl = config.ethUrl

// addDefaultLocalNetwork()
enableExperimentalFeatures()

describe('universal signer', async () => {
  let testState: any
  let arbChain: any
  let ethChain: any
  before('init', async () => {
    testState = await testSetup()
    arbChain = defineChain(arbLocal)
    ethChain = defineChain(ethLocal)
  })

  it('should get the same addresses with viem', async () => {
    const pk = testState.l2Signer._signingKey().privateKey as `0x${string}`
    const account = privateKeyToAccount(pk)
    const walletClient = createWalletClient({
      transport: http(arbRpcUrl),
      account,
      chain: arbChain,
    })

    const viemAddresses = await walletClient.getAddresses()
    console.log({ viemAddresses })
    // TODO: not actually using the WC addresses
    const viemAddress = account.address
    console.log({ viemAddress })

    const l2Signer = testState.l2Signer
    const ethersAddress = await l2Signer.getAddress()

    expect(viemAddress).to.equal(ethersAddress)
  })

  // it('should get the same signer with viem', async () => {
  //   const walletClient = createWalletClient({
  //     transport: http(arbRpcUrl),
  //     chain,
  //   })
  //   const signer1 = await transformUniversalSignerToEthersV5Signer(walletClient)
  //   const signer2 = testState.l2Signer

  //   expect(signer1).to.equal(signer2)
  // })

  it('should convert viem wallet client to ethers-v5 signer', async () => {
    const { ethBridger, l1Signer } = testState
    const pk = l1Signer._signingKey().privateKey as `0x${string}`

    await fundL1(l1Signer)

    const ethWalletClient = createWalletClient({
      account: privateKeyToAccount(pk),
      transport: http(ethRpcUrl),
      chain: ethChain,
    })

    const arbPublicClient = createPublicClient({
      transport: http(arbRpcUrl),
      chain: arbChain,
    })

    const viemEthBridger = await EthBridger.fromProvider(arbPublicClient)
    const viemTxResponse = await viemEthBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer: ethWalletClient as any,
    })
    console.log('viemTxResponse', viemTxResponse)

    const ethersTxResponse = await ethBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer, // should accept a `WalletClient`
    })
    console.log('ethersTxResponse', ethersTxResponse)

    expect(viemTxResponse.value.toString()).to.equal(
      ethersTxResponse.value.toString()
    )
    expect(viemTxResponse.gasLimit.toString()).to.equal(
      ethersTxResponse.gasLimit.toString()
    )
    expect(viemTxResponse.data).to.equal(ethersTxResponse.data)
  })
})
