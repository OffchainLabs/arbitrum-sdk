import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'

import { L1ToL2MessageGasEstimator } from './L1ToL2MessageGasEstimator'
import { L1TransactionReceipt } from './L1Transaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { getL2Network } from '../dataEntities/networks'
import { PayableOverrides } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbTsError } from '../dataEntities/errors'
import { getBaseFee } from '../utils/lib'

/**
 * Creates retryable tickets by directly calling the Inbox contract on L1
 */
export class L1ToL2MessageCreator {
  constructor(public readonly l1Signer: Signer) {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbTsError('l1Signer')
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on L1
   */
  public async createRetryableTicket(
    l2Provider: Provider,
    l2CallTo: string,
    l2CallData: string,
    l2CallValue: BigNumber,
    options?: {
      excessFeeRefundAddress?: string
      callValueRefundAddress?: string
    },
    gasParams?: {
      maxFeePerGas: BigNumber
      maxSubmissionFee: BigNumber
      gasLimit: BigNumber
      totalL2GasCosts: BigNumber
    },
    overrides: PayableOverrides = {}
  ): Promise<L1TransactionReceipt> {
    const sender = await this.l1Signer.getAddress()
    const excessFeeRefundAddress = options?.excessFeeRefundAddress || sender
    const callValueRefundAddress = options?.callValueRefundAddress || sender
    const l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)

    const defaultedGasParams =
      gasParams ||
      (await (async () => {
        const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider)
        const baseFee = await getBaseFee(l1Provider)
        return await gasEstimator.estimateAll(
          sender,
          l2CallTo,
          l2CallData,
          l2CallValue,
          baseFee,
          excessFeeRefundAddress,
          callValueRefundAddress,
          l1Provider
        )
      })())

    const l2Network = await getL2Network(l2Provider)
    const inbox = Inbox__factory.connect(
      l2Network.ethBridge.inbox,
      this.l1Signer
    )

    const res = await inbox.createRetryableTicket(
      l2CallTo,
      l2CallValue,
      defaultedGasParams.maxSubmissionFee,
      excessFeeRefundAddress,
      callValueRefundAddress,
      defaultedGasParams.gasLimit,
      defaultedGasParams.maxFeePerGas,
      l2CallData,
      { value: defaultedGasParams.totalL2GasCosts, ...overrides }
    )
    const receipt = await res.wait()

    return new L1TransactionReceipt(receipt)
  }
}
