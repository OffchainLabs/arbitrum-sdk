import { constants } from 'ethers'
import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'
import { BigNumber } from '@ethersproject/bignumber'
import { hexDataLength } from '@ethersproject/bytes'

import {
  DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE,
  GasOverrides,
  ParentToChildMessageGasEstimator,
} from './ParentToChildMessageGasEstimator'
import {
  ParentContractTransaction,
  ParentTransactionReceipt,
} from './ParentTransaction'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import {
  getArbitrumNetwork,
  isArbitrumNetworkNativeTokenEther,
} from '../dataEntities/networks'
import { ERC20Inbox__factory } from '../abi/factories/ERC20Inbox__factory'
import { PayableOverrides } from '@ethersproject/contracts'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { ArbSdkError, MissingProviderArbSdkError } from '../dataEntities/errors'
import { getBaseFee } from '../utils/lib'
import {
  isParentToChildTransactionRequest,
  ParentToChildTransactionRequest,
} from '../dataEntities/transactionRequest'
import { RetryableData } from '../dataEntities/retryableData'
import { OmitTyped, PartialPick } from '../utils/types'

type ParentToChildGasKeys =
  | 'maxSubmissionCost'
  | 'maxFeePerGas'
  | 'gasLimit'
  | 'deposit'
export type ParentToChildMessageGasParams = Pick<
  RetryableData,
  ParentToChildGasKeys
>
export type ParentToChildMessageNoGasParams = OmitTyped<
  RetryableData,
  ParentToChildGasKeys
>
export type ParentToChildMessageParams = PartialPick<
  ParentToChildMessageNoGasParams,
  'excessFeeRefundAddress' | 'callValueRefundAddress'
>

/**
 * Parameters for {@link ParentToChildMessageCreator.encodeRetryableTicket}
 */
export type EncodeRetryableTicketParams = {
  /** Destination address on the child chain */
  to: string
  /** Value (in the child chain native token) to call the target with */
  l2CallValue: BigNumber
  /** Calldata to call the target with */
  data: string
  /** Address to refund the excess submission and gas fee to */
  excessFeeRefundAddress: string
  /** Address to refund the call value to if the retryable fails */
  callValueRefundAddress: string
  /** Child chain gas limit for the retryable's execution */
  gasLimit: BigNumber
  /** Max fee per gas for the retryable's execution */
  maxFeePerGas: BigNumber
  /** Whether the child chain native token is ETH; changes the Inbox calldata */
  nativeTokenIsEth: boolean
  /**
   * Max submission cost. If omitted, it is read from the Inbox on the parent
   * chain, which requires `parentProvider` and `inbox` to be supplied.
   */
  maxSubmissionCost?: BigNumber
  /**
   * Total deposit. If omitted, it is derived as
   * `gasLimit * maxFeePerGas + maxSubmissionCost + l2CallValue`.
   */
  deposit?: BigNumber
  /**
   * Parent chain provider. Required only when `maxSubmissionCost` is not
   * supplied, to read it from the Inbox.
   */
  parentProvider?: Provider
  /**
   * Inbox address on the parent chain. Required only when `maxSubmissionCost`
   * is not supplied.
   */
  inbox?: string
  /** Parent chain base fee. Read from `parentProvider` when omitted. */
  parentBaseFee?: BigNumber
  /**
   * Percent increase applied to the raw submission fee when it is derived from
   * the Inbox, mirroring the gas estimator's safety margin so the baked-in cost
   * survives a parent base-fee rise before inclusion. Defaults to
   * {@link DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE}. Ignored when
   * `maxSubmissionCost` is supplied directly. On chains with a custom fee token
   * the Inbox returns a submission fee of 0, so `maxSubmissionCost` resolves to
   * 0 regardless of this value.
   */
  submissionFeePercentIncrease?: BigNumber
}

/**
 * Result of {@link ParentToChildMessageCreator.encodeRetryableTicket}
 */
export type EncodeRetryableTicketResult = {
  /** ABI-encoded `createRetryableTicket` calldata for the Inbox */
  data: string
  /** Total value that must be deposited with the ticket */
  deposit: BigNumber
  /** The resolved max submission cost used in the encoding */
  maxSubmissionCost: BigNumber
}

