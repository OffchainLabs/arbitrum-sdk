import * as dotenv from 'dotenv'
dotenv.config()
import { execSync } from 'child_process'
import * as fs from 'fs'
import { L2Network } from '../src'
import { IERC20Bridge__factory } from '../src/lib/abi/factories/IERC20Bridge__factory'
import { ethers } from 'ethers'

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

/**
 * the container's files are written by the token bridge deployment step of the test node, which runs a script in token-bridge-contracts.
 * once the script in token-bridge-contracts repo uses an sdk version with the same types and is updated to populate those fields,
 * we can remove this patchwork
 */
async function patchNetworks(
  l2Network: L2Network,
  l3Network: L2Network | undefined,
  l2Provider: ethers.providers.Provider | undefined
) {
  // in case network was generated with an older version of the SDK
  l2Network.parentChainId = (l2Network as any).partnerChainID

  // native token for l3
  if (l3Network && l2Provider) {
    // in case network was generated with an older version of the SDK
    l3Network.parentChainId = (l3Network as any).partnerChainID

    try {
      l3Network.nativeToken = await IERC20Bridge__factory.connect(
        l3Network.ethBridge.bridge,
        l2Provider
      ).nativeToken()
    } catch (e) {
      // l3 network doesn't have a native token
    }
  }
}

async function main() {
  fs.rmSync('localNetwork.json', { force: true })

  let output = getLocalNetworksFromContainer('l1l2')

  if (isTestingOrbitChains) {
    const { l2Network: l3Network } = getLocalNetworksFromContainer('l2l3')
    await patchNetworks(
      output.l2Network,
      l3Network,
      new ethers.providers.JsonRpcProvider(process.env['ARB_URL'])
    )
    output = {
      l1Network: output.l2Network,
      l2Network: l3Network,
    }
  } else {
    await patchNetworks(output.l2Network, undefined, undefined)
  }

  fs.writeFileSync('localNetwork.json', JSON.stringify(output, null, 2))
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
