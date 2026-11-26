import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

const sdkRoot = resolve(__dirname, '../..')
const importPattern =
  /from\s+['"](@ethersproject\/[a-z0-9-]+)(?:\/[^'"]*)?['"]/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith('.ts')
      ? [path]
      : []
  })
}

describe('published package dependencies', () => {
  it('declares every @ethersproject package imported by src', () => {
    const declared = Object.keys(
      JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8'))
        .dependencies
    )
    const used = new Set<string>()
    for (const file of sourceFiles(join(sdkRoot, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(importPattern)) {
        used.add(match[1])
      }
    }
    expect(used.size).toBeGreaterThan(0)
    expect([...used].filter(name => !declared.includes(name)).sort()).toEqual(
      []
    )
  })
})
