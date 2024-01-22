import { Provider } from '@ethersproject/abstract-provider'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { BytesLike, constants, utils } from 'ethers'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { ArbSdkError } from '../dataEntities/errors'
import { getL2Network } from '../dataEntities/networks'
import {
  RetryableData,
  RetryableDataTools,
} from '../dataEntities/retryableData'
import { L1ToL2TransactionRequest } from '../dataEntities/transactionRequest'
import { getBaseFee, isDefined } from '../utils/lib'
import { OmitTyped } from '../utils/types'
import {
  L1ToL2MessageGasParams,
  L1ToL2MessageNoGasParams,
} from './L1ToL2MessageCreator'

/**
 * The default amount to increase the maximum submission cost. Submission cost is calculated
 * from (call data size * some const * l1 base fee). So we need to provide some leeway for
 * base fee increase. Since submission fee is a small amount it isn't too bas for UX to increase
 * it by a large amount, and provide better safety.
 */
const DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE = BigNumber.from(300)

/**
 * When submitting a retryable we need to estimate what the gas price for it will be when we actually come
 * to execute it. Since the l2 price can move due to congestion we should provide some padding here
 */
const DEFAULT_GAS_PRICE_PERCENT_INCREASE = BigNumber.from(200)

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

const defaultL1ToL2MessageEstimateOptions = {
  maxSubmissionFeePercentIncrease: DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE,
  // gas limit for l1->l2 messages should be predictable. If it isn't due to the nature
  // of the specific transaction, then the caller should provide a 'min' override
  gasLimitPercentIncrease: constants.Zero,
  maxFeePerGasPercentIncrease: DEFAULT_GAS_PRICE_PERCENT_INCREASE,
}

export class L1ToL2MessageGasEstimator {
  constructor(public readonly l2Provider: Provider) {}

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
        defaultL1ToL2MessageEstimateOptions.maxSubmissionFeePercentIncrease,
    }
  }

  private applyMaxFeePerGasDefaults(maxFeePerGasOptions?: PercentIncrease) {
    return {
      base: maxFeePerGasOptions?.base,
      percentIncrease:
        maxFeePerGasOptions?.percentIncrease ||
        defaultL1ToL2MessageEstimateOptions.maxFeePerGasPercentIncrease,
    }
  }

  private applyGasLimitDefaults(
    gasLimitDefaults?: PercentIncrease & { min?: BigNumber }
  ) {
    return {
      base: gasLimitDefaults?.base,
      percentIncrease:
        gasLimitDefaults?.percentIncrease ||
        defaultL1ToL2MessageEstimateOptions.gasLimitPercentIncrease,
      min: gasLimitDefaults?.min || constants.Zero,
    }
  }

  /**
   * Return the fee, in wei, of submitting a new retryable tx with a given calldata size.
   * @param l1Provider
   * @param l1BaseFee
   * @param callDataSize
   * @param options
   * @returns
   */
  public async estimateSubmissionFee(
    l1Provider: Provider,
    l1BaseFee: BigNumber,
    callDataSize: BigNumber | number,
    options?: PercentIncrease
  ): Promise<L1ToL2MessageGasParams['maxSubmissionCost']> {
    const defaultedOptions = this.applySubmissionPriceDefaults(options)

    const network = await getL2Network(this.l2Provider)
    const inbox = Inbox__factory.connect(network.ethBridge.inbox, l1Provider)

    return this.percentIncrease(
      defaultedOptions.base ||
        (await inbox.calculateRetryableSubmissionFee(callDataSize, l1BaseFee)),
      defaultedOptions.percentIncrease
    )
  }

  /**
   * Estimate the amount of L2 gas required for putting the transaction in the L2 inbox, and executing it.
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
    }: L1ToL2MessageNoGasParams,
    senderDeposit: BigNumber = utils.parseEther('1').add(l2CallValue)
  ): Promise<L1ToL2MessageGasParams['gasLimit']> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      this.l2Provider
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
   * Provides an estimate for the L2 maxFeePerGas, adding some margin to allow for gas price variation
   * @param options
   * @returns
   */
  public async estimateMaxFeePerGas(
    options?: PercentIncrease
  ): Promise<L1ToL2MessageGasParams['maxFeePerGas']> {
    const maxFeePerGasDefaults = this.applyMaxFeePerGasDefaults(options)

    // estimate the l2 gas price
    return this.percentIncrease(
      maxFeePerGasDefaults.base || (await this.l2Provider.getGasPrice()),
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
    estimates: L1ToL2MessageGasParams,
    reEstimates: L1ToL2MessageGasParams
  ): Promise<boolean> {
    // L2 base fee and minimum submission cost which affect the success of the tx
    return (
      estimates.maxFeePerGas.gte(reEstimates.maxFeePerGas) &&
      estimates.maxSubmissionCost.gte(reEstimates.maxSubmissionCost)
    )
  }

  /**
   * Get gas limit, gas price and submission price estimates for sending an L1->L2 message
   * @param retryableData Data of retryable ticket transaction
   * @param l1BaseFee Current l1 base fee
   * @param l1Provider
   * @param options
   * @returns
   */
  public async estimateAll(
    retryableEstimateData: L1ToL2MessageNoGasParams,
    l1BaseFee: BigNumber,
    l1Provider: Provider,
    options?: GasOverrides
  ): Promise<L1ToL2MessageGasParams> {
    const { data } = retryableEstimateData
    const gasLimitDefaults = this.applyGasLimitDefaults(options?.gasLimit)

    // estimate the l1 gas price
    const maxFeePerGasPromise = this.estimateMaxFeePerGas(options?.maxFeePerGas)

    // estimate the submission fee
    const maxSubmissionFeePromise = this.estimateSubmissionFee(
      l1Provider,
      l1BaseFee,
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
   * Transactions that make an L1->L2 message need to estimate L2 gas parameters
   * This function does that, and populates those parameters into a transaction request
   * @param dataFunc
   * @param l1Provider
   * @param gasOverrides
   * @returns
   */
  public async populateFunctionParams(
    /**
     * Function that will internally make an L1->L2 transaction
     * Will initially be called with dummy values to trigger a special revert containing
     * the real params. Then called again with the real params to form the final data to be submitted
     */
    dataFunc: (
      params: OmitTyped<L1ToL2MessageGasParams, 'deposit'>
    ) => L1ToL2TransactionRequest['txRequest'],
    l1Provider: Provider,
    gasOverrides?: GasOverrides
  ): Promise<{
    estimates: L1ToL2MessageGasParams
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
      const res = await l1Provider.call({
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
    // const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider)
    const baseFee = await getBaseFee(l1Provider)
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
      l1Provider,
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
