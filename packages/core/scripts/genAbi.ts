/**
 * ABI extraction script.
 *
 * Reads typechain factory files from the existing SDK package and extracts
 * the raw ABI arrays. Writes them as `export const <name>Abi = [...] as const`
 * files in packages/core/src/abi/.
 *
 * Usage: npx ts-node scripts/genAbi.ts
 *
 * This script reads from the sibling `packages/sdk` directory. It does NOT
 * run Hardhat builds or typechain — it only extracts from already-generated files.
 */
import * as fs from 'fs'
import * as path from 'path'

const SDK_ROOT = path.resolve(__dirname, '../../sdk/src/lib')
const ABI_FACTORIES = path.join(SDK_ROOT, 'abi/factories')
const ABI_CLASSIC_FACTORIES = path.join(SDK_ROOT, 'abi/classic/factories')
const ABI_BOLD_FACTORIES = path.join(SDK_ROOT, 'abi-bold/factories')
const OUTPUT_DIR = path.resolve(__dirname, '../src/abi')

/**
 * Contracts used by the SDK (extracted by searching for __factory imports).
 * Maps contract name to the factory file location.
 */
const CONTRACTS: Record<string, string> = {
  // Core Arbitrum contracts
  ArbAddressTable: path.join(ABI_FACTORIES, 'ArbAddressTable__factory.ts'),
  ArbRetryableTx: path.join(ABI_FACTORIES, 'ArbRetryableTx__factory.ts'),
  ArbSys: path.join(ABI_FACTORIES, 'ArbSys__factory.ts'),
  Bridge: path.join(ABI_FACTORIES, 'Bridge__factory.ts'),
  ERC20: path.join(ABI_FACTORIES, 'ERC20__factory.ts'),
  ERC20Inbox: path.join(ABI_FACTORIES, 'ERC20Inbox__factory.ts'),
  IArbToken: path.join(ABI_FACTORIES, 'IArbToken__factory.ts'),
  ICustomToken: path.join(ABI_FACTORIES, 'ICustomToken__factory.ts'),
  IERC20: path.join(ABI_FACTORIES, 'IERC20__factory.ts'),
  IERC20Bridge: path.join(ABI_FACTORIES, 'IERC20Bridge__factory.ts'),
  IInbox: path.join(ABI_FACTORIES, 'IInbox__factory.ts'),
  IL1Teleporter: path.join(ABI_FACTORIES, 'IL1Teleporter__factory.ts'),
  IL2ForwarderFactory: path.join(
    ABI_FACTORIES,
    'IL2ForwarderFactory__factory.ts'
  ),
  IL2ForwarderPredictor: path.join(
    ABI_FACTORIES,
    'IL2ForwarderPredictor__factory.ts'
  ),
  Inbox: path.join(ABI_FACTORIES, 'Inbox__factory.ts'),
  L1ERC20Gateway: path.join(ABI_FACTORIES, 'L1ERC20Gateway__factory.ts'),
  L1GatewayRouter: path.join(ABI_FACTORIES, 'L1GatewayRouter__factory.ts'),
  L1WethGateway: path.join(ABI_FACTORIES, 'L1WethGateway__factory.ts'),
  L2ArbitrumGateway: path.join(
    ABI_FACTORIES,
    'L2ArbitrumGateway__factory.ts'
  ),
  L2ERC20Gateway: path.join(ABI_FACTORIES, 'L2ERC20Gateway__factory.ts'),
  L2GatewayRouter: path.join(ABI_FACTORIES, 'L2GatewayRouter__factory.ts'),
  L2GatewayToken: path.join(ABI_FACTORIES, 'L2GatewayToken__factory.ts'),
  Multicall2: path.join(ABI_FACTORIES, 'Multicall2__factory.ts'),
  NodeInterface: path.join(ABI_FACTORIES, 'NodeInterface__factory.ts'),
  Outbox: path.join(ABI_FACTORIES, 'Outbox__factory.ts'),
  RollupAdminLogic: path.join(ABI_FACTORIES, 'RollupAdminLogic__factory.ts'),
  RollupUserLogic: path.join(ABI_FACTORIES, 'RollupUserLogic__factory.ts'),
  SequencerInbox: path.join(ABI_FACTORIES, 'SequencerInbox__factory.ts'),

  // Classic Outbox (different ABI from nitro Outbox)
  OutboxClassic: path.join(ABI_CLASSIC_FACTORIES, 'Outbox__factory.ts'),

  // BOLD
  BoldRollupUserLogic: path.join(
    ABI_BOLD_FACTORIES,
    'BoldRollupUserLogic__factory.ts'
  ),
}

/**
 * Extract the _abi array from a typechain factory file.
 *
 * The factory files have a pattern like:
 *   const _abi = [ ... ];
 *
 * We find the start of the array and use bracket counting to find the end.
 */
function extractAbi(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Find "const _abi = ["
  const startMarker = 'const _abi = ['
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) {
    throw new Error(`Could not find _abi in ${filePath}`)
  }

  // Start from the opening bracket
  const bracketStart = startIdx + startMarker.length - 1 // position of '['
  let depth = 0
  let i = bracketStart

  // Count brackets to find the matching close bracket
  for (; i < content.length; i++) {
    if (content[i] === '[') depth++
    if (content[i] === ']') depth--
    if (depth === 0) break
  }

  if (depth !== 0) {
    throw new Error(`Unbalanced brackets in ${filePath}`)
  }

  // Extract the full array literal (including [ and ])
  const abiLiteral = content.substring(bracketStart, i + 1)

  // Parse and re-stringify to ensure valid JSON, then return
  // Actually, we want the TypeScript literal form, not JSON.
  // The typechain output is already valid TypeScript — just return it.
  return abiLiteral
}

/**
 * Write an ABI file in the format:
 *   export const <name>Abi = [ ... ] as const
 */
function writeAbiFile(name: string, abiLiteral: string): void {
  const content = `/**
 * ABI for the ${name} contract.
 * Auto-generated from typechain factory files. Do not edit manually.
 * Regenerate with: npx ts-node scripts/genAbi.ts
 */
export const ${name}Abi = ${abiLiteral} as const
`
  const filePath = path.join(OUTPUT_DIR, `${name}.ts`)
  fs.writeFileSync(filePath, content)
  console.log(`  wrote ${filePath}`)
}

/**
 * Write the barrel index file.
 */
function writeIndex(names: string[]): void {
  const lines = names.map(n => `export { ${n}Abi } from './${n}'`)
  const content = `/**
 * ABI barrel exports.
 * Auto-generated. Do not edit manually.
 */
${lines.join('\n')}
`
  const filePath = path.join(OUTPUT_DIR, 'index.ts')
  fs.writeFileSync(filePath, content)
  console.log(`  wrote ${filePath}`)
}

// Main
function main(): void {
  console.log('Extracting ABIs from typechain factories...\n')

  // Ensure output dir exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const names: string[] = []

  for (const [name, factoryPath] of Object.entries(CONTRACTS)) {
    if (!fs.existsSync(factoryPath)) {
      console.warn(`  SKIP ${name}: factory not found at ${factoryPath}`)
      continue
    }

    try {
      const abi = extractAbi(factoryPath)
      writeAbiFile(name, abi)
      names.push(name)
    } catch (err) {
      console.error(`  ERROR ${name}: ${(err as Error).message}`)
    }
  }

  names.sort()
  writeIndex(names)

  console.log(`\nDone. Generated ${names.length} ABI files.`)
}

main()
