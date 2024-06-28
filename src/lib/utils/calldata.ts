import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { ParentToChildTxReqAndSigner } from '../assetBridger/ethBridger'

export const getErc20ParentAddressFromParentToChildTxRequest = (
  txReq: ParentToChildTxReqAndSigner
): string => {
  const {
    txRequest: { data },
  } = txReq

  const iGatewayRouter = L1GatewayRouter__factory.createInterface()

  try {
    const decodedData = iGatewayRouter.decodeFunctionData(
      'outboundTransfer',
      data
    )

    return decodedData['_token']
  } catch {
    try {
      const decodedData = iGatewayRouter.decodeFunctionData(
        'outboundTransferCustomRefund',
        data
      )

      return decodedData['_token']
    } catch {
      throw new Error('data signature not matching deposits methods')
    }
  }
}
