import { runTypeChain, glob } from 'typechain'
import { unlinkSync, rmSync, existsSync } from 'fs'
import * as path from 'path'

// Configuration for where to output the bindings
const BASE_ABI_PATH = path.resolve(__dirname, '../src/lib/abi')

/**
 * Resolves the root directory of a generic npm package.
 * Replaces the deprecated path.substr logic with path.dirname.
 */
const getPackagePath = (packageName: string): string => {
  try {
    const entryPoint = require.resolve(`${packageName}/package.json`)
    return path.dirname(entryPoint)
  } catch (e) {
    console.warn(`Warning: Could not resolve package ${packageName}. Is it installed?`)
    return ''
  }
}

/**
 * Defines the structure for contract sources.
 * This solves the TODO regarding file overwrites by assigning namespaces.
 */
interface ContractSource {
  packageName: string
  artifactPath: string // Glob pattern relative to package root
  outputDir: string    // Subdirectory in ABI_PATH
}

// Configuration: Map packages to specific output folders to prevent name collisions
const SOURCES: ContractSource[] = [
  {
    packageName: '@arbitrum/nitro-contracts',
    artifactPath: 'build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json',
    outputDir: 'nitro'
  },
  {
    packageName: '@arbitrum/token-bridge-contracts',
    artifactPath: 'build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json',
    outputDir: 'token-bridge'
  },
  {
    packageName: '@offchainlabs/l1-l3-teleport-contracts',
    artifactPath: 'build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json',
    outputDir: 'teleport'
  }
]

async function main() {
  console.log('🚀 Starting TypeChain generation...\n')

  // 1. Clean up existing ABIs
  console.log('🧹 Cleaning old directories...')
  rmSync(BASE_ABI_PATH, { recursive: true, force: true })

  const cwd = process.cwd()

  // 2. Process external packages
  // We iterate through sources to generate Types into isolated folders
  for (const source of SOURCES) {
    const packageRoot = getPackagePath(source.packageName)
    if (!packageRoot) continue

    // Construct the full glob pattern
    // Note: We assume the artifacts exist. We DO NOT build inside node_modules.
    // If artifacts are missing, the dev environment is set up incorrectly.
    const globPattern = path.join(packageRoot, source.artifactPath)
    
    const files = glob(cwd, [globPattern])

    if (files.length === 0) {
      console.warn(`⚠️  No artifacts found for ${source.packageName}. Ensure dependencies are installed.`)
      continue
    }

    const targetDir = path.join(BASE_ABI_PATH, source.outputDir)

    console.log(`⚡ Generating bindings for ${source.packageName} -> ${source.outputDir}`)
    
    await runTypeChain({
      cwd,
      filesToProcess: files,
      allFiles: files,
      outDir: targetDir,
      target: 'ethers-v5', // Keeping v5 as per original requirement
    })

    // Remove index file to facilitate tree-shaking
    const indexFile = path.join(targetDir, 'index.ts')
    if (existsSync(indexFile)) {
      unlinkSync(indexFile)
    }
  }

  // 3. Process Classic/Legacy local files
  // These are handled separately as they are local source files, not npm deps
  console.log('⚡ Generating bindings for Classic (Local)...')
  const classicFiles = glob(cwd, [
    './src/lib/dataEntities/Outbox.json',
  ])

  const classicTargetDir = path.join(BASE_ABI_PATH, 'classic')
  
  await runTypeChain({
    cwd,
    filesToProcess: classicFiles,
    allFiles: classicFiles,
    outDir: classicTargetDir,
    target: 'ethers-v5',
  })

  // Cleanup classic index
  const classicIndex = path.join(classicTargetDir, 'index.ts')
  if (existsSync(classicIndex)) {
    unlinkSync(classicIndex)
  }

  // 4. Remove the root index if Typechain generated one (usually implies common types)
  const rootIndex = path.join(BASE_ABI_PATH, 'index.ts')
  if (existsSync(rootIndex)) {
    unlinkSync(rootIndex)
  }

  console.log('\n✅ TypeChain generation complete.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error during TypeChain generation:')
    console.error(error)
    process.exit(1)
  })
