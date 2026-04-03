/**
 * ParentToChildMessageCreator compat stub.
 * Wraps a parent signer to create retryable tickets.
 */
import type { Signer } from '@ethersproject/abstract-signer'

export class ParentToChildMessageCreator {
  public readonly parentSigner: Signer

  constructor(parentSigner: Signer) {
    if (!parentSigner.provider) {
      throw new Error('Signer not connected to provider.')
    }
    this.parentSigner = parentSigner
  }

  public static async getTicketCreationRequest(
    ..._args: any[]
  ): Promise<any> {
    throw new Error('Not implemented')
  }

  public async createRetryableTicket(
    ..._args: any[]
  ): Promise<any> {
    throw new Error('Not implemented')
  }
}
