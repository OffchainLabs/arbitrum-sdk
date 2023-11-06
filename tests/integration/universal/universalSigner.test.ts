import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { config, testSetup } from '../../../scripts/testSetup'
import { EthBridger, enableExperimentalFeatures } from '../../../src'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumGoerli, mainnet } from 'viem/chains'
import { walletClientToSigner } from '../../../src/lib/utils/universal/signerTransforms'
import { fundL1 } from '../testHelpers'
import { BigNumber } from 'ethers'
// import { Signerish } from '../../../src/lib/assetBridger/ethBridger'

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

type AnyObj = Record<string, any>

const convertBigIntToString = (obj: AnyObj): AnyObj => {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      convertBigIntToString(obj[key])
    } else if (typeof obj[key] === 'bigint') {
      obj[key] = BigNumber.from(obj[key])
    }
  }
  return obj
}

describe('universal signer', async () => {
  let testState: any
  let arbChain: any
  let ethChain: any
  before('init', async () => {
    testState = await testSetup()
    arbChain = arbLocal
    ethChain = ethLocal
  })

  it('should get the same addresses with viem', async () => {
    const pk = testState.l2Signer._signingKey().privateKey as `0x${string}`
    const account = privateKeyToAccount(pk)
    const walletClient = createWalletClient({
      transport: http(arbRpcUrl),
      account,
      chain: arbChain,
    })
    const viemSigner = walletClientToSigner(walletClient)
    const viemAddress = await viemSigner.getAddress()

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
    const viemTx = await viemEthBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer: ethWalletClient as any,
    })
    console.log('viemTx', viemTx)

    const ethersTx = await ethBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer, // should accept a `WalletClient`
    })
    console.log('ethersTx', ethersTx)

    // compare all values of ethers to viem programmatically
    Object.keys(ethersTx).forEach(key => {
      // Assert that the property exists on viemTx
      expect(viemTx).to.have.property(key)
      //@ts-ignore
      const viemProp = viemTx[key]
      //@ts-ignore
      const ethersProp = ethersTx[key]
      // If the property is an object with a toString method, compare as strings
      if (ethersProp && typeof ethersProp.toString === 'function') {
        expect(viemProp.toString()).to.equal(
          ethersProp.toString(),
          `Property '${key}' does not match.`
        )
      } else {
        // For primitive types, direct comparison
        expect(viemProp as any).to.equal(
          ethersProp,
          `Property '${key}' does not match.`
        )
      }
    })

    // compare all values of ethers to viem manually
    expect(viemTx.accessList?.toString()).to.equal(
      ethersTx.accessList?.toString()
    )
    expect(viemTx.chainId).to.equal(ethersTx.chainId)
    expect(viemTx.confirmations).to.equal(ethersTx.confirmations)
    expect(viemTx.data).to.equal(ethersTx.data)
    expect(viemTx.from).to.equal(ethersTx.from)
    expect(viemTx.gasLimit).to.equal(ethersTx.gasLimit)
    expect(viemTx.gasPrice).to.equal(ethersTx.gasPrice)
    expect(viemTx.hash).to.equal(ethersTx.hash)
    expect(viemTx.maxFeePerGas).to.equal(ethersTx.maxFeePerGas)
    expect(viemTx.maxPriorityFeePerGas).to.equal(ethersTx.maxPriorityFeePerGas)
    expect(viemTx.nonce).to.equal(ethersTx.nonce)
    expect(viemTx.r).to.equal(ethersTx.r)
    expect(viemTx.s).to.equal(ethersTx.s)
    expect(viemTx.v).to.equal(ethersTx.v)
    expect(viemTx.to).to.equal(ethersTx.to)
    expect(viemTx.type).to.equal(ethersTx.type)
    expect(viemTx.value).to.equal(ethersTx.value)
    expect(viemTx.wait).to.equal(ethersTx.wait)
    expect(viemTx.blockNumber).to.equal(ethersTx.blockNumber)

    // const viemreq = convertBigIntToString(viemTx)
    // const ethersreq = convertBigIntToString(ethersTx)

    // expect(viemTx.data).to.equal(ethersTx.data)
    // expect(convertBigIntToString(viemTx)).to.equal(
    //   convertBigIntToString(ethersTx)
    // )
  })
})
