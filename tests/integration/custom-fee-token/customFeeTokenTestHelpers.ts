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
    utils.sha256(utils.toUtf8Bytes('user_token_bridge_deployer')),
    ethProvider()
  )

  const tokenContract = ERC20__factory.connect(nativeToken, deployerWallet)

  const tx = await tokenContract.transfer(address, utils.parseEther('10'))
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

  const tx = await deployerWallet.sendTransaction({
    to: await childSigner.getAddress(),
    value: utils.parseEther('1'),
  })
  await tx.wait()
}
