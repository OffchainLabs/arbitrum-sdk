import { L1TransactionReceipt } from '../src'
import { BigNumber, constants, providers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { assert } from 'chai'

describe.only('L1toL2Message events', () => {
  it('does call for nitro events', async () => {
    // Receipt from mainnet tx: 0x7cb3395fca076033d84be787ef6e8eba90423a97cd244cc2f2f0e66d8df5d54e
    const receipt: providers.TransactionReceipt = {
      to: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      from: '0x61A5A09FD00e028F8422033Bee26D6AE2a5dfB65',
      contractAddress: '',
      transactionIndex: 290,
      gasUsed: constants.Zero,
      logsBloom:
        '0x00000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000020000400000000000000000000100000000000000000000000000000000080000000000008000000000002400000000000000008000080000000000000000000000000000000020000000000000000000000000000000000000200000000000040000000000000000000000100000000000000008000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000004000',
      blockHash:
        '0x5732662f1e9815000f3e0ff7afd8dd1954680ba5fa34379025be4867ab00c721',
      transactionHash:
        '0x7cb3395fca076033d84be787ef6e8eba90423a97cd244cc2f2f0e66d8df5d54e',
      logs: [
        {
          transactionIndex: 290,
          blockNumber: 15439928,
          transactionHash:
            '0x7cb3395fca076033d84be787ef6e8eba90423a97cd244cc2f2f0e66d8df5d54e',
          address: '0x011B6E24FfB0B5f5fCc564cf4183C5BBBc96D515',
          topics: [
            '0x23be8e12e420b5da9fb98d8102572f640fb3c11a0085060472dfc0ed194b3cf7',
            '0x00000000000000000000000000000000000000000000000000000000000b5440',
            '0x76ec43ceddcd3e094e2b6c7d6557779dc8a5e4e47a1010e4e4bc3a2466354c38',
          ],
          data: '0x0000000000000000000000004dbd4fc535ac27206064b68ffcf827b0a60bab3f00000000000000000000000000000000000000000000000000000000000000090000000000000000000000005094a09fd00e028f8422033bee26d6ae2a5dea5495e9b06983c4c8d8e870da858e445738d483a2c2647b3d90cf31c341b74b00bc',
          logIndex: 493,
          blockHash:
            '0x5732662f1e9815000f3e0ff7afd8dd1954680ba5fa34379025be4867ab00c721',
          removed: false,
        },
        {
          transactionIndex: 290,
          blockNumber: 15439928,
          transactionHash:
            '0x7cb3395fca076033d84be787ef6e8eba90423a97cd244cc2f2f0e66d8df5d54e',
          address: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
          topics: [
            '0xff64905f73a67fb594e0f940a8075a860db489ad991e032f48c81123eb52d60b',
            '0x00000000000000000000000000000000000000000000000000000000000b5440',
          ],
          data: '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000012000000000000000000000000061a5a09fd00e028f8422033bee26d6ae2a5dfb65000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000071afd498d00000000000000000000000000000000000000000000000000000000000d5c8533ce00000000000000000000000061a5a09fd00e028f8422033bee26d6ae2a5dfb6500000000000000000000000061a5a09fd00e028f8422033bee26d6ae2a5dfb65000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          logIndex: 494,
          blockHash:
            '0x5732662f1e9815000f3e0ff7afd8dd1954680ba5fa34379025be4867ab00c721',
          removed: false,
        },
      ],
      cumulativeGasUsed: constants.Zero,
      blockNumber: 15439928,
      confirmations: 477872,
      effectiveGasPrice: constants.Zero,
      byzantium: true,
      type: 2,
      status: 1,
    }

    const arbProvider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
    const l1TxnReceipt = new L1TransactionReceipt(receipt)
    const message = await l1TxnReceipt.getL1ToL2Messages(arbProvider)

    assert.deepEqual(message, [
      {
        messageNumber: BigNumber.from(742464),
        l2Provider: arbProvider,
        retryableCreationId:
          '0xebac787fec7d4f1529da19a72fe58f130373eb6a11bb4300aeadbcce3b709293',
        autoRedeemId:
          '0x8b63b138259a173889e60421f246d7428631061b1d050ad27f86084becbeb73b',
        l2TxHash:
          '0x64ca81f0ed73c10bb8d08c46e179b58a929dc0ff071fe112471d86d82466774f',
      },
    ])
  })

  it('does call for classic events', async () => {
    // Receipt from mainnet tx: 0xc80e0c4844bb502ed7d7e2db6f9e6b2d52e3d25688de216394f0227fc5dc814e
    const receipt: providers.TransactionReceipt = {
      to: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
      from: '0xA928c403Af1993eB309451a3559F8946E7d81F7F',
      contractAddress: '',
      transactionIndex: 0,
      gasUsed: constants.Zero,
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
      cumulativeGasUsed: constants.Zero,
      blockNumber: 14602546,
      confirmations: 1279492,
      effectiveGasPrice: constants.Zero,
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
