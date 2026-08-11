/**
 * MultiCaller — batches multiple read-only contract calls into a single
 * Multicall2.tryAggregate call.
 *
 * Uses ArbitrumProvider and ArbitrumContract (no ethers/viem dependency).
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import { ArbitrumContract } from '../contracts/Contract'
import { Multicall2Abi } from '../abi/Multicall2'
import { ERC20Abi } from '../abi/ERC20'
import { getMulticallAddress } from '../networks'
import { encodeFunctionData, decodeFunctionResult } from '../encoding/abi'
import { isHexString, hexDataLength } from '../encoding/hex'

/**
 * Token metadata returned by getTokenData.
 */
export interface TokenData {
  /** Token name (undefined if the call failed) */
  name?: string
  /** Token symbol (undefined if the call failed) */
  symbol?: string
  /** Token decimals (undefined if the call failed) */
  decimals?: number
}

/**
 * Input to the multicall aggregator.
 */
export interface CallInput<T> {
  /** Address of the target contract to be called */
  targetAddr: string
  /** Function to produce encoded call data */
  encoder: () => string
  /** Function to decode the result of the call */
  decoder: (returnData: string) => T
}

/**
 * For each item in T this DecoderReturnType<T> yields the return
 * type of the decoder property.
 * If we require success then the result cannot be undefined.
 */
type DecoderReturnType<
  T extends CallInput<unknown>[],
  TRequireSuccess extends boolean,
> = {
  [P in keyof T]: T[P] extends CallInput<unknown>
    ? TRequireSuccess extends true
      ? ReturnType<T[P]['decoder']>
      : ReturnType<T[P]['decoder']> | undefined
    : never
}

/**
 * Util for executing multi calls against the Multicall2 contract.
 */
export class MultiCaller {
  private readonly contract: ArbitrumContract<typeof Multicall2Abi>

  constructor(
    private readonly provider: ArbitrumProvider,
    /** Address of the multicall contract */
    public readonly address: string
  ) {
    this.contract = new ArbitrumContract(Multicall2Abi, address, provider)
  }

  /**
   * Finds the correct multicall address for the given provider and
   * instantiates a MultiCaller.
   */
  public static async fromProvider(
    provider: ArbitrumProvider
  ): Promise<MultiCaller> {
    const chainId = await provider.getChainId()
    const address = getMulticallAddress(chainId)
    return new MultiCaller(provider, address)
  }

  /**
   * Get the call input for the current block number.
   */
  public getBlockNumberInput(): CallInput<bigint> {
    return {
      targetAddr: this.address,
      encoder: () => encodeFunctionData(Multicall2Abi, 'getBlockNumber', []),
      decoder: (returnData: string) =>
        decodeFunctionResult(Multicall2Abi, 'getBlockNumber', returnData)[0] as bigint,
    }
  }

  /**
   * Get the call input for the current block timestamp.
   */
  public getCurrentBlockTimestampInput(): CallInput<bigint> {
    return {
      targetAddr: this.address,
      encoder: () =>
        encodeFunctionData(Multicall2Abi, 'getCurrentBlockTimestamp', []),
      decoder: (returnData: string) =>
        decodeFunctionResult(
          Multicall2Abi,
          'getCurrentBlockTimestamp',
          returnData
        )[0] as bigint,
    }
  }

  /**
   * Batch-read token metadata (name, symbol, decimals) for multiple ERC-20 addresses.
   *
   * Handles tokens that return bytes32 for name/symbol (e.g. Maker MKR)
   * by parsing the bytes32 as UTF-8 and stripping null bytes.
   *
   * @param tokenAddresses - Array of ERC-20 token addresses to query
   * @returns Array of token data objects with name, symbol, and decimals
   */
  public async getTokenData(
    tokenAddresses: string[]
  ): Promise<TokenData[]> {
    const isBytes32Data = (data: string) =>
      isHexString(data) && hexDataLength(data) === 32

    /**
     * Parse a bytes32 value as a UTF-8 string, stripping null bytes.
     */
    const parseBytes32String = (hex: string): string => {
      const clean = hex.startsWith('0x') ? hex.slice(2) : hex
      // Take only the first 64 hex chars (32 bytes)
      const bytes32 = clean.slice(0, 64)
      let str = ''
      for (let i = 0; i < bytes32.length; i += 2) {
        const byte = parseInt(bytes32.slice(i, i + 2), 16)
        if (byte === 0) break
        str += String.fromCharCode(byte)
      }
      return str
    }

    const input: CallInput<unknown>[] = []

    for (const addr of tokenAddresses) {
      // name
      input.push({
        targetAddr: addr,
        encoder: () => encodeFunctionData(ERC20Abi, 'name', []),
        decoder: (returnData: string) => {
          if (isBytes32Data(returnData)) {
            return parseBytes32String(returnData)
          }
          return decodeFunctionResult(ERC20Abi, 'name', returnData)[0] as string
        },
      })

      // symbol
      input.push({
        targetAddr: addr,
        encoder: () => encodeFunctionData(ERC20Abi, 'symbol', []),
        decoder: (returnData: string) => {
          if (isBytes32Data(returnData)) {
            return parseBytes32String(returnData)
          }
          return decodeFunctionResult(ERC20Abi, 'symbol', returnData)[0] as string
        },
      })

      // decimals
      input.push({
        targetAddr: addr,
        encoder: () => encodeFunctionData(ERC20Abi, 'decimals', []),
        decoder: (returnData: string) =>
          Number(
            decodeFunctionResult(ERC20Abi, 'decimals', returnData)[0] as bigint
          ),
      })
    }

    const results = await this.multiCall(input)

    const tokens: TokenData[] = []
    let i = 0
    for (const _addr of tokenAddresses) {
      tokens.push({
        name: results[i++] as string | undefined,
        symbol: results[i++] as string | undefined,
        decimals: results[i++] as number | undefined,
      })
    }

    return tokens
  }

  /**
   * Executes a multicall for the given parameters.
   * Return values are ordered the same as the inputs.
   * If a call failed, undefined is returned instead of the value.
   *
   * @param params - Array of call inputs
   * @param requireSuccess - Fail the whole call if any internal call fails
   * @returns Array of decoded return values
   */
  public async multiCall<
    T extends CallInput<unknown>[],
    TRequireSuccess extends boolean,
  >(
    params: T,
    requireSuccess?: TRequireSuccess
  ): Promise<DecoderReturnType<T, TRequireSuccess>> {
    const defaultedRequireSuccess = requireSuccess ?? false

    // Build the args for tryAggregate: (bool requireSuccess, Call[] calls)
    const calls = params.map(p => ({
      target: p.targetAddr,
      callData: p.encoder(),
    }))

    // Encode the tryAggregate call
    const calldata = encodeFunctionData(Multicall2Abi, 'tryAggregate', [
      defaultedRequireSuccess,
      calls,
    ])

    // Execute the call via provider
    const result = await this.provider.call({
      to: this.address,
      data: calldata,
    })

    // Decode the outer result: returns Result[] = (bool success, bytes returnData)[]
    const decoded = decodeFunctionResult(
      Multicall2Abi,
      'tryAggregate',
      result
    )
    const outputs = decoded[0] as Array<{
      success: boolean
      returnData: string
    }>

    return outputs.map(({ success, returnData }, index) => {
      if (success && returnData && returnData !== '0x') {
        return params[index].decoder(returnData)
      }
      return undefined
    }) as DecoderReturnType<T, TRequireSuccess>
  }
}
