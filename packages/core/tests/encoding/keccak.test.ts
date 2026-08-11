import { describe, it, expect } from 'vitest'
import { keccak256 } from '../../src/encoding/keccak'

describe('keccak256', () => {
  it('hashes empty bytes correctly', () => {
    // keccak256 of empty input is a well-known constant
    const result = keccak256('0x')
    expect(result).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    )
  })

  it('hashes 0xdeadbeef correctly', () => {
    // Known keccak256('0xdeadbeef') — matches ethers.utils.keccak256('0xdeadbeef')
    const result = keccak256('0xdeadbeef')
    expect(result).toBe(
      '0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1'
    )
  })

  it('hashes a Uint8Array', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const result = keccak256(bytes)
    expect(result).toBe(
      '0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1'
    )
  })

  it('hashes ASCII-like hex data', () => {
    // keccak256 of the bytes for 'hello' = 0x68656c6c6f
    const result = keccak256('0x68656c6c6f')
    expect(result).toBe(
      '0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8'
    )
  })

  it('produces 32-byte output', () => {
    const result = keccak256('0x01')
    // 0x + 64 hex chars = 32 bytes
    expect(result.length).toBe(66)
    expect(result.startsWith('0x')).toBe(true)
  })
})
