import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  BigNumber,
  BigNumberish,
  Overrides,
  PayableOverrides,
  Signer,
  ethers,
} from 'ethers'
import { IERC20 } from '../abi/IERC20'
import { BridgedToL3Event, L2ForwarderPredictor } from '../abi/L2Forwarder'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { L1Teleporter } from '../abi/L1Teleporter'
import { IERC20__factory } from '../abi/factories/IERC20__factory'
import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { L2ForwarderFactory__factory } from '../abi/factories/L2ForwarderFactory__factory'
import { L2Forwarder__factory } from '../abi/factories/L2Forwarder__factory'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { L1Teleporter__factory } from '../abi/factories/L1Teleporter__factory'
import { Address } from '../dataEntities/address'
import { ArbSdkError } from '../dataEntities/errors'
import {
  L1Network,
  L2Network,
  TeleporterAddresses,
  l1Networks,
  l2Networks,
} from '../dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'
import {
  L1ToL2TransactionRequest,
  isL1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'
import {
  L1ToL2Message,
  L1ToL2MessageReader,
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from '../message/L1ToL2Message'
import { L1ToL2MessageCreator } from '../message/L1ToL2MessageCreator'
import {
  GasOverrides,
  L1ToL2MessageGasEstimator,
  PercentIncrease,
} from '../message/L1ToL2MessageGasEstimator'
import {
  L1ContractCallTransaction,
  L1ContractCallTransactionReceipt,
  L1EthDepositTransaction,
  L1EthDepositTransactionReceipt,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { ApproveParamsOrTxRequest, Erc20Bridger } from './erc20Bridger'
import { L2ForwarderPredictor__factory } from '../abi/factories/L2ForwarderPredictor__factory'
import { AbiCoder } from 'ethers/lib/utils'
import {
  ADDRESS_ALIAS_OFFSET,
  NODE_INTERFACE_ADDRESS,
} from '../dataEntities/constants'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'
import { isDefined } from '../utils/lib'
import { L1ArbitrumGateway__factory } from '../abi/factories/L1ArbitrumGateway__factory'

type PickedTransactionRequest = Required<
  Pick<TransactionRequest, 'to' | 'data' | 'value'>
>

export type TxRequestParams = {
  txRequest: PickedTransactionRequest
  l1Signer: Signer
  overrides?: PayableOverrides
}

export type TeleporterRetryableGasOverride = {
  gasLimit?: PercentIncrease & {
    /**
     * Set a minimum max gas
     */
    min?: BigNumber
  }
  maxSubmissionFee?: PercentIncrease
}

export type TokenApproveParams = {
  /**
   * L1 address of the ERC20 token contract
   */
  erc20L1Address: string
  /**
   * Amount to approve. Defaults to max int.
   */
  amount?: BigNumber
}

export type Erc20DepositRequestParams = {
  /**
   * Address of L1 token
   */
  erc20L1Address: string
  /**
   * Amount of L1 token to send to L3
   */
  amount: BigNumber
  /**
   * L2 provider
   */
  l2Provider: Provider
  /**
   * L3 provider
   */
  l3Provider: Provider
  /**
   * Optional recipient on L3, defaults to signer's address
   */
  to?: string
  /**
   * Optional overrides for retryable gas parameters
   */
  retryableOverrides?: {
    /**
     * Optional L1 gas price override. Used to estimate submission fees.
     */
    l1GasPrice?: PercentIncrease
    /**
     * Optional L2 gas price override
     */
    l2GasPrice?: PercentIncrease
    /**
     * Optional L3 gas price override
     */
    l3GasPrice?: PercentIncrease
    /**
     * L2ForwarderFactory retryable gas override
     */
    l2ForwarderFactoryRetryableGas?: TeleporterRetryableGasOverride
    /**
     * L1 to L2 fee token bridge retryable gas override
     */
    l1l2FeeTokenBridgeRetryableGas?: TeleporterRetryableGasOverride
    /**
     * L1 to L2 token bridge retryable gas override
     */
    l1l2TokenBridgeRetryableGas?: TeleporterRetryableGasOverride
    /**
     * L2 to L3 token bridge retryable gas override
     */
    l2l3TokenBridgeRetryableGas?: TeleporterRetryableGasOverride
  }
}

export type Erc20DepositMessagesParams = {
  l1TransactionReceipt: L1ContractCallTransactionReceipt
  l2Provider: JsonRpcProvider
  l3Provider: Provider
}

export type Erc20DepositMessages = {
  /**
   * L1 to L2 token bridge message
   */
  l1l2TokenBridge: L1ToL2MessageReader
  /**
   * L1 to L2 fee token bridge message
   */
  l1l2FeeTokenBridge?: L1ToL2MessageReader
  /**
   * L2ForwarderFactory message
   */
  l2ForwarderFactory: L1ToL2MessageReader
  /**
   * L2 to L3 token bridge message
   */
  l2l3TokenBridge?: L1ToL2MessageReader
  /**
   * Whether the teleportation has completed
   */
  completed: boolean
}

export type EthDepositRequestParams = {
  /**
   * Amount of ETH to send to L3
   */
  amount: BigNumberish
  /**
   * Optional recipient on L3, defaults to signer's address
   */
  to?: string
  /**
   * Optional fee refund address on L2, defaults to signer's address
   */
  l2RefundAddress?: string
  /**
   * Optional gas overrides for L1 to L2 message
   */
  l2TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
  /**
   * Optional gas overrides for L2 to L3 message
   */
  l3TicketGasOverrides?: Omit<GasOverrides, 'deposit'>
}

export type EthDepositStatus = {
  /**
   * Status + redemption tx receipt of the retryable ticket to L2
   */
  l2Retryable: L1ToL2MessageWaitResult
  /**
   * Status + redemption tx receipt of the retryable ticket to L3
   */
  l3Retryable: L1ToL2MessageWaitResult
  /**
   * Whether the teleportation has completed
   */
  completed: boolean
}

/**
 * Base functionality for L1 to L3 bridging.
 */
class BaseL1L3Bridger {
  public readonly l1Network: L1Network
  public readonly l2Network: L2Network
  public readonly l3Network: L2Network

  public readonly defaultGasPricePercentIncrease: BigNumber =
    BigNumber.from(200)

  constructor(l3Network: L2Network) {
    const l2Network = l2Networks[l3Network.partnerChainID]
    if (!l2Network) {
      throw new ArbSdkError(
        `Unknown l2 network chain id: ${l3Network.partnerChainID}`
      )
    }

    const l1Network = l1Networks[l2Network.partnerChainID]
    if (!l1Network) {
      throw new ArbSdkError(
        `Unknown l1 network chain id: ${l2Network.partnerChainID}`
      )
    }

    this.l1Network = l1Network
    this.l2Network = l2Network
    this.l3Network = l3Network
  }

  /**
   * Check the signer/provider matches the l1Network, throws if not
   * @param sop
   */
  protected async _checkL1Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l1Network.chainID)
  }

  /**
   * Check the signer/provider matches the l2Network, throws if not
   * @param sop
   */
  protected async _checkL2Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l2Network.chainID)
  }

  /**
   * Check the signer/provider matches the l3Network, throws if not
   * @param sop
   */
  protected async _checkL3Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l3Network.chainID)
  }

  protected _percentIncrease(num: BigNumber, increase: BigNumber): BigNumber {
    return num.add(num.mul(increase).div(100))
  }
}

