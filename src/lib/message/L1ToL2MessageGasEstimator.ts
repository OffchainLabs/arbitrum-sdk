import { Provider } from '@ethersproject/abstract-provider'
import { BigNumber } from '@ethersproject/bignumber'
import { utils } from 'ethers'

import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  convertEstimates,
  convertGasOverrides,
  isNitroL2,
} from '../utils/migration_types'

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

export class L1ToL2MessageGasEstimator {
  private readonly classicEstimator: classic.L1ToL2MessageGasEstimator
  private readonly nitroEstimator: nitro.L1ToL2MessageGasEstimator

  constructor(public readonly l2Provider: Provider) {
    this.classicEstimator = new classic.L1ToL2MessageGasEstimator(l2Provider)
    this.nitroEstimator = new nitro.L1ToL2MessageGasEstimator(l2Provider)
  }

  /**
   * Return the fee, in wei, of submitting a new retryable tx with a given calldata size.
   * @param callDataSize
   * @param options
   * @returns
   */
  public async estimateSubmissionFee(
    l1Provider: Provider,
    l1BaseFee: BigNumber,
    callDataSize: BigNumber | number,
    options?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
  ): Promise<BigNumber> {
    return (await isNitroL2(this.l2Provider))
      ? await this.nitroEstimator.estimateSubmissionFee(
          l1Provider,
          l1BaseFee,
          callDataSize,
          options
        )
      : (
          await this.classicEstimator.estimateSubmissionPrice(
            callDataSize,
            options
          )
        ).submissionPrice
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
    senderDeposit: BigNumber = utils.parseEther('1').add(l2CallValue),
    maxSubmissionCost: BigNumber,
    maxGas: BigNumber,
    gasPriceBid: BigNumber
  ): Promise<BigNumber> {
    return (await isNitroL2(this.l2Provider))
      ? this.nitroEstimator.estimateRetryableTicketGasLimit(
          sender,
          destAddr,
          l2CallValue,
          excessFeeRefundAddress,
          callValueRefundAddress,
          calldata
        )
      : this.classicEstimator.estimateRetryableTicketMaxGas(
          sender,
          senderDeposit,
          destAddr,
          l2CallValue,
          maxSubmissionCost,
          excessFeeRefundAddress,
          callValueRefundAddress,
          maxGas,
          gasPriceBid,
          calldata
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
   * @param l1Provider L1 provider
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
    options?: GasOverrides & { sendL2CallValueFromL1?: boolean }
  ): Promise<{
    gasLimit: BigNumber
    maxSubmissionFee: BigNumber
    maxFeePerGas: BigNumber
    totalL2GasCosts: BigNumber
  }> {
    return (await isNitroL2(this.l2Provider))
      ? await this.nitroEstimator.estimateAll(
          sender,
          l2CallTo,
          l2CallData,
          l2CallValue,
          l1BaseFee,
          excessFeeRefundAddress,
          callValueRefundAddress,
          l1Provider,
          options
        )
      : convertEstimates(
          await this.classicEstimator.estimateMessage(
            sender,
            l2CallTo,
            l2CallData,
            l2CallValue,
            {
              ...convertGasOverrides(options),
              sendL2CallValueFromL1: options?.sendL2CallValueFromL1,
            }
          )
        )
  }
}
