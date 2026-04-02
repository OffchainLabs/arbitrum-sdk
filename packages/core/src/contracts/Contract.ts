/**
 * ArbitrumContract<TAbi> — A provider-agnostic contract wrapper.
 *
 * Replaces ethers Contract + typechain factories with a single generic class.
 * Uses abitype for type-level inference on the ABI.
 *
 * Methods:
 * - encodeFunctionData(name, args) → hex calldata
 * - encodeWrite(name, args, opts?) → TransactionRequestData
 * - read(name, args, opts?) → decoded result array
 * - parseEventLogs(name, logs) → parsed events
 * - getEventTopic(name) → topic hash
 * - connect(provider) → new Contract with provider
 * - at(address) → new Contract with different address
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type {
  TransactionRequestData,
  BlockTag,
  ArbitrumLog,
} from '../interfaces/types'
import {
  encodeFunctionData,
  decodeFunctionResult,
  encodeEventTopic,
  decodeEventLog,
} from '../encoding/abi'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Abi = readonly any[]

export interface ParsedEventLog {
  /** Decoded event arguments as a named record */
  args: Record<string, unknown>
  /** Event name */
  name: string
  /** Event topic (keccak256 of event signature) */
  topic: string
  /** Block number where this log was emitted */
  blockNumber: number
  /** Block hash */
  blockHash: string
  /** Transaction hash */
  transactionHash: string
  /** Emitting contract address */
  address: string
  /** Raw topics */
  topics: string[]
  /** Raw data */
  data: string
}

export interface WriteOptions {
  /** Native token value to send (wei) */
  value?: bigint
  /** Sender address */
  from?: string
}

export interface ReadOptions {
  /** Block tag for the call */
  blockTag?: BlockTag
}

export class ArbitrumContract<TAbi extends Abi = Abi> {
  public readonly abi: TAbi
  public readonly address: string
  private readonly provider?: ArbitrumProvider

  constructor(abi: TAbi, address: string, provider?: ArbitrumProvider) {
    this.abi = abi
    this.address = address
    this.provider = provider
  }

  /**
   * Encode a function call to produce ABI-encoded calldata.
   * Does not require a provider.
   */
  encodeFunctionData(functionName: string, args: unknown[]): string {
    return encodeFunctionData(this.abi, functionName, args)
  }

  /**
   * Encode a write (state-changing) function call as a TransactionRequestData.
   * Does not require a provider. Users send this with their own signer/wallet.
   */
  encodeWrite(
    functionName: string,
    args: unknown[],
    options?: WriteOptions
  ): TransactionRequestData {
    const data = this.encodeFunctionData(functionName, args)
    return {
      to: this.address,
      data,
      value: options?.value ?? 0n,
      from: options?.from,
    }
  }

  /**
   * Execute a read-only call and decode the result.
   * Requires a provider (set via constructor or connect()).
   */
  async read(
    functionName: string,
    args: unknown[],
    options?: ReadOptions
  ): Promise<unknown[]> {
    if (!this.provider) {
      throw new Error(
        'ArbitrumContract.read() requires a provider. Use connect() first.'
      )
    }

    const data = this.encodeFunctionData(functionName, args)
    const callRequest: { to: string; data: string; blockTag?: BlockTag } = {
      to: this.address,
      data,
    }
    if (options?.blockTag !== undefined) {
      callRequest.blockTag = options.blockTag
    }

    const result = await this.provider.call(callRequest)
    return decodeFunctionResult(this.abi, functionName, result)
  }

  /**
   * Parse an array of raw logs, filtering for a specific event and decoding matches.
   * Filters out removed logs and logs whose topic[0] doesn't match.
   */
  parseEventLogs(eventName: string, logs: ArbitrumLog[]): ParsedEventLog[] {
    const topic = this.getEventTopic(eventName)

    return logs
      .filter(log => !log.removed && log.topics[0] === topic)
      .map(log => {
        const args = decodeEventLog(this.abi, eventName, {
          topics: log.topics,
          data: log.data,
        })
        return {
          args,
          name: eventName,
          topic,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          address: log.address,
          topics: log.topics,
          data: log.data,
        }
      })
  }

  /**
   * Get the keccak256 topic hash for an event.
   */
  getEventTopic(eventName: string): string {
    return encodeEventTopic(this.abi, eventName)
  }

  /**
   * Return a new Contract instance connected to a provider.
   * Does not mutate the current instance.
   */
  connect(provider: ArbitrumProvider): ArbitrumContract<TAbi> {
    return new ArbitrumContract(this.abi, this.address, provider)
  }

  /**
   * Return a new Contract instance with a different address.
   * Preserves the ABI and provider.
   */
  at(address: string): ArbitrumContract<TAbi> {
    return new ArbitrumContract(this.abi, address, this.provider)
  }
}