/**
 * Ensure the T is not of TxRequestParams type by ensure it doesnt have a specific TxRequestParams property
 */
type IsNotTxRequestParams<T> = T extends TxRequestParams ? never : T

type DoesNotHaveL1Signer<T> = T extends { l1Signer: Signer } ? never : T

const hasL1Signer = <T>(
  x: DoesNotHaveL1Signer<T> | { l1Signer: Signer }
): x is { l1Signer: Signer } => {
  return isDefined((x as { l1Signer: Signer }).l1Signer)
}

/**
 * Check if an object is of TxRequestParams type
 * @param possibleRequest
 * @returns
 */
const isTxRequestParams = <T>(
  possibleRequest: IsNotTxRequestParams<T> | TxRequestParams
): possibleRequest is TxRequestParams => {
  const req = possibleRequest as TxRequestParams
  return isDefined(req.txRequest) && isDefined(req.l1Signer)
}

export class Erc20L1L3Bridger extends BaseL1L3Bridger {
  public readonly teleporterAddresses: TeleporterAddresses

  protected readonly l2Erc20Bridger = new Erc20Bridger(this.l2Network)
  protected readonly l3Erc20Bridger = new Erc20Bridger(this.l3Network)

  public constructor(public readonly l3Network: L2Network) {
    super(l3Network)

    if (!this.l2Network.teleporterAddresses) {
      throw new ArbSdkError(
        `L2 network ${this.l2Network.name} does not have teleporter contracts`
      )
    }

    this.teleporterAddresses = this.l2Network.teleporterAddresses
  }

