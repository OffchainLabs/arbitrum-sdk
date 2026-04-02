/**
 * Minimal ABI encoder/decoder for Solidity types.
 * Handles: address, uint<N>, int<N>, bool, bytes, bytes<N>, string,
 *          tuple, dynamic arrays, fixed-size arrays.
 *
 * No ethers/viem dependencies.
 */
import { keccak256 } from './keccak'
import { hexToBytes, bytesToHex, isHexString } from './hex'
import { getAddress } from './address'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface AbiParameter {
  readonly name: string
  readonly type: string
  readonly indexed?: boolean
  readonly components?: readonly AbiParameter[]
}

interface AbiFunction {
  readonly type: 'function'
  readonly name: string
  readonly inputs: readonly AbiParameter[]
  readonly outputs: readonly AbiParameter[]
  readonly stateMutability?: string
}

interface AbiEvent {
  readonly type: 'event'
  readonly name: string
  readonly inputs: readonly (AbiParameter & { readonly indexed?: boolean })[]
}

type AbiItem = AbiFunction | AbiEvent | { readonly type: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Abi = readonly any[]

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

const WORD = 32 // 32 bytes per ABI word

/**
 * Encode a bigint as a 32-byte big-endian hex string (no 0x prefix, 64 chars).
 */
function encodeUint256(value: bigint): string {
  const hex = value.toString(16)
  return hex.padStart(64, '0')
}

/**
 * Encode a signed int256 as a 32-byte two's-complement hex string.
 */
function encodeInt256(value: bigint): string {
  if (value >= 0n) {
    return encodeUint256(value)
  }
  // Two's complement for 256-bit signed: value + 2^256
  const twos = value + (1n << 256n)
  return twos.toString(16).padStart(64, '0')
}

/**
 * Determine if a Solidity type is dynamic (needs offset indirection).
 */
function isDynamic(type: string, components?: readonly AbiParameter[]): boolean {
  if (type === 'bytes' || type === 'string') return true
  if (type.endsWith('[]')) return true
  if (type === 'tuple' && components) {
    return components.some(c => isDynamic(c.type, c.components))
  }
  // Fixed-size array: T[N] is dynamic if T is dynamic
  const fixedMatch = type.match(/^(.+)\[(\d+)\]$/)
  if (fixedMatch) {
    const baseType = fixedMatch[1]
    return isDynamic(baseType, components)
  }
  return false
}

/**
 * Compute the canonical type signature for a function or event.
 * e.g., "transfer(address,uint256)"
 */
function canonicalType(param: AbiParameter): string {
  if (param.type === 'tuple' && param.components) {
    return '(' + param.components.map(c => canonicalType(c)).join(',') + ')'
  }
  // For array types with tuple base: tuple[N] or tuple[]
  if (param.type.startsWith('tuple') && param.components) {
    const suffix = param.type.slice(5) // e.g., "[]" or "[3]"
    return (
      '(' +
      param.components.map(c => canonicalType(c)).join(',') +
      ')' +
      suffix
    )
  }
  return param.type
}

function functionSignature(name: string, inputs: readonly AbiParameter[]): string {
  return name + '(' + inputs.map(i => canonicalType(i)).join(',') + ')'
}

/**
 * Compute the 4-byte function selector for a function signature.
 */
function functionSelector(name: string, inputs: readonly AbiParameter[]): string {
  const sig = functionSignature(name, inputs)
  return keccak256(stringToHex(sig)).slice(0, 10) // 0x + 8 hex chars
}

/**
 * Convert an ASCII string to its hex representation.
 */
function stringToHex(str: string): string {
  let hex = '0x'
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Convert a hex string to an ASCII string.
 */
function hexToString(hex: string): string {
  const bytes = hexToBytes(hex)
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}

// ────────────────────────────────────────────────────────────────────────────
// Encoding
// ────────────────────────────────────────────────────────────────────────────

/**
 * Encode a single value for a given ABI type into "head" and "tail" parts.
 * Returns { head, tail } where:
 * - For static types: head is the 32-byte encoded value, tail is empty
 * - For dynamic types: head is the offset placeholder, tail is the encoded data
 */
function encodeValue(
  type: string,
  value: unknown,
  components?: readonly AbiParameter[]
): { head: string; tail: string } {
  // boolean
  if (type === 'bool') {
    return { head: encodeUint256(value ? 1n : 0n), tail: '' }
  }

  // address
  if (type === 'address') {
    const addr = (value as string).toLowerCase().replace('0x', '')
    return { head: addr.padStart(64, '0'), tail: '' }
  }

  // uint<N>
  if (type.match(/^uint\d*$/)) {
    const v = typeof value === 'bigint' ? value : BigInt(value as number)
    return { head: encodeUint256(v), tail: '' }
  }

  // int<N>
  if (type.match(/^int\d*$/)) {
    const v = typeof value === 'bigint' ? value : BigInt(value as number)
    return { head: encodeInt256(v), tail: '' }
  }

  // bytes<N> (fixed-size)
  if (type.match(/^bytes\d+$/)) {
    const hex = (value as string).replace('0x', '')
    return { head: hex.padEnd(64, '0'), tail: '' }
  }

  // bytes (dynamic)
  if (type === 'bytes') {
    const hex = (value as string).replace('0x', '')
    const byteLen = hex.length / 2
    const lenHex = encodeUint256(BigInt(byteLen))
    const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')
    return { head: '', tail: lenHex + padded }
  }

  // string (dynamic)
  if (type === 'string') {
    const str = value as string
    const hexStr = stringToHex(str).slice(2)
    const byteLen = hexStr.length / 2
    const lenHex = encodeUint256(BigInt(byteLen))
    const padded =
      byteLen === 0
        ? ''
        : hexStr.padEnd(Math.ceil(hexStr.length / 64) * 64, '0')
    return { head: '', tail: lenHex + padded }
  }

  // dynamic array: T[]
  if (type.endsWith('[]') && !type.match(/\[\d+\]$/)) {
    const baseType = type.slice(0, -2)
    const arr = value as unknown[]
    return encodeDynamicArray(baseType, arr, components)
  }

  // fixed-size array: T[N]
  const fixedMatch = type.match(/^(.+)\[(\d+)\]$/)
  if (fixedMatch) {
    const baseType = fixedMatch[1]
    const arr = value as unknown[]
    return encodeFixedArray(baseType, arr, components)
  }

  // tuple
  if (type === 'tuple' && components) {
    return encodeTuple(components, value as Record<string, unknown>)
  }

  throw new Error(`Unsupported ABI type: ${type}`)
}

function encodeDynamicArray(
  baseType: string,
  values: unknown[],
  components?: readonly AbiParameter[]
): { head: string; tail: string } {
  const lenHex = encodeUint256(BigInt(values.length))
  if (values.length === 0) {
    return { head: '', tail: lenHex }
  }

  const baseIsDynamic = isDynamic(baseType, components)

  if (!baseIsDynamic) {
    // All elements are static — encode inline after length
    let body = ''
    for (const v of values) {
      const encoded = encodeValue(baseType, v, components)
      body += encoded.head
    }
    return { head: '', tail: lenHex + body }
  }

  // Dynamic elements: use offset indirection
  return encodeDynamicElements(baseType, values, components, lenHex)
}

function encodeFixedArray(
  baseType: string,
  values: unknown[],
  components?: readonly AbiParameter[]
): { head: string; tail: string } {
  const baseIsDynamic = isDynamic(baseType, components)

  if (!baseIsDynamic) {
    // Static elements — encode inline
    let body = ''
    for (const v of values) {
      const encoded = encodeValue(baseType, v, components)
      body += encoded.head
    }
    return { head: body, tail: '' }
  }

  // Dynamic base type — the fixed array itself is dynamic
  return encodeDynamicElements(baseType, values, components, '')
}

function encodeDynamicElements(
  baseType: string,
  values: unknown[],
  components: readonly AbiParameter[] | undefined,
  prefix: string
): { head: string; tail: string } {
  const encodedValues: string[] = []
  for (const v of values) {
    const encoded = encodeValue(baseType, v, components)
    if (encoded.tail) {
      encodedValues.push(encoded.tail)
    } else {
      encodedValues.push(encoded.head)
    }
  }

  // Calculate offsets
  const headerSize = values.length * WORD
  let offsets = ''
  let body = ''
  let currentOffset = headerSize

  for (const enc of encodedValues) {
    offsets += encodeUint256(BigInt(currentOffset))
    body += enc
    currentOffset += enc.length / 2 // hex chars to bytes
  }

  return { head: '', tail: prefix + offsets + body }
}

function encodeTuple(
  components: readonly AbiParameter[],
  value: Record<string, unknown> | unknown[]
): { head: string; tail: string } {
  // Collect values in component order
  const values: unknown[] = []
  for (let i = 0; i < components.length; i++) {
    const comp = components[i]
    if (Array.isArray(value)) {
      values.push(value[i])
    } else {
      values.push((value as Record<string, unknown>)[comp.name])
    }
  }

  const tupleIsDynamic = components.some(c => isDynamic(c.type, c.components))

  if (!tupleIsDynamic) {
    // All static — encode inline
    let head = ''
    for (let i = 0; i < components.length; i++) {
      const encoded = encodeValue(
        components[i].type,
        values[i],
        components[i].components
      )
      head += encoded.head
    }
    return { head, tail: '' }
  }

  // Mixed static/dynamic — use offset indirection
  return encodeParams(components, values)
}

/**
 * Encode a parameter list using ABI encoding rules (head/tail).
 */
function encodeParams(
  params: readonly AbiParameter[],
  values: unknown[]
): { head: string; tail: string } {
  const heads: string[] = []
  const tails: string[] = []
  const isDyn: boolean[] = []

  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    const dyn = isDynamic(param.type, param.components)
    isDyn.push(dyn)
    const encoded = encodeValue(param.type, values[i], param.components)
    if (dyn) {
      heads.push('') // placeholder for offset
      tails.push(encoded.tail)
    } else {
      heads.push(encoded.head)
      tails.push('')
    }
  }

  // Calculate total head size in bytes
  const headSize = params.length * WORD

  // Build the final head with offsets filled in
  let tailOffset = headSize
  let resultHead = ''
  let resultTail = ''

  for (let i = 0; i < params.length; i++) {
    if (isDyn[i]) {
      // Calculate offset to the start of this tail data
      resultHead += encodeUint256(BigInt(tailOffset))
      const tailData = tails[i]
      resultTail += tailData
      tailOffset += tailData.length / 2 // hex chars to bytes
    } else {
      resultHead += heads[i]
    }
  }

  return { head: resultHead + resultTail, tail: '' }
}

// ────────────────────────────────────────────────────────────────────────────
// Decoding
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decode a single value from ABI-encoded data.
 * @param type Solidity type
 * @param data Hex string of the full encoded data (no 0x prefix)
 * @param offset Byte offset into data to start reading
 * @returns { value, consumed } where consumed is bytes read from the head
 */
function decodeValue(
  type: string,
  data: string,
  offset: number,
  components?: readonly AbiParameter[]
): { value: unknown; consumed: number } {
  const word = data.substring(offset * 2, offset * 2 + 64)

  if (type === 'bool') {
    return { value: BigInt('0x' + word) !== 0n, consumed: WORD }
  }

  if (type === 'address') {
    // Address is the last 20 bytes of the 32-byte word
    const addr = '0x' + word.substring(24)
    return { value: getAddress(addr), consumed: WORD }
  }

  if (type.match(/^uint\d*$/)) {
    return { value: BigInt('0x' + word || '0'), consumed: WORD }
  }

  if (type.match(/^int\d*$/)) {
    const bits = parseInt(type.replace('int', '') || '256')
    const raw = BigInt('0x' + word)
    const max = 1n << BigInt(bits)
    const half = max >> 1n
    const value = raw >= half ? raw - max : raw
    return { value, consumed: WORD }
  }

  if (type.match(/^bytes\d+$/)) {
    // Fixed bytes: return the full 32-byte word as hex
    return { value: '0x' + word, consumed: WORD }
  }

  if (type === 'bytes') {
    // Dynamic: word is offset to data
    const dataOffset = Number(BigInt('0x' + word))
    const lenWord = data.substring(dataOffset * 2, dataOffset * 2 + 64)
    const len = Number(BigInt('0x' + lenWord))
    const bytesHex = data.substring(
      dataOffset * 2 + 64,
      dataOffset * 2 + 64 + len * 2
    )
    return { value: '0x' + bytesHex, consumed: WORD }
  }

  if (type === 'string') {
    const dataOffset = Number(BigInt('0x' + word))
    const lenWord = data.substring(dataOffset * 2, dataOffset * 2 + 64)
    const len = Number(BigInt('0x' + lenWord))
    const strHex = data.substring(
      dataOffset * 2 + 64,
      dataOffset * 2 + 64 + len * 2
    )
    return { value: hexToString('0x' + strHex), consumed: WORD }
  }

  // Dynamic array: T[]
  if (type.endsWith('[]') && !type.match(/\[\d+\]$/)) {
    const baseType = type.slice(0, -2)
    const dataOffset = Number(BigInt('0x' + word))
    const lenWord = data.substring(dataOffset * 2, dataOffset * 2 + 64)
    const arrLen = Number(BigInt('0x' + lenWord))
    const values: unknown[] = []
    for (let i = 0; i < arrLen; i++) {
      const decoded = decodeValue(
        baseType,
        data.substring(dataOffset * 2 + 64),
        i * WORD,
        components
      )
      values.push(decoded.value)
    }
    return { value: values, consumed: WORD }
  }

  // Fixed array: T[N]
  const fixedMatch = type.match(/^(.+)\[(\d+)\]$/)
  if (fixedMatch) {
    const baseType = fixedMatch[1]
    const arrLen = parseInt(fixedMatch[2])
    const values: unknown[] = []
    for (let i = 0; i < arrLen; i++) {
      const decoded = decodeValue(baseType, data, offset + i * WORD, components)
      values.push(decoded.value)
    }
    return { value: values, consumed: arrLen * WORD }
  }

  // Tuple
  if (type === 'tuple' && components) {
    const tupleIsDynamic = components.some(c =>
      isDynamic(c.type, c.components)
    )
    if (tupleIsDynamic) {
      const dataOffset = Number(BigInt('0x' + word))
      const result: Record<string, unknown> = {}
      let innerOffset = 0
      for (const comp of components) {
        const decoded = decodeValue(
          comp.type,
          data.substring(dataOffset * 2),
          innerOffset,
          comp.components
        )
        result[comp.name] = decoded.value
        innerOffset += decoded.consumed
      }
      return { value: result, consumed: WORD }
    } else {
      const result: Record<string, unknown> = {}
      let innerOffset = offset
      for (const comp of components) {
        const decoded = decodeValue(
          comp.type,
          data,
          innerOffset,
          comp.components
        )
        result[comp.name] = decoded.value
        innerOffset += decoded.consumed
      }
      return { value: result, consumed: innerOffset - offset }
    }
  }

  throw new Error(`Unsupported ABI type for decoding: ${type}`)
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Find a function in the ABI by name.
 */
function findFunction(abi: Abi, name: string): AbiFunction {
  const fn = abi.find(
    (item: AbiItem) => item.type === 'function' && (item as AbiFunction).name === name
  ) as AbiFunction | undefined
  if (!fn) {
    throw new Error(`Function "${name}" not found in ABI`)
  }
  return fn
}

/**
 * Find an event in the ABI by name.
 */
function findEvent(abi: Abi, name: string): AbiEvent {
  const ev = abi.find(
    (item: AbiItem) => item.type === 'event' && (item as AbiEvent).name === name
  ) as AbiEvent | undefined
  if (!ev) {
    throw new Error(`Event "${name}" not found in ABI`)
  }
  return ev
}

/**
 * Encode a function call (selector + ABI-encoded arguments).
 * Returns a 0x-prefixed hex string.
 */
export function encodeFunctionData(
  abi: Abi,
  functionName: string,
  args: unknown[]
): string {
  const fn = findFunction(abi, functionName)
  const selector = functionSelector(fn.name, fn.inputs)

  if (fn.inputs.length === 0) {
    return selector
  }

  const { head } = encodeParams(fn.inputs, args)
  return selector + head
}

/**
 * Decode the return value of a function call.
 * Returns an array of decoded values.
 */
export function decodeFunctionResult(
  abi: Abi,
  functionName: string,
  data: string
): unknown[] {
  const fn = findFunction(abi, functionName)
  const hex = data.startsWith('0x') ? data.slice(2) : data

  const results: unknown[] = []
  let offset = 0
  for (const output of fn.outputs) {
    const decoded = decodeValue(output.type, hex, offset, output.components)
    results.push(decoded.value)
    offset += decoded.consumed
  }
  return results
}

/**
 * Compute the event topic (keccak256 hash of the event signature).
 * Returns a 0x-prefixed hex string.
 */
export function encodeEventTopic(abi: Abi, eventName: string): string {
  const ev = findEvent(abi, eventName)
  const sig = functionSignature(ev.name, ev.inputs)
  return keccak256(stringToHex(sig))
}

/**
 * Decode an event log.
 * Returns a record with named decoded values.
 */
export function decodeEventLog(
  abi: Abi,
  eventName: string,
  log: { topics: string[]; data: string }
): Record<string, unknown> {
  const ev = findEvent(abi, eventName)
  const result: Record<string, unknown> = {}

  // Indexed parameters come from topics[1..n]
  let topicIndex = 1
  // Non-indexed parameters come from data
  const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data
  let dataOffset = 0

  for (const input of ev.inputs) {
    if (input.indexed) {
      const topicHex = log.topics[topicIndex].startsWith('0x')
        ? log.topics[topicIndex].slice(2)
        : log.topics[topicIndex]
      const decoded = decodeValue(input.type, topicHex, 0, input.components)
      result[input.name] = decoded.value
      topicIndex++
    } else {
      const decoded = decodeValue(input.type, dataHex, dataOffset, input.components)
      result[input.name] = decoded.value
      dataOffset += decoded.consumed
    }
  }

  return result
}

/**
 * Compute the 4-byte function selector from the ABI.
 */
export function getFunctionSelector(abi: Abi, functionName: string): string {
  const fn = findFunction(abi, functionName)
  return functionSelector(fn.name, fn.inputs)
}

/**
 * Get the canonical function signature string.
 */
export function getFunctionSignature(abi: Abi, functionName: string): string {
  const fn = findFunction(abi, functionName)
  return functionSignature(fn.name, fn.inputs)
}
