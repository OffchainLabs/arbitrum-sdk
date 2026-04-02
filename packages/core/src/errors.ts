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
