import { ethers } from 'ethers'
import { setupNetworks, config, getSigner } from './testSetup'
import * as fs from 'fs'

async function main() {
  const ethProvider = new ethers.providers.JsonRpcProvider(config.ethUrl)
  const arbProvider = new ethers.providers.JsonRpcProvider(config.arbUrl)
  const l3Provider = new ethers.providers.JsonRpcProvider(config.l3Url)

  const ethDeployer = getSigner(ethProvider, config.ethKey)
  const arbDeployer = getSigner(arbProvider, config.arbKey)
  const l3Deployer = getSigner(l3Provider, config.l3Key)

  const { l1Network, l2Network, l3Network } = await setupNetworks(
    ethDeployer,
    arbDeployer,
    l3Deployer,
    config.ethUrl,
    config.arbUrl,
    config.l3Url
  )

  fs.writeFileSync(
    'localNetwork.json',
    JSON.stringify({ l1Network, l2Network, l3Network }, null, 2)
  )
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
