import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer, Wallet, ethers, utils } from 'ethers'

import {
  testSetup as _testSetup,
  config,
  getLocalNetworksFromFile,
} from '../../../scripts/testSetup'
import { Erc20Bridger, EthBridger } from '../../../src'
import { ERC20__factory } from '../../../src/lib/abi/factories/ERC20__factory'

// `config` isn't initialized yet, so we have to wrap these in functions
const ethProvider = () => new StaticJsonRpcProvider(config.ethUrl)
const arbProvider = () => new StaticJsonRpcProvider(config.arbUrl)
const localNetworks = () => getLocalNetworksFromFile()

export function isL2NetworkWithCustomFeeToken(): boolean {
  const nt = localNetworks().l2Network.nativeToken
  return typeof nt !== 'undefined' && nt !== ethers.constants.AddressZero
}

export async function testSetup() {
  const result = await _testSetup()
  const { l2Network, l1Provider } = result

  const nativeToken = l2Network.nativeToken!
  const nativeTokenContract = ERC20__factory.connect(nativeToken, l1Provider)

  return { ...result, nativeTokenContract }
}

export async function fundL1CustomFeeToken(l1SignerOrAddress: Signer | string) {
  const nativeToken = localNetworks().l2Network.nativeToken
  const address =
    typeof l1SignerOrAddress === 'string'
      ? l1SignerOrAddress
      : await l1SignerOrAddress.getAddress()

  if (typeof nativeToken === 'undefined') {
    throw new Error(
      `can't call "fundL1CustomFeeToken" for network that uses eth as native token`
    )
  }

  const deployerWallet = new Wallet(
    utils.sha256(utils.toUtf8Bytes('user_token_bridge_deployer')),
    ethProvider()
  )

  const tokenContract = ERC20__factory.connect(nativeToken, deployerWallet)

  const tx = await tokenContract.transfer(address, utils.parseEther('10'))
  await tx.wait()
}

export async function approveL1CustomFeeToken(l1Signer: Signer) {
  const ethBridger = await EthBridger.fromProvider(arbProvider())

  const tx = await ethBridger.approveGasToken({ l1Signer })
  await tx.wait()
}

export async function getL1CustomFeeTokenAllowance(
  owner: string,
  spender: string
) {
  const nativeToken = localNetworks().l2Network.nativeToken
  const nativeTokenContract = ERC20__factory.connect(
    nativeToken!,
    ethProvider()
  )
  return nativeTokenContract.allowance(owner, spender)
}

export async function approveL1CustomFeeTokenForErc20Deposit(
  l1Signer: Signer,
  erc20L1Address: string
) {
  const erc20Bridger = await Erc20Bridger.fromProvider(arbProvider())

  const tx = await erc20Bridger.approveGasToken({ erc20L1Address, l1Signer })
  await tx.wait()
}

export async function fundL2CustomFeeToken(l2Signer: Signer) {
  const deployerWallet = new Wallet(config.arbKey, arbProvider())

  const tx = await deployerWallet.sendTransaction({
    to: await l2Signer.getAddress(),
    value: utils.parseEther('1'),
  })
  await tx.wait()
}
