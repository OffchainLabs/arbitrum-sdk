import { utils, Signer, Wallet } from 'ethers'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import * as path from 'path'
import * as fs from 'fs'

import { testSetup as _testSetup, config } from '../../../scripts/testSetup'
import { ERC20__factory } from '../../../src/lib/abi/factories/ERC20__factory'
import { EthBridger, L1Network, L2Network } from '../../../src'

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

export async function fundL1WithCustomFeeToken(l1Signer: Signer) {
  const nativeToken = getLocalNetworks().l2Network.nativeToken

  if (typeof nativeToken === 'undefined') {
    throw new Error(
      `can't call "fundL1WithCustomFeeToken" for network that uses eth as native token`
    )
  }

  const deployerWallet = new Wallet(
    utils.sha256(utils.toUtf8Bytes('user_l1user')),
    new StaticJsonRpcProvider(config.ethUrl)
  )

  const address = await l1Signer.getAddress()
  const tokenContract = ERC20__factory.connect(nativeToken, deployerWallet)

  const tx = await tokenContract.transfer(address, utils.parseEther('10'))
  await tx.wait()
}

export async function approveL1CustomFeeToken(l1Signer: Signer) {
  const ethBridger = await EthBridger.fromProvider(
    new StaticJsonRpcProvider(config.arbUrl)
  )

  const tx = await ethBridger.approve({ l1Signer })
  await tx.wait()
}
