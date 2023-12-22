import { expect } from 'chai'
import 'dotenv/config'
import { parseEther } from 'ethers/lib/utils'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config, testSetup } from '../../../scripts/testSetup'
import { addDefaultLocalNetwork, createViemSigner } from '../../../src'
import { fundL1 } from '../testHelpers'
import { arbLocal } from './universalProvider.test'

try {
  addDefaultLocalNetwork()
} catch (e) {
  console.log('default local network already added')
}

describe('universal signer', async () => {
  it('should get the same addresses with viem', async () => {
    const { l2Signer, pk } = await testSetup()
    const account = privateKeyToAccount(pk)
    const walletClient = createWalletClient({
      transport: http(config.arbUrl),
      account,
      chain: arbLocal,
    })
    const viemSigner = createViemSigner(walletClient)
    const viemAddress = await viemSigner.getAddress()

    const ethersAddress = await l2Signer.getAddress()

    expect(viemAddress).to.equal(ethersAddress)
  })

  it('should convert viem wallet client to ethers-v5 signer', async () => {
    const { ethBridger, ethersL1Signer, l1Signer } = (await testSetup()) as any

    await fundL1(l1Signer)

    const viemTx = await ethBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer: l1Signer,
    })

    const ethersTx = await ethBridger.deposit({
      amount: parseEther('0.000001'),
      l1Signer: ethersL1Signer as any,
    })

    const excludedProperties: string[] = [
      'gasLimit',
      'gasPrice',
      'hash',
      'maxFeePerGas',
      'maxPriorityFeePerGas',
      'nonce',
      'confirmations',
      'r',
      's',
      'v',
    ]

    // compare viem and ethers-v5 tx output programmatically
    Object.keys(ethersTx).forEach(key => {
      // Assert that the property exists on viemTx
      expect(viemTx).to.have.property(key)

      const viemProp = viemTx[key]
      const ethersProp = ethersTx[key]

      const isKeyExcluded = excludedProperties.find(_key => _key === key)

      // Skip excluded properties
      if (isKeyExcluded) return

      // If the property is an object with a toString method, compare as strings
      if (ethersProp && typeof ethersProp.toString === 'function') {
        expect(viemProp?.toString().toLowerCase()).to.equal(
          ethersProp.toString().toLowerCase(),
          `Property '${key}' does not match. viem value was ${viemProp} and ethers value was ${ethersProp}`
        )
      } else {
        // For primitive types, direct comparison
        expect(viemProp).to.equal(
          ethersProp,
          `Property '${key}' does not match. viem value was ${viemProp} and ethers value was ${ethersProp}`
        )
      }
    })

    // compare viem and ethers-v5 tx output manually
    expect(viemTx.accessList?.toString()).to.equal(
      ethersTx.accessList?.toString()
    )
    expect(viemTx.chainId).to.equal(ethersTx.chainId)
    expect(viemTx.data).to.equal(ethersTx.data)
    expect(viemTx.from).to.equal(ethersTx.from)
    expect(viemTx.to.toLowerCase()).to.equal(ethersTx.to.toLowerCase())
    expect(viemTx.type).to.equal(ethersTx.type)
    expect(viemTx.value.toString()).to.equal(ethersTx.value.toString())
  })
})
