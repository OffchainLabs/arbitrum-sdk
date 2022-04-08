import { Provider } from '@ethersproject/abstract-provider'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { ArbRetryableTx__factory } from '../abi/factories/ArbRetryableTx__factory'

import {
  ARB_RETRYABLE_TX_ADDRESS,
  NODE_INTERFACE_ADDRESS,
} from '../dataEntities/constants'
import { BigNumber } from '@ethersproject/bignumber'
import { constants } from 'ethers'
import { utils } from 'ethers'
import { Interface } from 'ethers/lib/utils'

const DEFAULT_SUBMISSION_PRICE_PERCENT_INCREASE = BigNumber.from(340)

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
  maxGas?: PercentIncrease & {
    /**
     * Set a minimum max gas
     */
    min?: BigNumber
  }
  maxSubmissionPrice?: PercentIncrease
  maxGasPrice?: PercentIncrease
}

const defaultL1ToL2MessageEstimateOptions = {
  // CHRIS: TODO: reasses these defaults, shoud we still be using them?
  maxSubmissionFeePercentIncrease: DEFAULT_SUBMISSION_PRICE_PERCENT_INCREASE, //  CHRIS: TODO: 340% seems high
  maxGasPercentIncrease: constants.Zero, // CHRIS: TODO: back to zero after bug fixed
  maxGasPricePercentIncrease: constants.Zero, // CHRIS: TODO: I think we want to increase this
}

export interface L1toL2MessageGasValues {
  maxGasPriceBid: BigNumber
  maxSubmissionPriceBid: BigNumber
  maxGasBid: BigNumber

  totalL2GasCosts: BigNumber
  l2CallValue: BigNumber
}

export class L1ToL2MessageGasEstimator {
  constructor(public readonly l2Provider: Provider) {}

  private percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
    return num.add(num.mul(increase).div(100))
  }

  private applySubmissionPriceDefaults(maxSubmissionPrice?: PercentIncrease) {
    return {
      base: maxSubmissionPrice?.base,
      percentIncrease:
        maxSubmissionPrice?.percentIncrease ||
        defaultL1ToL2MessageEstimateOptions.maxSubmissionFeePercentIncrease,
    }
  }

  /**
   * Return the price, in wei, of submitting a new retryable tx with a given calldata size.
   * @param callDataSize
   * @param options
   * @returns
   */
  public async estimateSubmissionPrice(
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
   * @param maxSubmissionCost
   * @param excessFeeRefundAddress
   * @param callValueRefundAddress
   * @param maxGas
   * @param gasPriceBid
   * @param calldata
   * @returns
   */
  public async estimateRetryableTicketMaxGas(
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

    // CHRIS: TODO: put this back - use the new abis
    const iface = new Interface([
      'function estimateRetryableTicket(address sender,uint256 deposit,address to,uint256 l2CallValue,address excessFeeRefundAddress,address callValueRefundAddress,bytes calldata data)',
    ])

    return await this.l2Provider.estimateGas({
      to: NODE_INTERFACE_ADDRESS,
      data: iface.encodeFunctionData('estimateRetryableTicket', [
        sender,
        senderDeposit,
        destAddr,
        l2CallValue,
        excessFeeRefundAddress,
        callValueRefundAddress,
        calldata,
      ]),
    })
  }

  private applyDefaults(options?: GasOverrides) {
    return {
      maxGas: {
        base: options?.maxGas?.base,
        percentIncrease:
          options?.maxGas?.percentIncrease ||
          defaultL1ToL2MessageEstimateOptions.maxGasPercentIncrease,
        min: options?.maxGas?.min || constants.Zero,
      },
      maxGasPrice: {
        base: options?.maxGasPrice?.base,
        percentIncrease:
          options?.maxGasPrice?.percentIncrease ||
          defaultL1ToL2MessageEstimateOptions.maxGasPricePercentIncrease,
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
    maxGasBid: BigNumber
    maxSubmissionPriceBid: BigNumber
    maxGasPriceBid: BigNumber
    totalL2GasCosts: BigNumber
  }> {
    const defaultedOptions = this.applyDefaults(options)

    const maxGasPriceBid = this.percentIncrease(
      defaultedOptions.maxGasPrice.base ||
        (await this.l2Provider.getGasPrice()),
      defaultedOptions.maxGasPrice.percentIncrease
    )

    const maxSubmissionPriceBid = await this.estimateSubmissionPrice(
      // CHRIS: TODO: we defo want base fee here right?
      l1BaseFee,
      utils.hexDataLength(l2CallDataHex),
      options?.maxSubmissionPrice
    )

    const calculatedMaxGas = this.percentIncrease(
      defaultedOptions.maxGas.base ||
        (await this.estimateRetryableTicketMaxGas(
          sender,
          utils.parseEther('1').add(
            l2CallValue // CHRIS: TODO: get to the bottom of this, do we actually need it?
          ) /** we add a 1 ether "deposit" buffer to pay for execution in the gas estimation  */,
          destAddr,
          l2CallValue,
          excessFeeRefundAddress,
          callValueRefundAddress,
          l2CallDataHex
        )),
      defaultedOptions.maxGas.percentIncrease
    )

    // always ensure the max gas is greater than the min
    const maxGas = calculatedMaxGas.gt(defaultedOptions.maxGas.min)
      ? calculatedMaxGas
      : defaultedOptions.maxGas.min

    let totalL2GasCosts = maxSubmissionPriceBid.add(
      maxGasPriceBid.mul(maxGas)
    )

    return {
      maxGasBid: maxGas,
      maxSubmissionPriceBid,
      maxGasPriceBid,
      totalL2GasCosts,
    }
  }
}
