import { expect } from 'chai'
import { getErc20ParentAddressFromParentToChildTxRequest } from '../../src/lib/utils/calldata'
import { ParentToChildTxReqAndSigner } from '../../src/lib/assetBridger/ethBridger'

describe('Calldata', () => {
  describe('getErc20ParentAddressFromParentToChildTxRequest', () => {
    it('decodes calldata to get token address from `outboundTransfer` method call on gateway router', async () => {
      const calldata =
        '0xd2ce7d65000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000df7fa906da092cc30f868c5730c944f4d5431e17000000000000000000000000000000000000000000000000dea56a0c808e9b6a0000000000000000000000000000000000000000000000000000000000026257000000000000000000000000000000000000000000000000000000000393870000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000580cedab294000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000'
      const expectedAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      const output = getErc20ParentAddressFromParentToChildTxRequest({
        txRequest: { data: calldata },
      } as ParentToChildTxReqAndSigner)
      expect(output).to.eq(expectedAddress)
    })

    it('decodes calldata to get token address from `outboundTransferCustomRefund` method call on gateway router', async () => {
      const calldata =
        '0x4fb1a07b000000000000000000000000429881672b9ae42b8eba0e26cd9c73711b891ca50000000000000000000000000f571d2625b503bb7c1d2b5655b483a2fa696fef0000000000000000000000007ecc7163469f37b777d7b8f45a667314030ace240000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000011e1a30000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000e35fa931a00000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000'
      const expectedAddress = '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5'
      const output = getErc20ParentAddressFromParentToChildTxRequest({
        txRequest: { data: calldata },
      } as ParentToChildTxReqAndSigner)
      expect(output).to.eq(expectedAddress)
    })

    it('throws when handling bad calldata', async () => {
      try {
        const calldata = '0xInvalidCalldata'
        getErc20ParentAddressFromParentToChildTxRequest({
          txRequest: { data: calldata },
        } as ParentToChildTxReqAndSigner)
      } catch (err: any) {
        expect(err.message).to.eq(
          'data signature not matching deposits methods'
        )
      }
    })

    it('throws when handling an empty string', async () => {
      try {
        getErc20ParentAddressFromParentToChildTxRequest({
          txRequest: { data: '' },
        } as ParentToChildTxReqAndSigner)
      } catch (err: any) {
        expect(err.message).to.eq(
          'data signature not matching deposits methods'
        )
      }
    })

    it('throws when handling `undefined` data ', async () => {
      try {
        getErc20ParentAddressFromParentToChildTxRequest({
          txRequest: { data: undefined },
        } as any as ParentToChildTxReqAndSigner)
      } catch (err: any) {
        expect(err.message).to.eq(
          'data signature not matching deposits methods'
        )
      }
    })
  })
})
