import { ethers, utils } from 'ethers'

import { testSetup as _testSetup } from '../../../scripts/testSetup'
import { ERC20__factory } from '../../../src/lib/abi/factories/ERC20__factory'

export async function testSetup() {
  const result = await _testSetup()
  const { l2Network, l1Provider } = result

  const nativeToken = l2Network.nativeToken!
  const nativeTokenContract = ERC20__factory.connect(nativeToken, l1Provider)

  return { ...result, nativeTokenContract }
}

export async function fundL1(account: string) {
  const { l1Provider, nativeTokenContract } = await testSetup()

  const l1DeployerWallet = new ethers.Wallet(
    ethers.utils.sha256(ethers.utils.toUtf8Bytes('user_l1user')),
    l1Provider
  )

  // send 1 eth to account
  const fundEthTx = await l1DeployerWallet.sendTransaction({
    to: account,
    value: utils.parseEther('1'),
  })
  await fundEthTx.wait()

  // send 10 erc-20 tokens to account
  const fundTokenTx = await nativeTokenContract
    .connect(l1DeployerWallet)
    .transfer(account, utils.parseEther('10'))
  await fundTokenTx.wait()
}
