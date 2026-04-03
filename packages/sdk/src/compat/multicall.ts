/**
 * MultiCaller compat stub.
 * Wraps a provider and multicall address to batch contract reads.
 */
import type { Provider } from '@ethersproject/abstract-provider'

export class MultiCaller {
  public readonly address: string

  constructor(
    public readonly provider: Provider,
    address: string
  ) {
    this.address = address
  }

  public static async fromProvider(
    _provider: Provider
  ): Promise<MultiCaller> {
    throw new Error('Not implemented')
  }

  public async multiCall(
    ..._args: any[]
  ): Promise<any[]> {
    throw new Error('Not implemented')
  }

  public getBlockNumberInput(): any {
    return {}
  }

  public getCurrentBlockTimestampInput(): any {
    return {}
  }

  public async getTokenData(
    ..._args: any[]
  ): Promise<any> {
    throw new Error('Not implemented')
  }
}
