import { Provider } from '@ethersproject/abstract-provider'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { BytesLike, constants, utils } from 'ethers'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { ArbSdkError } from '../dataEntities/errors'
import { getChildChain } from '../dataEntities/networks'
import {
  RetryableData,
  RetryableDataTools,
} from '../dataEntities/retryableData'
import { ParentToChildTransactionRequest } from '../dataEntities/transactionRequest'
import { getBaseFee, isDefined } from '../utils/lib'
import { OmitTyped } from '../utils/types'
import {
  ParentToChildMessageGasParams,
  ParentToChildMessageNoGasParams,
} from './ParentToChildMessageCreator'

/**
 * The default amount to increase the maximum submission cost. Submission cost is calculated
 * from (call data size * some const * parent chain base fee). So we need to provide some leeway for
 * base fee increase. Since submission fee is a small amount it isn't too bas for UX to increase
 * it by a large amount, and provide better safety.
 */
const DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE = BigNumber.from(300)

/**
 * When submitting a retryable we need to estimate what the gas price for it will be when we actually come
 * to execute it. Since the l2 price can move due to congestion we should provide some padding here
 */
const DEFAULT_GAS_PRICE_PERCENT_INCREASE = BigNumber.from(500)

/**
 * An optional big number percentage increase
 */
export type PercentIncrease = {
  /**
   * If provided, will override the estimated base
   */
  base?: BigNumber

  /**
   * How much to increase the base by. If not provided system defaults may be used.
   */
  percentIncrease?: BigNumber
}

export interface GasOverrides {
  gasLimit?: PercentIncrease & {
    /**
     * Set a minimum max gas
     */
    min?: BigNumber
  }
  maxSubmissionFee?: PercentIncrease
  maxFeePerGas?: PercentIncrease
  /**
   * funds deposited along with the retryable (ie the msg.value that called the inbox)
   */
  deposit?: Pick<PercentIncrease, 'base'>
}

const defaultParentToChildMessageEstimateOptions = {
  maxSubmissionFeePercentIncrease: DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE,
  // gas limit for Parent->Child messages should be predictable. If it isn't due to the nature
  // of the specific transaction, then the caller should provide a 'min' override
  gasLimitPercentIncrease: constants.Zero,
  maxFeePerGasPercentIncrease: DEFAULT_GAS_PRICE_PERCENT_INCREASE,
}

export class ParentToChildMessageGasEstimator {
  constructor(public readonly childProvider: Provider) {}

