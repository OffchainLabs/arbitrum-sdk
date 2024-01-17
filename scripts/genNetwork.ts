import { testSetup } from './testSetup'
import * as fs from 'fs'

async function main() {
  const setup = await testSetup(true)
  fs.writeFileSync(
    'localNetwork.json',
    JSON.stringify(
      { l1Network: setup.l1Network, l2Network: setup.l2Network },
      null,
      2
    )
  )
  console.log('localnetwork.json updated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
