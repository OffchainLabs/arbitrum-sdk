import { Provider } from '@ethersproject/abstract-provider'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { constants } from 'ethers'
import { utils } from 'ethers'

const DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE = BigNumber.from(340)

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
  // CHRIS: TODO: reasses these defaults, shoud we still be using them?
  maxSubmissionFeePercentIncrease: DEFAULT_SUBMISSION_FEE_PERCENT_INCREASE, //  CHRIS: TODO: 340% seems high
  gasLimitPercentIncrease: constants.Zero, // CHRIS: TODO: back to zero after bug fixed
  maxFeePerGasPercentIncrease: constants.Zero, // CHRIS: TODO: I think we want to increase this
}

export interface L1toL2MessageGasValues {
  maxFeePerGas: BigNumber
  maxSubmissionFee: BigNumber
  gasLimit: BigNumber

  totalL2GasCosts: BigNumber
  l2CallValue: BigNumber
}

export class L1ToL2MessageGasEstimator {
  constructor(public readonly l2Provider: Provider) {}

  private percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
    return num.add(num.mul(increase).div(100))
  }

  private applySubmissionPriceDefaults(maxSubmissionFee?: PercentIncrease) {
    return {
      base: maxSubmissionFee?.base,
      percentIncrease:
        maxSubmissionFee?.percentIncrease ||
        defaultL1ToL2MessageEstimateOptions.maxSubmissionFeePercentIncrease,
    }
  }

  /**
   * Return the fee, in wei, of submitting a new retryable tx with a given calldata size.
   * @param callDataSize
   * @param options
   * @returns
   */
  public async estimateSubmissionFee(
    l1BaseFee: BigNumber,
    callDataSize: BigNumber | number,
    options?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
  ): Promise<BigNumber> {
    const defaultedOptions = this.applySubmissionPriceDefaults(options)
    const submissionCost = BigNumber.from(callDataSize)
      .mul(6)
      .add(1400)
      .mul(l1BaseFee)

    const costWithPadding = this.percentIncrease(
      defaultedOptions.base || submissionCost,
      defaultedOptions.percentIncrease
    )
    return costWithPadding
  }

  /**
   * Estimate the amount of L2 gas required for putting the transaction in the L2 inbox, and executing it.
   * @param sender
   * @param senderDeposit
   * @param destAddr
   * @param l2CallValue
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param calldata
   * @returns
   */
  public async estimateRetryableTicketGasLimit(
    sender: string,
    senderDeposit: BigNumber,
    destAddr: string,
    l2CallValue: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    calldata: string
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

  private applyDefaults(options?: GasOverrides) {
    return {
      gasLimit: {
        base: options?.gasLimit?.base,
        percentIncrease:
          options?.gasLimit?.percentIncrease ||
          defaultL1ToL2MessageEstimateOptions.gasLimitPercentIncrease,
        min: options?.gasLimit?.min || constants.Zero,
      },
      maxFeePerGas: {
        base: options?.maxFeePerGas?.base,
        percentIncrease:
          options?.maxFeePerGas?.percentIncrease ||
          defaultL1ToL2MessageEstimateOptions.maxFeePerGasPercentIncrease,
      },
    }
  }

  // CHRIS: TODO: in general this class is a bit messy, maybe we should pass in the percentage increases when we instantiate

  /**
   * Get gas limit, gas price and submission price estimates for sending an L2 message
   * @param sender Sender of the L1 to L2 transaction
   * @param destAddr Destination L2 contract address
   * @param l2CallDataHex The call data to be sent in the request
   * @param l2CallValue The value to be sent on L2 as part of the L2 transaction
   * @param l1BaseFee Current l1 base fee
   * @param excessFeeRefundAddress The address to send excess fee refunds too
   * @param callValueRefundAddress The address to send the call value
   * @param options
   * @returns
   */
  public async estimateMessage(
    sender: string,
    destAddr: string,
    l2CallDataHex: string,
    l2CallValue: BigNumber,
    l1BaseFee: BigNumber,
    excessFeeRefundAddress: string,
    callValueRefundAddress: string,
    options?: GasOverrides
  ): Promise<{
    gasLimit: BigNumber
    maxSubmissionFee: BigNumber
    maxFeePerGas: BigNumber
    totalL2GasCosts: BigNumber
  }> {
    const defaultedOptions = this.applyDefaults(options)

    const maxFeePerGas = this.percentIncrease(
      defaultedOptions.maxFeePerGas.base || (await this.l2Provider.getGasPrice()),
      defaultedOptions.maxFeePerGas.percentIncrease
    )

    const maxSubmissionFee = await this.estimateSubmissionFee(
      // CHRIS: TODO: we defo want base fee here right?
      l1BaseFee,
      utils.hexDataLength(l2CallDataHex),
      options?.maxSubmissionFee
    )

    const calculatedGasLimit = this.percentIncrease(
      defaultedOptions.gasLimit.base ||
        (await this.estimateRetryableTicketGasLimit(
          sender,
          // we dont know how much gas the transaction will use when executing
          // so we supply a dummy amount of call value that will definately be more than we need
          utils.parseEther('1').add(l2CallValue),
          destAddr,
          l2CallValue,
          excessFeeRefundAddress,
          callValueRefundAddress,
          l2CallDataHex
        )),
      defaultedOptions.gasLimit.percentIncrease
    )

    // always ensure the max gas is greater than the min
    const gasLimit = calculatedGasLimit.gt(defaultedOptions.gasLimit.min)
      ? calculatedGasLimit
      : defaultedOptions.gasLimit.min

    let totalL2GasCosts = maxSubmissionFee.add(maxFeePerGas.mul(gasLimit))

    return {
      gasLimit,
      maxSubmissionFee,
      maxFeePerGas: maxFeePerGas,
      totalL2GasCosts,
    }
  }
}