  private percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
    return num.add(num.mul(increase).div(100))
  }

  private applySubmissionPriceDefaults(
    maxSubmissionFeeOptions?: PercentIncrease
  ) {
    return {
      base: maxSubmissionFeeOptions?.base,
      percentIncrease:
        maxSubmissionFeeOptions?.percentIncrease ||
        defaultParentToChildMessageEstimateOptions.maxSubmissionFeePercentIncrease,
    }
  }

  private applyMaxFeePerGasDefaults(maxFeePerGasOptions?: PercentIncrease) {
    return {
      base: maxFeePerGasOptions?.base,
      percentIncrease:
        maxFeePerGasOptions?.percentIncrease ||
        defaultParentToChildMessageEstimateOptions.maxFeePerGasPercentIncrease,
    }
  }

  private applyGasLimitDefaults(
    gasLimitDefaults?: PercentIncrease & { min?: BigNumber }
  ) {
    return {
      base: gasLimitDefaults?.base,
      percentIncrease:
        gasLimitDefaults?.percentIncrease ||
        defaultParentToChildMessageEstimateOptions.gasLimitPercentIncrease,
      min: gasLimitDefaults?.min || constants.Zero,
    }
  }

  /**
   * Return the fee, in wei, of submitting a new retryable tx with a given calldata size.
   * @param parentProvider
   * @param parentBaseFee
   * @param callDataSize
   * @param options
   * @returns
   */
  public async estimateSubmissionFee(
    parentProvider: Provider,
    parentBaseFee: BigNumber,
    callDataSize: BigNumber | number,
    options?: PercentIncrease
  ): Promise<ParentToChildMessageGasParams['maxSubmissionCost']> {
    const defaultedOptions = this.applySubmissionPriceDefaults(options)

    const network = await getChildChain(this.childProvider)
    const inbox = Inbox__factory.connect(
      network.ethBridge.inbox,
      parentProvider
    )

    return this.percentIncrease(
      defaultedOptions.base ||
        (await inbox.calculateRetryableSubmissionFee(
          callDataSize,
          parentBaseFee
        )),
      defaultedOptions.percentIncrease
    )
  }

  /**
   * Estimate the amount of child chain gas required for putting the transaction in the L2 inbox, and executing it.
   * @param retryableData object containing retryable ticket data
   * @param senderDeposit we dont know how much gas the transaction will use when executing
   * so by default we supply a dummy amount of call value that will definately be more than we need
   * @returns
   */
  public async estimateRetryableTicketGasLimit(
    {
      from,
      to,
      l2CallValue: l2CallValue,
      excessFeeRefundAddress,
      callValueRefundAddress,
      data,
    }: ParentToChildMessageNoGasParams,
    senderDeposit: BigNumber = utils.parseEther('1').add(l2CallValue)
  ): Promise<ParentToChildMessageGasParams['gasLimit']> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      this.childProvider
    )

    return await nodeInterface.estimateGas.estimateRetryableTicket(
      from,
      senderDeposit,
      to,
      l2CallValue,
      excessFeeRefundAddress,
      callValueRefundAddress,
      data
    )
  }

  /**
   * Provides an estimate for the child chain maxFeePerGas, adding some margin to allow for gas price variation
   * @param options
   * @returns
   */
  public async estimateMaxFeePerGas(
    options?: PercentIncrease
  ): Promise<ParentToChildMessageGasParams['maxFeePerGas']> {
    const maxFeePerGasDefaults = this.applyMaxFeePerGasDefaults(options)

    // estimate the l2 gas price
    return this.percentIncrease(
      maxFeePerGasDefaults.base || (await this.childProvider.getGasPrice()),
      maxFeePerGasDefaults.percentIncrease
    )
  }

  /**
   * Checks if the estimate is valid when compared with a new one
   * @param estimates Original estimate
   * @param reEstimates Estimate to compare against
   * @returns
   */
  public static async isValid(
    estimates: ParentToChildMessageGasParams,
    reEstimates: ParentToChildMessageGasParams
  ): Promise<boolean> {
    // L2 base fee and minimum submission cost which affect the success of the tx
    return (
      estimates.maxFeePerGas.gte(reEstimates.maxFeePerGas) &&
      estimates.maxSubmissionCost.gte(reEstimates.maxSubmissionCost)
    )
  }

  /**
   * Get gas limit, gas price and submission price estimates for sending a Parent->Child message
   * @param retryableData Data of retryable ticket transaction
   * @param parentBaseFee Current parent chain base fee
   * @param parentProvider
   * @param options
   * @returns
   */
  public async estimateAll(
    retryableEstimateData: ParentToChildMessageNoGasParams,
    parentBaseFee: BigNumber,
    parentProvider: Provider,
    options?: GasOverrides
  ): Promise<ParentToChildMessageGasParams> {
    const { data } = retryableEstimateData
    const gasLimitDefaults = this.applyGasLimitDefaults(options?.gasLimit)

    // estimate the parent chain gas price
    const maxFeePerGasPromise = this.estimateMaxFeePerGas(options?.maxFeePerGas)

    // estimate the submission fee
    const maxSubmissionFeePromise = this.estimateSubmissionFee(
      parentProvider,
      parentBaseFee,
      utils.hexDataLength(data),
      options?.maxSubmissionFee
    )

    // estimate the gas limit
    const calculatedGasLimit = this.percentIncrease(
      gasLimitDefaults.base ||
        (await this.estimateRetryableTicketGasLimit(
          retryableEstimateData,
          options?.deposit?.base
        )),
      gasLimitDefaults.percentIncrease
    )

    const [maxFeePerGas, maxSubmissionFee] = await Promise.all([
      maxFeePerGasPromise,
      maxSubmissionFeePromise,
    ])

    // always ensure the max gas is greater than the min - this can be useful if we know that
    // gas estimation is bad for the provided transaction
    const gasLimit = calculatedGasLimit.gt(gasLimitDefaults.min)
      ? calculatedGasLimit
      : gasLimitDefaults.min

    const deposit =
      options?.deposit?.base ||
      gasLimit
        .mul(maxFeePerGas)
        .add(maxSubmissionFee)
        .add(retryableEstimateData.l2CallValue)

    return {
      gasLimit,
      maxSubmissionCost: maxSubmissionFee,
      maxFeePerGas,
      deposit,
    }
  }

  /**
   * Transactions that make a Parent->Child message need to estimate L2 gas parameters
   * This function does that, and populates those parameters into a transaction request
   * @param dataFunc
   * @param parentProvider
   * @param gasOverrides
   * @returns
   */
  public async populateFunctionParams(
    /**
     * Function that will internally make a Parent->Child transaction
     * Will initially be called with dummy values to trigger a special revert containing
     * the real params. Then called again with the real params to form the final data to be submitted
     */
    dataFunc: (
      params: OmitTyped<ParentToChildMessageGasParams, 'deposit'>
    ) => ParentToChildTransactionRequest['txRequest'],
    parentProvider: Provider,
    gasOverrides?: GasOverrides
  ): Promise<{
    estimates: ParentToChildMessageGasParams
    retryable: RetryableData
    data: BytesLike
    to: string
    value: BigNumberish
  }> {
    // get function data that should trigger a retryable data error
    const {
      data: nullData,
      to,
      value,
      from,
    } = dataFunc({
      gasLimit: RetryableDataTools.ErrorTriggeringParams.gasLimit,
      maxFeePerGas: RetryableDataTools.ErrorTriggeringParams.maxFeePerGas,
      maxSubmissionCost: BigNumber.from(1),
    })

    let retryable: RetryableData | null
    try {
      // get retryable data from the null call
      const res = await parentProvider.call({
        to: to,
        data: nullData,
        value: value,
        from: from,
      })
      retryable = RetryableDataTools.tryParseError(res)
      if (!isDefined(retryable)) {
        throw new ArbSdkError(`No retryable data found in error: ${res}`)
      }
    } catch (err) {
      // ethersjs currently doesnt throw for custom solidity errors, so we shouldn't end up here
      // however we try to catch and parse the error anyway in case ethersjs changes
      // behaviour and we dont pick up on it
      retryable = RetryableDataTools.tryParseError(err as Error)
      if (!isDefined(retryable)) {
        throw new ArbSdkError('No retryable data found in error', err as Error)
      }
    }

    // use retryable data to get gas estimates
    const baseFee = await getBaseFee(parentProvider)
    const estimates = await this.estimateAll(
      {
        from: retryable.from,
        to: retryable.to,
        data: retryable.data,
        l2CallValue: retryable.l2CallValue,
        excessFeeRefundAddress: retryable.excessFeeRefundAddress,
        callValueRefundAddress: retryable.callValueRefundAddress,
      },
      baseFee,
      parentProvider,
      gasOverrides
    )

    // form the real data for the transaction
    const {
      data: realData,
      to: realTo,
      value: realValue,
    } = dataFunc({
      gasLimit: estimates.gasLimit,
      maxFeePerGas: estimates.maxFeePerGas,
      maxSubmissionCost: estimates.maxSubmissionCost,
    })

    return {
      estimates,
      retryable,
      data: realData,
      to: realTo,
      value: realValue,
    }
  }
}
