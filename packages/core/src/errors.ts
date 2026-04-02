/**
 * Errors originating in Arbitrum SDK
 */
export class ArbSdkError extends Error {
  constructor(
    message: string,
    public readonly inner?: Error
  ) {
    super(message)

    if (inner) {
      this.stack += '\nCaused By: ' + inner.stack
    }
  }
}

/**
 * Thrown when a provider is missing where one is required.
 */
export class MissingProviderArbSdkError extends ArbSdkError {
  constructor(contextName: string) {
    super(
      `${contextName} does not have a connected provider and one is required.`
    )
  }
}

/**
 * Thrown when a contract call (eth_call) fails.
 * Wraps adapter-specific errors into a consistent type that core can handle.
 */
export class ContractCallError extends ArbSdkError {
  /** True if the error is a call exception (revert, out of gas, etc.) */
  public readonly isCallException: boolean
  /** The revert data returned by the contract, if available */
  public readonly revertData?: string

  constructor(
    message: string,
    options: { isCallException: boolean; revertData?: string; inner?: Error }
  ) {
    super(message, options.inner)
    this.isCallException = options.isCallException
    this.revertData = options.revertData
  }
}
