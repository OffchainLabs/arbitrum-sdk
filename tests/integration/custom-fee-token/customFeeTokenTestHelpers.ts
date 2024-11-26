import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer, Wallet, ethers, utils } from 'ethers'
import {
  Account,
  parseEther,
  parseUnits,
  type Hex,
  type WalletClient,
  type Chain,
} from 'viem'

import {
  testSetup as _testSetup,
  config,
  getLocalNetworksFromFile,
} from '../../../scripts/testSetup'
import { Erc20Bridger, EthBridger } from '../../../src'
import { ERC20__factory } from '../../../src/lib/abi/factories/ERC20__factory'
import { getNativeTokenDecimals } from '../../../src/lib/utils/lib'

// `config` isn't initialized yet, so we have to wrap these in functions
const ethProvider = () => new StaticJsonRpcProvider(config.ethUrl)
const arbProvider = () => new StaticJsonRpcProvider(config.arbUrl)
const localNetworks = () => getLocalNetworksFromFile()

export function isArbitrumNetworkWithCustomFeeToken(): boolean {
  const nt = localNetworks().l3Network?.nativeToken
  return typeof nt !== 'undefined' && nt !== ethers.constants.AddressZero
}

export async function testSetup() {
  const result = await _testSetup()
  const { childChain, parentProvider } = result

  const nativeToken = childChain.nativeToken!
  const nativeTokenContract = ERC20__factory.connect(
    nativeToken,
    parentProvider
  )

  return { ...result, nativeTokenContract }
}

export async function fundParentCustomFeeToken(
  parentSignerOrAddress: Signer | string
) {
  const nativeToken = localNetworks().l3Network?.nativeToken
  const address =
    typeof parentSignerOrAddress === 'string'
      ? parentSignerOrAddress
      : await parentSignerOrAddress.getAddress()

  if (typeof nativeToken === 'undefined') {
    throw new Error(
      `can't call "fundParentCustomFeeToken" for network that uses eth as native token`
    )
  }

  const deployerWallet = new Wallet(
    utils.sha256(utils.toUtf8Bytes('user_fee_token_deployer')),
    ethProvider()
  )

  const tokenContract = ERC20__factory.connect(nativeToken, deployerWallet)
  const decimals = await tokenContract.decimals()

  const tx = await tokenContract.transfer(
    address,
    utils.parseUnits('10', decimals)
  )
  await tx.wait()
}

export async function approveParentCustomFeeToken(parentSigner: Signer) {
  const ethBridger = await EthBridger.fromProvider(arbProvider())

  const tx = await ethBridger.approveGasToken({ parentSigner })
  await tx.wait()
}

export async function getParentCustomFeeTokenAllowance(
  owner: string,
  spender: string
) {
  const nativeToken = localNetworks().l3Network?.nativeToken
  const nativeTokenContract = ERC20__factory.connect(
    nativeToken!,
    ethProvider()
  )
  return nativeTokenContract.allowance(owner, spender)
}

export async function approveParentCustomFeeTokenForErc20Deposit(
  parentSigner: Signer,
  erc20ParentAddress: string
) {
  const erc20Bridger = await Erc20Bridger.fromProvider(arbProvider())

  const tx = await erc20Bridger.approveGasToken({
    erc20ParentAddress: erc20ParentAddress,
    parentSigner,
  })
  await tx.wait()
}

export async function fundChildCustomFeeToken(childSigner: Signer) {
  const deployerWallet = new Wallet(config.arbKey, arbProvider())

  const decimals = await getNativeTokenDecimals({
    parentProvider: ethProvider(),
    childNetwork: localNetworks().l2Network,
  })

  const tx = await deployerWallet.sendTransaction({
    to: await childSigner.getAddress(),
    value: utils.parseUnits('1', decimals),
  })
  await tx.wait()
}

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
  return balanceDiff / BigInt(10 ** (18 - tokenDecimals))
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