/**
 * Creates retryable tickets by directly calling the Inbox contract on Parent chain
 */
export class ParentToChildMessageCreator {
  constructor(public readonly parentSigner: Signer) {
    if (!SignerProviderUtils.signerHasProvider(parentSigner)) {
      throw new MissingProviderArbSdkError('parentSigner')
    }
  }

  /**
   * Gets a current estimate for the supplied params
   * @param params
   * @param parentProvider
   * @param childProvider
   * @param retryableGasOverrides
   * @returns
   */
  protected static async getTicketEstimate(
    params: ParentToChildMessageNoGasParams,
    parentProvider: Provider,
    childProvider: Provider,
    retryableGasOverrides?: GasOverrides
  ): Promise<Pick<RetryableData, ParentToChildGasKeys>> {
    const baseFee = await getBaseFee(parentProvider)

    const gasEstimator = new ParentToChildMessageGasEstimator(childProvider)
    return await gasEstimator.estimateAll(
      params,
      baseFee,
      parentProvider,
      retryableGasOverrides
    )
  }

  /**
   * Prepare calldata for a call to create a retryable ticket
   * @param params
   * @param estimates
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param nativeTokenIsEth
   * @returns
   */
  protected static getTicketCreationRequestCallData(
    params: Pick<RetryableData, 'to' | 'l2CallValue' | 'data'>,
    estimates: Pick<RetryableData, ParentToChildGasKeys>,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    nativeTokenIsEth: boolean
  ) {
    if (!nativeTokenIsEth) {
      return ERC20Inbox__factory.createInterface().encodeFunctionData(
        'createRetryableTicket',
        [
          params.to,
          params.l2CallValue,
          estimates.maxSubmissionCost,
          excessFeeRefundAddress,
          callValueRefundAddress,
          estimates.gasLimit,
          estimates.maxFeePerGas,
          estimates.deposit, // tokenTotalFeeAmount
          params.data,
        ]
      )
    }

    return Inbox__factory.createInterface().encodeFunctionData(
      'createRetryableTicket',
      [
        params.to,
        params.l2CallValue,
        estimates.maxSubmissionCost,
        excessFeeRefundAddress,
        callValueRefundAddress,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        params.data,
      ]
    )
  }

  /**
   * Encode the calldata (and compute the fee math) for creating a retryable
   * ticket, without estimating gas against the child chain.
   *
   * Unlike {@link getTicketCreationRequest} this takes the child chain gas
   * parameters (`gasLimit`, `maxFeePerGas`) directly, so it can be used before
   * the child chain is running - for example when transferring ownership during
   * an Orbit chain deployment, where gas params are hardcoded. A parent chain is
   * only needed when `maxSubmissionCost` is not supplied.
   *
   * @param params when `maxSubmissionCost` is omitted, `parentProvider` and
   * `inbox` must be supplied so it can be read (and padded) from the Inbox
   * @returns the encoded Inbox calldata, the required deposit and the resolved
   * max submission cost
   */
  public static async encodeRetryableTicket(
    params: EncodeRetryableTicketParams
  ): Promise<EncodeRetryableTicketResult> {
    let { maxSubmissionCost } = params
    if (typeof maxSubmissionCost === 'undefined') {
      if (!params.parentProvider || !params.inbox) {
        throw new ArbSdkError(
          'Either params.maxSubmissionCost, or params.parentProvider and params.inbox (to read it from the Inbox), must be provided.'
        )
      }
      const parentBaseFee =
        params.parentBaseFee ?? (await getBaseFee(params.parentProvider))
      const inbox = Inbox__factory.connect(params.inbox, params.parentProvider)
      const rawSubmissionFee = await inbox.calculateRetryableSubmissionFee(
        hexDataLength(params.data),
        parentBaseFee
      )
      // Pad the raw submission fee the same way the gas estimator does, so the
      // baked-in cost survives a parent base-fee rise before the ticket is
      // included; otherwise the Inbox reverts with InsufficientSubmissionCost.
      const submissionFeePercentIncrease =
        params.submissionFeePercentIncrease ??
        DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE
      maxSubmissionCost = rawSubmissionFee.add(
        rawSubmissionFee.mul(submissionFeePercentIncrease).div(100)
      )
    }

    const deposit =
      params.deposit ??
      params.gasLimit
        .mul(params.maxFeePerGas)
        .add(maxSubmissionCost)
        .add(params.l2CallValue)

    const data = ParentToChildMessageCreator.getTicketCreationRequestCallData(
      params,
      {
        maxSubmissionCost,
        gasLimit: params.gasLimit,
        maxFeePerGas: params.maxFeePerGas,
        deposit,
      },
      params.excessFeeRefundAddress,
      params.callValueRefundAddress,
      params.nativeTokenIsEth
    )

    return { data, deposit, maxSubmissionCost }
  }

