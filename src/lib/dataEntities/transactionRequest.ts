import { TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from 'ethers'

/**
 * A transaction request for a transaction that will trigger some sort of
 * execution on the L2
 */
export interface L1ToL2TransactionRequest extends TransactionRequest {
  /**
   * The gas limit provided to this transactin when executed on L2 (units of gas)
   */
  l2GasLimit: BigNumber
  /**
   * The max fee per gas that will be paid on L2 (wei per gas)
   */
  l2MaxFeePerGas: BigNumber
  /**
   * The L2 retryable ticket submission cost (wei)
   */
  l2SubmissionFee: BigNumber
  /**
   * The maximum total amount of eth that could be spent on L2 (wei)
   */
  l2GasCostsMaxTotal: BigNumber
}