  /**
   * Get the corresponding L2 token address for the provided L1 token
   */
  public getL2ERC20Address(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    return this.l2Erc20Bridger.getL2ERC20Address(erc20L1Address, l1Provider)
  }

  /**
   * Get the corresponding L3 token address for the provided L1 token
   */
  public async getL3ERC20Address(
    erc20L1Address: string,
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<string> {
    return this.l3Erc20Bridger.getL2ERC20Address(
      await this.getL2ERC20Address(erc20L1Address, l1Provider),
      l2Provider
    )
  }

  /**
   * Given an L1 token's address, get the address of the token's L1 <-> L2 gateway on L1
   */
  public getL1L2GatewayAddress(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    return this.l2Erc20Bridger.getL1GatewayAddress(erc20L1Address, l1Provider)
  }

  /**
   * Get the address of the L2 <-> L3 gateway on L2 given an L1 token address
   */
  public async getL2L3GatewayAddress(
    erc20L1Address: string,
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<string> {
    const l2Token = await this.getL2ERC20Address(erc20L1Address, l1Provider)
    return this.l3Erc20Bridger.getL1GatewayAddress(l2Token, l2Provider)
  }

  /**
   * Get the L1 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesn't
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   */
  public getL1TokenContract(l1TokenAddr: string, l1Provider: Provider): IERC20 {
    return IERC20__factory.connect(l1TokenAddr, l1Provider)
  }

  /**
   * Get the L2 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesn't
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   */
  public getL2TokenContract(
    l2TokenAddr: string,
    l2Provider: Provider
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(l2TokenAddr, l2Provider)
  }

  /**
   * Get the L3 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesn't
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   */
  public getL3TokenContract(
    l3TokenAddr: string,
    l3Provider: Provider
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(l3TokenAddr, l3Provider)
  }

  /**
   * Whether the L1 token has been disabled on the router given an L1 token address
   */
  public async l1TokenIsDisabled(
    l1TokenAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    return this.l2Erc20Bridger.l1TokenIsDisabled(l1TokenAddress, l1Provider)
  }

  /**
   * Whether the L2 token has been disabled on the router given an L2 token address
   */
  public async l2TokenIsDisabled(
    l2TokenAddress: string,
    l2Provider: Provider
  ): Promise<boolean> {
    return this.l3Erc20Bridger.l1TokenIsDisabled(l2TokenAddress, l2Provider)
  }

  /**
   * todo fix comment
   * Given L2Forwarder parameters, get the address of the L2Forwarder contract
   */
  public async l2ForwarderAddress(
    l2ForwarderOwner: string,
    l2Provider: Provider
  ): Promise<string> {
    await this._checkL2Network(l2Provider)

    return L2ForwarderFactory__factory.connect(
      this.teleporterAddresses.l2ForwarderFactory,
      l2Provider
    ).l2ForwarderAddress(l2ForwarderOwner)
  }

  public async getApproveTokenRequest(
    params: TokenApproveParams
  ): Promise<PickedTransactionRequest> {
    const iface = IERC20__factory.createInterface()
    const data = iface.encodeFunctionData('approve', [
      this.teleporterAddresses.l1Teleporter,
      params.amount || ethers.constants.MaxUint256,
    ])
    return {
      to: params.erc20L1Address,
      data,
      value: 0,
    }
  }

  public async approveToken(
    params:
      | (TokenApproveParams & { l1Signer: Signer; overrides?: Overrides })
      | TxRequestParams
  ): Promise<ethers.ContractTransaction> {
    const approveRequest = isTxRequestParams(params)
      ? params.txRequest
      : await this.getApproveTokenRequest(params)

    return params.l1Signer.sendTransaction({
      ...approveRequest,
      ...params.overrides,
    })
  }

  public async getDepositRequest(
    params: Erc20DepositRequestParams &
      (
        | {
            from: string
            l1Provider: Provider
          }
        | { l1Signer: Signer }
      )
  ): Promise<PickedTransactionRequest> {
    const l1Provider = hasL1Signer(params)
      ? params.l1Signer.provider!
      : params.l1Provider
    this._checkL1Network(l1Provider)
    this._checkL2Network(params.l2Provider)
    this._checkL3Network(params.l3Provider)

    const gasParams = await this._buildGasParams(params, l1Provider)

    const from = hasL1Signer(params)
      ? await params.l1Signer.getAddress()
      : params.from
    const teleportParams: L1Teleporter.TeleportParamsStruct = {
      l1Token: params.erc20L1Address,
      l1FeeToken: ethers.constants.AddressZero,
      l1l2Router: this.l2Network.tokenBridge.l1GatewayRouter,
      l2l3RouterOrInbox: this.l3Network.tokenBridge.l1GatewayRouter,
      to: params.to || from,
      amount: params.amount,
      gasParams,
    }

    const l1GasPrice = this._percentIncrease(
      params.retryableOverrides?.l1GasPrice?.base ||
        (await l1Provider.getGasPrice()),
      params.retryableOverrides?.l1GasPrice?.percentIncrease ||
        this.defaultGasPricePercentIncrease
    )

    const valueRequired = (
      await L1Teleporter__factory.connect(
        this.teleporterAddresses.l1Teleporter,
        l1Provider
      ).determineTypeAndFees(teleportParams, l1GasPrice)
    ).ethAmount

    const data = L1Teleporter__factory.createInterface().encodeFunctionData('teleport', [teleportParams])

    return {
      to: this.teleporterAddresses.l1Teleporter,
      data,
      value: valueRequired,
    }
  }

  private async _buildGasParams(
    params: Erc20DepositRequestParams,
    l1Provider: Provider
  ): Promise<L1Teleporter.RetryableGasParamsStruct> {
    return {
      l2GasPrice: ethers.utils.parseUnits('0.2', 'gwei'),
      l3GasPrice: ethers.utils.parseUnits('0.2', 'gwei'),
      l1l2TokenBridgeGasLimit: BigNumber.from(1_000_000),
      l1l2FeeTokenBridgeGasLimit: BigNumber.from(1_000_000),
      l2l3TokenBridgeGasLimit: BigNumber.from(1_000_000),
      l2ForwarderFactoryGasLimit: BigNumber.from(1_000_000),
      l1l2TokenBridgeSubmissionCost: ethers.utils.parseEther('0.01'),
      l1l2FeeTokenBridgeSubmissionCost: ethers.utils.parseEther('0.01'),
      l2l3TokenBridgeSubmissionCost: ethers.utils.parseEther('0.01'),
    }

    // work backwards
    // first estimate the gas for the l2l3 token bridge
    // then estimate the gas for the l1l2 token bridge
    // we have to hardcode the forwarder sadly

    // l2l3 token bridge
    // const gasEstimator = new L1ToL2MessageGasEstimator(params.l2Provider)

    // const l2TokenAddr = await this.getL2ERC20Address(params.erc20L1Address, l1Provider)
    // const l2l3Gateway = L1ArbitrumGateway__factory.connect(await this.getL2L3GatewayAddress(params.erc20L1Address, l1Provider, params.l2Provider), params.l2Provider)
    // const l3l2Gateway = await l2l3Gateway.counterpartGateway()
    // const outboundCalldaata = await l2l3Gateway.getOutboundCalldata(l2TokenAddr, )
    // gasEstimator.estimateAll({
    //   to: l3l2Gateway,
    //   data: '',
    //   from: new Address(l2l3Gateway.address).applyAlias().value,
    //   l2CallValue: BigNumber.from(0),
    //   excessFeeRefundAddress: '',
    //   callValueRefundAddress: ''
    // }, await l1Provider.getGasPrice(), l1Provider, params.retryableOverrides?.l2l3TokenBridgeRetryableGas)

    // throw new Error('todo')
  }

  public async deposit(
    params:
      | (Erc20DepositRequestParams & {
          l1Signer: Signer
          overrides?: PayableOverrides
        })
      | TxRequestParams
  ): Promise<L1ContractCallTransaction> {
    const depositRequest = isTxRequestParams(params)
      ? params.txRequest
      : await this.getDepositRequest(params)

    const tx = await params.l1Signer.sendTransaction({
      ...depositRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  public async getDepositMessages(
    params: Erc20DepositMessagesParams
  ): Promise<Erc20DepositMessages> {
    // todo throw if not a teleporter receipt

    const l1l2Messages = await params.l1TransactionReceipt.getL1ToL2Messages(params.l2Provider)
    const factoryRedeem = await l1l2Messages[1].getSuccessfulRedeem()
    
    const l2l3Message = factoryRedeem.status === L1ToL2MessageStatus.REDEEMED
      ? (await new L1TransactionReceipt(factoryRedeem.l2TxReceipt).getL1ToL2Messages(params.l3Provider))[0]
      : undefined
    
    return {
      l1l2TokenBridge: l1l2Messages[0],
      l1l2FeeTokenBridge: undefined,
      l2ForwarderFactory: l1l2Messages[1],
      l2l3TokenBridge: l2l3Message,
      completed: await l2l3Message?.status() === L1ToL2MessageStatus.REDEEMED
    }
  }
}

class CustomFeeTokenL1L3Bridger extends Erc20L1L3Bridger {
  // when using custom fee token bridger, if token != fee token,
  // you need to getDepositRequest before doing approvals, because you need to know how much fee token to approve
  public override async getDepositRequest(
    params: Erc20DepositRequestParams & {
      from: string
      l1Provider: Provider
    }
  ): Promise<PickedTransactionRequest & { extraFeeTokenAmount: BigNumber }> {
    throw new Error('TODO')
  }

  // todo: should override _buildGasParams here because it needs to also estimate the fee token bridge
}

/**
 * Bridge ETH from L1 to L3 using a double retryable ticket
 */
export class EthL1L3Bridger extends BaseL1L3Bridger {
  /**
   * Get a tx request to deposit ETH to L3 via a double retryable ticket
   */
  public async getDepositRequest(
    params: EthDepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<L1ToL2TransactionRequest> {
    await this._checkL1Network(l1Signer)
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const l1Address = await l1Signer.getAddress()

    const l3DestinationAddress = params.to || l1Address
    const l2RefundAddress = params.l2RefundAddress || l1Address

    const l3TicketRequest = await L1ToL2MessageCreator.getTicketCreationRequest(
      {
        to: l3DestinationAddress,
        data: '0x',
        from: new Address(l1Address).applyAlias().value,
        l2CallValue: BigNumber.from(params.amount),
        excessFeeRefundAddress: l3DestinationAddress,
        callValueRefundAddress: l3DestinationAddress,
      },
      l2Provider,
      l3Provider,
      params.l3TicketGasOverrides
    )

    const l2TicketRequest = await L1ToL2MessageCreator.getTicketCreationRequest(
      {
        from: l1Address,
        to: l3TicketRequest.txRequest.to,
        l2CallValue: BigNumber.from(l3TicketRequest.txRequest.value),
        data: ethers.utils.hexlify(l3TicketRequest.txRequest.data),
        excessFeeRefundAddress: l2RefundAddress,
        callValueRefundAddress: l2RefundAddress,
      },
      l1Signer.provider!,
      l2Provider,
      params.l2TicketGasOverrides
    )

    return l2TicketRequest
  }

  /**
   * Deposit ETH to L3 via a double retryable ticket
   */
  public async deposit(
    params: EthDepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<L1ContractCallTransaction> {
    const txRequest = await this.getDepositRequest(
      params,
      l1Signer,
      l2Provider,
      l3Provider
    )

    return this.executeDepositRequest(txRequest, l1Signer)
  }

  /**
   * Execute a deposit request to L3 via a double retryable ticket
   */
  public async executeDepositRequest(
    depositRequest: L1ToL2TransactionRequest,
    l1Signer: Signer
  ): Promise<L1ContractCallTransaction> {
    return L1TransactionReceipt.monkeyPatchContractCallWait(
      await l1Signer.sendTransaction(depositRequest.txRequest)
    )
  }

  /**
   * Get the status of a deposit given an L1 tx receipt. Does not check if the tx is actually a deposit tx.
   *
   * @return Information regarding each step of the deposit
   * and `EthDepositStatus.completed` which indicates whether the deposit has fully completed.
   *
   * If `EthDepositStatus.l2Retryable.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the first step has failed (creating an ETH deposit retryable to L3).
   * The retryable to L2 must be manually redeemed before proceeding.
   *
   * If `EthDepositStatus.l3Retryable.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the second step has failed (depositing ETH to L3 via retryable).
   * The retryable to L3 must be manually redeemed.
   */
  public async getDepositStatus(
    l1TxReceipt: L1ContractCallTransactionReceipt,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<EthDepositStatus> {
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const l1l2Message = (await l1TxReceipt.getL1ToL2Messages(l2Provider))[0]

    const l1l2Redeem = await l1l2Message.getSuccessfulRedeem()

    if (l1l2Redeem.status != L1ToL2MessageStatus.REDEEMED) {
      return {
        l2Retryable: l1l2Redeem,
        l3Retryable: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    const l2l3Message = (
      await new L1EthDepositTransactionReceipt(
        l1l2Redeem.l2TxReceipt
      ).getL1ToL2Messages(l3Provider)
    )[0]

    if (l2l3Message === undefined) {
      throw new ArbSdkError(`L2 to L3 message not found`)
    }

    const l2l3Redeem = await l2l3Message.getSuccessfulRedeem()

    return {
      l2Retryable: l1l2Redeem,
      l3Retryable: l2l3Redeem,
      completed: l2l3Redeem.status === L1ToL2MessageStatus.REDEEMED,
    }
  }
}
