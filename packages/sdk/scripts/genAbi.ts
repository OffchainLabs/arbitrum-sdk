import { runTypeChain, glob } from 'typechain'
import { execSync } from 'child_process'
import { unlinkSync, rmSync } from 'fs'
import * as path from 'path'

const ABI_PATH = path.resolve(__dirname, '../src/lib/abi')

const getPackagePath = (packageName: string): string => {
  const path = require.resolve(`${packageName}/package.json`)
  return path.substr(0, path.indexOf('package.json'))
}

async function main() {
  console.log('Removing previously generated ABIs.\n')
  rmSync(`${ABI_PATH}`, { recursive: true, force: true })
  rmSync(`${ABI_PATH}/classic`, { recursive: true, force: true })

  const cwd = process.cwd()

  const nitroPath = getPackagePath('@arbitrum/nitro-contracts')
  const tokenBridgePath = getPackagePath('@arbitrum/token-bridge-contracts')
  const teleporterPath = getPackagePath(
    '@offchainlabs/l1-l3-teleport-contracts'
  )

  console.log('Compiling paths.')

  const npmExec = process.env['npm_execpath']
  if (!npmExec || npmExec === '')
    throw new Error(
      'No support for npm_execpath env variable in package manager'
    )

  // TODO: use `HARDHAT_ARTIFACT_PATH` to write files to arbitrum sdk instead of the packages themselves.
  // this is currently broken since hardhat throws a weird error:
  // `Error HH702: Invalid artifact path [...] its correct case-sensitive path is...`
  // https://yarnpkg.com/advanced/rulebook#packages-should-never-write-inside-their-own-folder-outside-of-postinstall
  // instead of writing in postinstall in each of those packages, we should target a local folder in sdk's postinstall

  console.log('building @arbitrum/nitro-contracts')
  execSync(`${npmExec} run build`, { cwd: nitroPath })

  console.log('building @arbitrum/token-bridge-contracts')
  execSync(`${npmExec} run build`, { cwd: tokenBridgePath })

  console.log('building @offchainlabs/l1-l3-teleport-contracts')
  execSync(`${npmExec} run build`, {
    cwd: teleporterPath,
  })

  console.log('Done compiling')

  const nitroFiles = glob(cwd, [
    `${tokenBridgePath}/build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
    `${nitroPath}/build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
    `${teleporterPath}/build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
  ])

  // TODO: generate files into different subfolders (ie `/nitro/*`) to avoid overwrite of contracts with the same name
  await runTypeChain({
    cwd,
    filesToProcess: nitroFiles,
    allFiles: nitroFiles,
    outDir: `${ABI_PATH}`,
    target: 'ethers-v5',
  })

  const classicFiles = glob(cwd, [
    // we have a hardcoded abi for the old outbox
    `./src/lib/dataEntities/Outbox.json`,
  ])

  await runTypeChain({
    cwd,
    filesToProcess: classicFiles,
    allFiles: classicFiles,
    outDir: `${ABI_PATH}/classic`,
    target: 'ethers-v5',
  })

  // we delete the index file since it doesn't play well with tree shaking
  unlinkSync(`${ABI_PATH}/index.ts`)
  unlinkSync(`${ABI_PATH}/classic/index.ts`)

  console.log('Typechain generated')
}

main()
  .then(() => console.log('Done.'))
  .catch(console.error)
