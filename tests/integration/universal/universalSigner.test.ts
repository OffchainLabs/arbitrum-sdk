import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
} from 'viem'
import { config, testSetup } from '../../../scripts/testSetup'
import {
  EthBridger,
  addDefaultLocalNetwork,
  enableExperimentalFeatures,
} from '../../../src'
// fetch-polyfill.js
import fetch, { Headers, Request, Response } from 'node-fetch'
import { fundL1 } from '../testHelpers'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumGoerli, mainnet } from 'viem/chains'
import { Wallet } from 'ethers'
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
const defaultUrl = config.arbUrl

// addDefaultLocalNetwork()
enableExperimentalFeatures()

describe('universal signer', async () => {
  let testState: any
  let chain: any
  before('init', async () => {
    testState = await testSetup()
    chain = defineChain(arbLocal)
  })

  it('should get the same addresses with viem', async () => {
    const pk = testState.l2Signer._signingKey().privateKey as `0x${string}`
    const account = privateKeyToAccount(pk)
    const walletClient = createWalletClient({
      transport: http(defaultUrl),
      account,
      chain,
    })
    const viemAddresses = await walletClient.getAddresses()
    console.log({ viemAddresses })

    const viemAddress = account.address
    console.log({ viemAddress })

    const l2Signer = testState.l2Signer
    const ethersAddress = await l2Signer.getAddress()

    expect(viemAddress).to.equal(ethersAddress)
  })

  // it('should get the same signer with viem', async () => {
  //   const walletClient = createWalletClient({
  //     transport: http(defaultUrl),
  //     chain,
  //   })
  //   const signer1 = await transformUniversalSignerToEthersV5Signer(walletClient)
  //   const signer2 = testState.l2Signer

  //   expect(signer1).to.equal(signer2)
  // })

  it('should convert viem wallet client to ethers-v5 signer', async () => {
    const pk = testState.l2Signer._signingKey().privateKey as `0x${string}`
    const walletClient = createWalletClient({
      account: privateKeyToAccount(pk),
      transport: http(defaultUrl),
      chain,
    })
    const ethersV5Provider = new StaticJsonRpcProvider(
      walletClient.transport.url,
      testState.l2Network.chainID
    )
    const l1Signer = testState.seed.connect(ethersV5Provider)

    await fundL1(l1Signer)

    const publicClient = createPublicClient({
      transport: http(defaultUrl),
      chain,
    })
    const viemEthBridger = await EthBridger.fromProvider(publicClient)
    const viemTxResponse = await viemEthBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer: walletClient as any,
    })
    console.log('viemTxResponse', viemTxResponse)

    const ethersBridger = await EthBridger.fromProvider(ethersV5Provider)
    const ethersDepositTxResponse = await ethersBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer, // should accept a `WalletClient`
    })

    console.log('ethersDepositTxResponse', ethersDepositTxResponse)
    // const ethDepositTxReceipt = await ethDepositTxResponse.wait()
  })
})
