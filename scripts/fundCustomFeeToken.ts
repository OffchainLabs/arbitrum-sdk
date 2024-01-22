import { fundL1CustomFeeToken } from '../tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import { getLocalNetworksFromFile } from './testSetup'

async function main() {
  const localNetworks = getLocalNetworksFromFile()
  if (!localNetworks) {
    console.error('No local networks found')
    //TODO: get token address from deployment somehow
  }
  const nativeTokenAddress = localNetworks?.l2Network.nativeToken
  if (!nativeTokenAddress || nativeTokenAddress === undefined) {
    console.error('No native token found')
    return
  }

  await fundL1CustomFeeToken(nativeTokenAddress)
}

main()
