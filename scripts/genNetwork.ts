import { ethers, Wallet } from 'ethers'
import { setupNetworks, config } from './testSetup'
import * as fs from 'fs'

async function main() {
  const ethProvider = new ethers.providers.JsonRpcProvider(config.ethUrl)
  const arbProvider = new ethers.providers.JsonRpcProvider(config.arbUrl)

  const ethDeployer = ethProvider.getSigner(0)
  const arbGenesisWallet = new Wallet(config.arbGenesisKey)
  const arbDeployer = arbGenesisWallet.connect(arbProvider)

  const { l1Network, l2Network } = await setupNetworks(
    ethDeployer,
    arbDeployer,
    config.arbUrl,
    config.arbUrl
  )

  fs.writeFileSync(
    'localNetwork.json',
    JSON.stringify({ l1Network, l2Network }, null, 2)
  )
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
