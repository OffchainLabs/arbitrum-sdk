import { Provider } from '@ethersproject/abstract-provider'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { constants } from 'ethers'
import { utils } from 'ethers'
import { getL2Network } from '../dataEntities/networks'

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
  ): Promise<BigNumber> {
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
   * @param sender
   * @param destAddr
   * @param l2CallValue
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param calldata
   * @param senderDeposit we dont know how much gas the transaction will use when executing
   * so by default we supply a dummy amount of call value that will definately be more than we need
   * @returns
   */
  public async estimateRetryableTicketGasLimit(
    sender: string,
    destAddr: string,
    l2CallValue: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    calldata: string,
    senderDeposit: BigNumber = utils.parseEther('1').add(l2CallValue)
  ): Promise<BigNumber> {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      this.l2Provider
    )

    return await nodeInterface.estimateGas.estimateRetryableTicket(
      sender,
      senderDeposit,
      destAddr,
      l2CallValue,
      excessFeeRefundAddress,
      callValueRefundAddress,
      calldata
    )
  }

  /**
   * Provides an estimate for the L2 maxFeePerGas, adding some margin to allow for gas price variation
   * @param options
   * @returns
   */
  public async estimateMaxFeePerGas(options?: PercentIncrease) {
    const maxFeePerGasDefaults = this.applyMaxFeePerGasDefaults(options)

    // estimate the l2 gas price
    return this.percentIncrease(
      maxFeePerGasDefaults.base || (await this.l2Provider.getGasPrice()),
      maxFeePerGasDefaults.percentIncrease
    )
  }

  /**
   * Get gas limit, gas price and submission price estimates for sending an L1->L2 message
   * @param sender Sender of the L1 to L2 transaction
   * @param l2CallTo Destination L2 contract address
   * @param l2CallData The hex call data to be sent in the request
   * @param l2CallValue The value to be sent on L2 as part of the L2 transaction
   * @param l1BaseFee Current l1 base fee
   * @param excessFeeRefundAddress The address to send excess fee refunds too
   * @param callValueRefundAddress The address to send the call value
   * @param options
   * @returns
   */
  public async estimateAll(
    sender: string,
    l2CallTo: string,
    l2CallData: string,
    l2CallValue: BigNumber,
    l1BaseFee: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    l1Provider: Provider,
    options?: GasOverrides
  ): Promise<{
    gasLimit: BigNumber
    maxSubmissionFee: BigNumber
    maxFeePerGas: BigNumber
    totalL2GasCosts: BigNumber
  }> {
    const gasLimitDefaults = this.applyGasLimitDefaults(options?.gasLimit)

    // estimate the l1 gas price
    const maxFeePerGas = await this.estimateMaxFeePerGas(options?.maxFeePerGas)

    // estimate the submission fee
    const maxSubmissionFee = await this.estimateSubmissionFee(
      l1Provider,
      l1BaseFee,
      utils.hexDataLength(l2CallData),
      options?.maxSubmissionFee
    )

    // estimate the gas limit
    const calculatedGasLimit = this.percentIncrease(
      gasLimitDefaults.base ||
        (await this.estimateRetryableTicketGasLimit(
          sender,
          l2CallTo,
          l2CallValue,
          excessFeeRefundAddress,
          callValueRefundAddress,
          l2CallData
        )),
      gasLimitDefaults.percentIncrease
    )

    // always ensure the max gas is greater than the min - this can be useful if we know that
    // gas estimation is bad for the provided transaction
    const gasLimit = calculatedGasLimit.gt(gasLimitDefaults.min)
      ? calculatedGasLimit
      : gasLimitDefaults.min

    // estimate the total l2 gas costs
    const totalL2GasCosts = maxSubmissionFee.add(maxFeePerGas.mul(gasLimit))

    return {
      gasLimit,
      maxSubmissionFee,
      maxFeePerGas: maxFeePerGas,
      totalL2GasCosts,
    }
  }
}
