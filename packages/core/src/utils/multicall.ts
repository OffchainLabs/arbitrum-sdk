/**
 * MultiCaller — batches multiple read-only contract calls into a single
 * Multicall2.tryAggregate call.
 *
 * Uses ArbitrumProvider and ArbitrumContract (no ethers/viem dependency).
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import { ArbitrumContract } from '../contracts/Contract'
import { Multicall2Abi } from '../abi/Multicall2'
import { getMulticallAddress } from '../networks'
import { encodeFunctionData, decodeFunctionResult } from '../encoding/abi'

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
