import { ethers, Wallet } from 'ethers'
import { setupNetworks } from './instantiate_bridge'
import * as fs from 'fs'

async function main() {
  const arbUrl = process.env['ARB_URL']
  const ethUrl = process.env['ETH_URL']
  const ethProvider = new ethers.providers.JsonRpcProvider(ethUrl)
  const arbProvider = new ethers.providers.JsonRpcProvider(arbUrl)

  const ethDeployer = ethProvider.getSigner(0)
  const arbGenesisWallet = new Wallet(process.env.ARB_GENESIS_KEY as string)
  const arbDeployer = arbGenesisWallet.connect(arbProvider)

  const { l1Network, l2Network } = await setupNetworks(ethDeployer, arbDeployer)

  fs.writeFileSync(
    'localNetwork.json',
    JSON.stringify({
      l1Network,
      l2Network,
    })
  )
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
