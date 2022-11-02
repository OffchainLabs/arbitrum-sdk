import { testSetup } from '../scripts/testSetup'
import { L1TransactionReceipt } from '../src'
import { fundL1, fundL2 } from './testHelpers'
import { BigNumber, providers } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { JsonRpcProvider } from '@ethersproject/providers'
import { assert } from 'chai'

describe('L1toL2Message events', () => {
  it('does call for nitro events', async () => {
    const testState = {
      ...(await testSetup()),
      l1CustomToken: {} as any,
    }

    await fundL1(testState.l1Signer)
    await fundL2(testState.l2Signer)

    const response = await testState.ethBridger.deposit({
      amount: parseEther('0.000005'),
      l1Signer: testState.l1Signer,
    })
    const txnReceipt = await response.wait()
    const l1TxnReceipt = new L1TransactionReceipt(txnReceipt)
    // TODO: Test the final result for nitro
    const message = await l1TxnReceipt.getL1ToL2Messages(testState.l2Signer)
  })

  it('does call for classic events', async () => {
    // Receipt from mainnet tx: 0xc80e0c4844bb502ed7d7e2db6f9e6b2d52e3d25688de216394f0227fc5dc814e
    const receipt: providers.TransactionReceipt = {
      to: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      from: '0xA928c403Af1993eB309451a3559F8946E7d81F7F',
      contractAddress: '',
      transactionIndex: 0,
      gasUsed: BigNumber.from(0),
      logsBloom:
        '0x00000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000008000000000002000000000000000008000000000000000000000000000000000000020000000000000000000000000000000000010200000000000000000000000000000800000100000000000000008010001000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000001000000000000000200000000000000000000000000000000000000000800000000000004000',
      blockHash:
        '0x8c6512df3bc8d8422c9a345ee2c1e822f1538e0a00f1a02ac1a366ef57c7e561',
      transactionHash:
        '0xc80e0c4844bb502ed7d7e2db6f9e6b2d52e3d25688de216394f0227fc5dc814e',
      logs: [
        {
          transactionIndex: 122,
          blockNumber: 14602546,
          transactionHash:
            '0xc80e0c4844bb502ed7d7e2db6f9e6b2d52e3d25688de216394f0227fc5dc814e',
          address: '0x011B6E24FfB0B5f5fCc564cf4183C5BBBc96D515',
          topics: [
            '0x23be8e12e420b5da9fb98d8102572f640fb3c11a0085060472dfc0ed194b3cf7',
            '0x0000000000000000000000000000000000000000000000000000000000064371',
            '0x94ae25e1b4f5045af1c19d6bbb513dc9caad7f3986531c898d1e621b61d84341',
          ],
          data: '0x0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f00000000000000000000000000000000000000000000000000000000000000090000000000000000000000009817c403af1993eb309451a3559f8946e7d80e6ee205287f448301fa8583e565d955811fd3f296597965592f99e8c282094e32f1',
          logIndex: 242,
          blockHash:
            '0x8c6512df3bc8d8422c9a345ee2c1e822f1538e0a00f1a02ac1a366ef57c7e561',
          removed: false,
        },
        {
          transactionIndex: 122,
          blockNumber: 14602546,
          transactionHash:
            '0xc80e0c4844bb502ed7d7e2db6f9e6b2d52e3d25688de216394f0227fc5dc814e',
          address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
          topics: [
            '0xff64905f73a67fb594e0f940a8075a860db489ad991e032f48c81123eb52d60b',
            '0x0000000000000000000000000000000000000000000000000000000000064371',
          ],
          data: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000120000000000000000000000000a928c403af1993eb309451a3559f8946e7d81f7f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000063eb89da4ed00000000000000000000000000000000000000000000000000000000002c912972d8000000000000000000000000a928c403af1993eb309451a3559f8946e7d81f7f000000000000000000000000a928c403af1993eb309451a3559f8946e7d81f7f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          logIndex: 243,
          blockHash:
            '0x8c6512df3bc8d8422c9a345ee2c1e822f1538e0a00f1a02ac1a366ef57c7e561',
          removed: false,
        },
      ],
      cumulativeGasUsed: BigNumber.from(0),
      blockNumber: 14602546,
      confirmations: 1279492,
      effectiveGasPrice: BigNumber.from(0),
      byzantium: true,
      type: 2,
      status: 1,
    }

    const arbProvider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const l1TxnReceipt = new L1TransactionReceipt(receipt)

    const message = await l1TxnReceipt.getL1ToL2Messages(arbProvider)

    assert.deepEqual(message, [
      {
        messageNumber: BigNumber.from(410481),
        l2Provider: arbProvider,
        retryableCreationId:
          '0xc88b1821af42b8281bbf645173e287e4ec50ef96907f5211dc7069e09af20720',
        autoRedeemId:
          '0x38c5c31151344c7a1433a849bbc80472786ebe911630255a6e25d6a2efd39526',
        l2TxHash:
          '0xf91e7d2e7526927e915a2357360a3f1108dce0f9c7fa88a7492669adf5c1e53b',
      },
    ])
  })
})
