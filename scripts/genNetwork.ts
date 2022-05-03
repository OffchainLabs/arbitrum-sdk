import { ethers } from 'ethers'
import { setupNetworks, config, getSigner } from './testSetup'
import * as fs from 'fs'

async function main() {
  const ethProvider = new ethers.providers.JsonRpcProvider(config.ethUrl)
  const arbProvider = new ethers.providers.JsonRpcProvider(config.arbUrl)

  const ethDeployer = getSigner(ethProvider, config.ethKey)
  const arbDeployer = getSigner(arbProvider, config.arbKey)

  const { l1Network, l2Network } = await setupNetworks(
    ethDeployer,
    arbDeployer,
    config.ethUrl,
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
