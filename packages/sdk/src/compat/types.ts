/**
 * Compat types — BigNumber versions of core types and type aliases
 * to match the old @arbitrum/sdk API surface.
 */
import { BigNumber } from 'ethers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { Signer } from '@ethersproject/abstract-signer'
import type { TransactionReceipt } from '@ethersproject/providers'

// Re-export enums from core (they are identical values)
export {
  ParentToChildMessageStatus,
  ChildToParentMessageStatus,
  EthDepositMessageStatus,
} from '@arbitrum/core'

/**
 * Union type matching the old SDK's SignerOrProvider
 */
export type SignerOrProvider = Signer | Provider

/**
 * BigNumber version of the core RetryableMessageParams.
 * Matches the old SDK's RetryableMessageParams exactly.
 */
export interface RetryableMessageParams {
  destAddress: string
  l2CallValue: BigNumber
  l1Value: BigNumber
  maxSubmissionFee: BigNumber
  excessFeeRefundAddress: string
  callValueRefundAddress: string
  gasLimit: BigNumber
  maxFeePerGas: BigNumber
  data: string
}

/**
 * If the status is redeemed, childTxReceipt is populated.
 * For all other statuses childTxReceipt is not populated.
 */
import { ParentToChildMessageStatus } from '@arbitrum/core'

export type ParentToChildMessageWaitForStatusResult =
  | {
      status: ParentToChildMessageStatus.REDEEMED
      childTxReceipt: TransactionReceipt
    }
  | {
      status: Exclude<
        ParentToChildMessageStatus,
        ParentToChildMessageStatus.REDEEMED
      >
    }

/**
 * Result of waiting for an ETH deposit message.
 */
export type EthDepositMessageWaitForStatusResult = {
  childTxReceipt: TransactionReceipt | null
}

/**
 * Signer/Provider utility functions matching the old SDK's SignerProviderUtils.
 */
export class SignerProviderUtils {
  public static isSigner(
    signerOrProvider: SignerOrProvider
  ): signerOrProvider is Signer {
    return (signerOrProvider as Signer).signMessage !== undefined
  }

  public static getProvider(
    signerOrProvider: SignerOrProvider
  ): Provider | undefined {
    return SignerProviderUtils.isSigner(signerOrProvider)
      ? signerOrProvider.provider
      : signerOrProvider
  }

  public static getProviderOrThrow(
    signerOrProvider: SignerOrProvider
  ): Provider {
    const provider = SignerProviderUtils.getProvider(signerOrProvider)
    if (!provider) throw new Error('Signer not connected to provider.')
    return provider
  }
}
