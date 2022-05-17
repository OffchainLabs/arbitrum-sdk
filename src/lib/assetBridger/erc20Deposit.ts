import { defaultAbiCoder } from '@ethersproject/abi'
import { Overrides } from '@ethersproject/contracts'
import { BigNumber } from '@ethersproject/bignumber'
import { Signer } from '@ethersproject/abstract-signer'
import { L2Network } from '../dataEntities/networks'
import { Provider } from '@ethersproject/abstract-provider'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import {
  L1ContractCallTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'

export interface Erc20DepositFunctionArgs {
  /**
   * The L1 address of the ERC20 token
   */
  erc20L1Address: string
  /**
   * The amount of tokens to deposit from L1 to L2
   */
  amount: BigNumber
  /**
   * Amount of Eth to send with this deposit
   */
  depositCallValue: BigNumber
  /**
   * The maximum submission fee to pay. All L1->L2 messages are submitted as retryable transactions
   * so that they can be retried if the transaction fails. The submission fee pays to keep the retryable
   * transaction available for one expiry period. See L1ToL2Message for more information.
   */
  maxSubmissionFee: BigNumber
  /**
   * The max amount of L2 gas to use
   */
  l2GasLimit: BigNumber
  /**
   * The max fee per gas to pay for L2 gas
   */
  l2MaxFeePerGas: BigNumber
  /**
   * The account that will receive these tokens on L2
   */
  destinationAddress: string
  /**
   * The signer that will send the deposit transaction
   */
  l1Signer: Signer
  /**
   * The l2 network to make the deposit to
   */
  l2Network: L2Network
}

/**
 * A deposit of tokens from L1 to L2
 */
export class Erc20Deposit implements Erc20DepositFunctionArgs {
  public readonly erc20L1Address: string
  public readonly amount: BigNumber
  public readonly depositCallValue: BigNumber
  public readonly maxSubmissionFee: BigNumber
  public readonly l2GasLimit: BigNumber
  public readonly l2MaxFeePerGas: BigNumber
  public readonly destinationAddress: string

  public readonly l1Signer: Signer
  public readonly l2Network: L2Network

  private readonly data: string
  private readonly l1Provider: Provider

  public constructor(iFunctionArgs: Erc20DepositFunctionArgs) {
    this.erc20L1Address = iFunctionArgs.erc20L1Address
    this.amount = iFunctionArgs.amount
    this.depositCallValue = iFunctionArgs.depositCallValue
    this.maxSubmissionFee = iFunctionArgs.maxSubmissionFee
    this.data = defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [iFunctionArgs.maxSubmissionFee, '0x']
    )
    this.l2GasLimit = iFunctionArgs.l2GasLimit
    this.l2MaxFeePerGas = iFunctionArgs.l2MaxFeePerGas
    this.destinationAddress = iFunctionArgs.destinationAddress
    this.l1Signer = iFunctionArgs.l1Signer
    this.l2Network = iFunctionArgs.l2Network

    // ensure the signer has a provider
    this.l1Provider = SignerProviderUtils.getProviderOrThrow(this.l1Signer)
  }

  /**
   * The max amount of gas spent on L2 operations
   * MaxSubmissionCost + ( l2GasLimit * l2MaxFeePerGas )
   * @returns
   */
  public l2GasCostMax() {
    return this.maxSubmissionFee.add(this.l2GasLimit.mul(this.l2MaxFeePerGas))
  }

  /**
   * The max amount of gas spent on L1 operations
   * ( l1GasLimit * l1GasPrice )
   * @returns
   */
  public async l1GasCostMax(overrides?: Overrides) {
    const l1GasEstimate = await this.l1EstimateGas(overrides)
    const l1GasPrice = await this.l1Provider.getGasPrice()

    return l1GasEstimate.mul(l1GasPrice)
  }

  /**
   * Format this token deposit as transaction data
   * @returns
   */
  public toTxData() {
    const l1GatewayRouterInterface = L1GatewayRouter__factory.createInterface()

    const functionData = l1GatewayRouterInterface.encodeFunctionData(
      'outboundTransfer',
      [
        this.erc20L1Address,
        this.destinationAddress,
        this.amount,
        this.l2GasLimit,
        this.l2MaxFeePerGas,
        this.data,
      ]
    )

    return {
      to: this.l2Network.tokenBridge.l1GatewayRouter,
      data: functionData,
      value: this.depositCallValue,
    }
  }

  /**
   * Estimate the L1 gas limit for this token deposit
   * @returns
   */
  public async l1EstimateGas(overrides?: Overrides) {
    const txData = this.toTxData()
    return await this.l1Provider.estimateGas({ ...txData, ...overrides })
  }

  /**
   * Execute this token deposit by sending an L1 transaction
   * @returns
   */
  public async send(overrides?: Overrides): Promise<L1ContractCallTransaction> {
    const txData = this.toTxData()

    const tx = await this.l1Signer.sendTransaction({ ...txData, ...overrides })
    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }
}