  /**
   * Generate a transaction request for creating a retryable ticket
   * @param params
   * @param parentProvider
   * @param childProvider
   * @param options
   * @returns
   */
  public static async getTicketCreationRequest(
    params: ParentToChildMessageParams,
    parentProvider: Provider,
    childProvider: Provider,
    options?: GasOverrides
  ): Promise<ParentToChildTransactionRequest> {
    const excessFeeRefundAddress = params.excessFeeRefundAddress || params.from
    const callValueRefundAddress = params.callValueRefundAddress || params.from

    const parsedParams: ParentToChildMessageNoGasParams = {
      ...params,
      excessFeeRefundAddress,
      callValueRefundAddress,
    }

    const estimates = await ParentToChildMessageCreator.getTicketEstimate(
      parsedParams,
      parentProvider,
      childProvider,
      options
    )

    const childChain = await getArbitrumNetwork(childProvider)
    const nativeTokenIsEth = isArbitrumNetworkNativeTokenEther(childChain)

    const { data, deposit } =
      await ParentToChildMessageCreator.encodeRetryableTicket({
        to: params.to,
        l2CallValue: params.l2CallValue,
        data: params.data,
        excessFeeRefundAddress,
        callValueRefundAddress,
        gasLimit: estimates.gasLimit,
        maxFeePerGas: estimates.maxFeePerGas,
        maxSubmissionCost: estimates.maxSubmissionCost,
        deposit: estimates.deposit,
        nativeTokenIsEth,
      })

    return {
      txRequest: {
        to: childChain.ethBridge.inbox,
        data,
        value: nativeTokenIsEth ? deposit : constants.Zero,
        from: params.from,
      },
      retryableData: {
        data: params.data,
        from: params.from,
        to: params.to,
        excessFeeRefundAddress: excessFeeRefundAddress,
        callValueRefundAddress: callValueRefundAddress,
        l2CallValue: params.l2CallValue,
        maxSubmissionCost: estimates.maxSubmissionCost,
        maxFeePerGas: estimates.maxFeePerGas,
        gasLimit: estimates.gasLimit,
        deposit: estimates.deposit,
      },
      isValid: async () => {
        const reEstimates = await ParentToChildMessageCreator.getTicketEstimate(
          parsedParams,
          parentProvider,
          childProvider,
          options
        )
        return ParentToChildMessageGasEstimator.isValid(estimates, reEstimates)
      },
    }
  }

  /**
   * Creates a retryable ticket by directly calling the Inbox contract on Parent chain
   */
  public async createRetryableTicket(
    params:
      | (ParentToChildMessageParams & { overrides?: PayableOverrides })
      | (ParentToChildTransactionRequest & {
          overrides?: PayableOverrides
        }),
    childProvider: Provider,
    options?: GasOverrides
  ): Promise<ParentContractTransaction> {
    const parentProvider = SignerProviderUtils.getProviderOrThrow(
      this.parentSigner
    )
    const createRequest = isParentToChildTransactionRequest(params)
      ? params
      : await ParentToChildMessageCreator.getTicketCreationRequest(
          params,
          parentProvider,
          childProvider,
          options
        )

    const tx = await this.parentSigner.sendTransaction({
      ...createRequest.txRequest,
      ...params.overrides,
    })

    return ParentTransactionReceipt.monkeyPatchWait(tx)
  }
}
