/**
 * Compat layer: InboxTools
 *
 * Backwards-compatible class wrapper that delegates to the original
 * lib implementation.
 */
import type { Signer } from '@ethersproject/abstract-signer'
import type { ContractTransaction, Overrides } from 'ethers'
import type { TransactionRequest } from '@ethersproject/providers'

import { InboxTools as OriginalInboxTools } from '../lib/inbox/inbox'
import type { ArbitrumNetwork } from '../lib/dataEntities/networks'
import { SignerProviderUtils } from '../lib/dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../lib/dataEntities/errors'

export class InboxTools {
  private readonly original: OriginalInboxTools

  constructor(parentSigner: Signer, childChain: ArbitrumNetwork) {
    if (!SignerProviderUtils.signerHasProvider(parentSigner)) {
      throw new MissingProviderArbSdkError('parentSigner')
    }
    this.original = new OriginalInboxTools(parentSigner, childChain)
  }

  public async getForceIncludableEvent(
    maxSearchRangeBlocks?: number,
    startSearchRangeBlocks?: number,
    rangeMultiplier?: number
  ): Promise<any> {
    return this.original.getForceIncludableEvent(
      maxSearchRangeBlocks,
      startSearchRangeBlocks,
      rangeMultiplier
    )
  }

  public async forceInclude(
    messageDeliveredEvent?: any,
    overrides?: Overrides
  ): Promise<ContractTransaction | null> {
    return this.original.forceInclude(messageDeliveredEvent, overrides)
  }

  public async signChildTx(
    txRequest: Required<Pick<TransactionRequest, 'data' | 'value'>>,
    childSigner: Signer
  ): Promise<string> {
    return this.original.signChildTx(txRequest, childSigner)
  }

  public async sendChildSignedTx(
    signedTx: string
  ): Promise<ContractTransaction | null> {
    return this.original.sendChildSignedTx(signedTx)
  }
}
