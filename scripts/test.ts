import { BigNumber, ethers } from 'ethers'
import { ArbitrumProvider } from '../src'

function percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
  return num.add(num.mul(increase).div(100))
}

async function test() {
  const l2Provider = new ethers.providers.JsonRpcProvider(
    // 'https://arb1.arbitrum.io/rpc'
    'https://xai-chain.net/rpc'
  )

  const arbProvider = new ArbitrumProvider(l2Provider)
  const currentArbBlock = await arbProvider.getBlockNumber()

  const l1Block = (await arbProvider.getBlock(currentArbBlock)).l1BlockNumber

  console.log({ l1Block })

  return

  // const iGatewayRouter = L1GatewayRouter__factory.createInterface()

  // const encodedData = iGatewayRouter.encodeFunctionData('outboundTransfer', [
  //   '0x61A5A09FD00e028F8422033Bee26D6AE2a5dfB65',
  //   '0x61A5A09FD00e028F8422033Bee26D6AE2a5dfB65',
  //   BigNumber.from(1),
  //   BigNumber.from(0),
  //   BigNumber.from(0),
  //   '0x61A5A09FD00e028F8422033Bee26D6AE2a5dfB65',
  // ])

  // const decodedData = iGatewayRouter.decodeFunctionData(
  //   'outboundTransferCustomRefund',
  //   encodedData
  // )

  // console.log({ decodedData })

  // const gEstimator = new L1ToL2MessageGasEstimator(l2Provider)

  // const maxFeePerGasBase = await gEstimator.estimateMaxFeePerGas()

  // const maxFeePerGas500 = maxFeePerGasBase.mul(6)
}

test()

// maxFeePerGasBase:  60000000
// maxFeePerGas500:  360000000

// maxFeePerGasBase:  1520000000
// maxFeePerGas500:  9120000000
