import { loadEnv } from '../src/lib/utils/env'
import { execSync } from 'child_process'
import * as fs from 'fs'

loadEnv()

const isTestingOrbitChains = process.env.ORBIT_TEST === '1'

function getLocalNetworksFromContainer(which: 'l1l2' | 'l2l3'): any {
  const dockerNames = [
    'nitro_sequencer_1',
    'nitro-sequencer-1',
    'nitro-testnode-sequencer-1',
    'nitro-testnode_sequencer_1',
  ]
  for (const dockerName of dockerNames) {
    try {
      return JSON.parse(
        execSync(
          `docker exec ${dockerName} cat /tokenbridge-data/${which}_network.json`
        ).toString()
      )
    } catch {
      // empty on purpose
    }
  }
  throw new Error('nitro-testnode sequencer not found')
}

async function main() {
  fs.rmSync('localNetwork.json', { force: true })

  const output = getLocalNetworksFromContainer('l1l2')

  if (isTestingOrbitChains) {
    // When running with L3 active, the container calls the L3 network L2 so we rename it here
    const { l2Network: l3Network } = getLocalNetworksFromContainer('l2l3')
    output.l3Network = l3Network
  }

  fs.writeFileSync('localNetwork.json', JSON.stringify(output, null, 2))
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
