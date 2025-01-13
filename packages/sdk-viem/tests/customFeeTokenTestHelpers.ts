import { ethers } from 'ethers'
import {
  Account,
  formatUnits,
  parseEther,
  parseUnits,
  type Chain,
  type Hex,
  type WalletClient,
} from 'viem'

import {
  getParentCustomFeeTokenAllowance,
  isArbitrumNetworkWithCustomFeeToken,
} from '@arbitrum/sdk/tests/integration/custom-fee-token/customFeeTokenTestHelpers'
import { EthBridger } from '@arbitrum/sdk/src'
import { getNativeTokenDecimals } from '@arbitrum/sdk/src/lib/utils/lib'
import {
  testSetup as _testSetup,
  config,
  getLocalNetworksFromFile,
} from '@arbitrum/sdk/tests/testSetup'
import { StaticJsonRpcProvider } from '@ethersproject/providers'

const ethProvider = () => new StaticJsonRpcProvider(config.ethUrl)
const arbProvider = () => new StaticJsonRpcProvider(config.arbUrl)
const localNetworks = () => getLocalNetworksFromFile()

export async function getAmountInEnvironmentDecimals(
  amount: string
): Promise<[bigint, number]> {
  if (isArbitrumNetworkWithCustomFeeToken()) {
    const tokenDecimals = await getNativeTokenDecimals({
      parentProvider: ethProvider(),
      childNetwork: localNetworks().l3Network!,
    })
    return [parseUnits(amount, tokenDecimals), tokenDecimals]
  }
  return [parseEther(amount), 18] // ETH decimals
}

export function normalizeBalanceDiffByDecimals(
  balanceDiff: bigint,
  tokenDecimals: number
): bigint {
  // Convert to 18 decimals (ETH standard) for comparison
  if (tokenDecimals === 18) return balanceDiff

  // Convert to decimal string with proper precision
  const formattedDiff = formatUnits(balanceDiff, 18)
  // Parse back with target decimals
  return parseUnits(formattedDiff, tokenDecimals)
}

export async function approveCustomFeeTokenWithViem({
  parentAccount,
  parentWalletClient,
  chain,
}: {
  parentAccount: { address: string }
  parentWalletClient: WalletClient
  chain: Chain
}) {
  if (!isArbitrumNetworkWithCustomFeeToken()) return

  const networks = localNetworks()
  const inbox = networks.l3Network!.ethBridge.inbox

  const currentAllowance = await getParentCustomFeeTokenAllowance(
    parentAccount.address,
    inbox
  )

  // Only approve if allowance is insufficient
  if (currentAllowance.lt(ethers.constants.MaxUint256)) {
    const ethBridger = await EthBridger.fromProvider(arbProvider())
    const approveRequest = ethBridger.getApproveGasTokenRequest()
    await parentWalletClient.sendTransaction({
      to: approveRequest.to as Hex,
      data: approveRequest.data as Hex,
      account: parentAccount as Account,
      chain,
      value: BigInt(0),
      kzg: undefined,
    })
  }
}
