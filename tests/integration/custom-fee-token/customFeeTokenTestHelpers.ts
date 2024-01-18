import { utils, Signer, Wallet } from 'ethers'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import * as path from 'path'
import * as fs from 'fs'

import { testSetup as _testSetup, config } from '../../../scripts/testSetup'
import { ERC20__factory } from '../../../src/lib/abi/factories/ERC20__factory'
import { Erc20Bridger, EthBridger, L1Network, L2Network } from '../../../src'

const ethProvider = new StaticJsonRpcProvider(config.ethUrl)
const arbProvider = new StaticJsonRpcProvider(config.arbUrl)

export function isL2NetworkWithCustomFeeToken(): boolean {
  return typeof getLocalNetworks().l2Network.nativeToken !== 'undefined'
}

function getLocalNetworks(): {
  l1Network: L1Network
  l2Network: L2Network
} {
  const pathToLocalNetworkFile = path.join(
    __dirname,
    '..',
    path.sep,
    '..',
    path.sep,
    '..',
    'localNetwork.json'
  )

  return JSON.parse(fs.readFileSync(pathToLocalNetworkFile, 'utf8'))
}

export async function testSetup() {
  const result = await _testSetup()
  const { l2Network, l1Provider } = result

  const nativeToken = l2Network.nativeToken!
  const nativeTokenContract = ERC20__factory.connect(nativeToken, l1Provider)

  return { ...result, nativeTokenContract }
}

export async function fundL1CustomFeeToken(l1SignerOrAddress: Signer | string) {
  const nativeToken = getLocalNetworks().l2Network.nativeToken
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
    utils.sha256(utils.toUtf8Bytes('user_l1user')),
    ethProvider
  )

  const tokenContract = ERC20__factory.connect(nativeToken, deployerWallet)

  const tx = await tokenContract.transfer(address, utils.parseEther('10'))
  await tx.wait()
}

export async function approveL1CustomFeeToken(l1Signer: Signer) {
  const ethBridger = await EthBridger.fromProvider(arbProvider)

  const tx = await ethBridger.approveFeeToken({ l1Signer })
  await tx.wait()
}

export async function getNativeTokenAllowance(owner: string, spender: string) {
  const nativeToken = getLocalNetworks().l2Network.nativeToken
  const nativeTokenContract = ERC20__factory.connect(nativeToken!, ethProvider)
  return nativeTokenContract.allowance(owner, spender)
}

export async function approveL1CustomFeeTokenForErc20Deposit(
  l1Signer: Signer,
  erc20L1Address: string
) {
  const erc20Bridger = await Erc20Bridger.fromProvider(arbProvider)

  const tx = await erc20Bridger.approveFeeToken({ erc20L1Address, l1Signer })
  await tx.wait()
}

export async function fundL2CustomFeeToken(l2Signer: Signer) {
  const deployerWallet = new Wallet(
    utils.sha256(utils.toUtf8Bytes('user_l1user')),
    arbProvider
  )

  const tx = await deployerWallet.sendTransaction({
    to: await l2Signer.getAddress(),
    value: utils.parseEther('1'),
  })
  await tx.wait()
}
