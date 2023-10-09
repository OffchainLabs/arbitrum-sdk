import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, BigNumberish, Signer, ethers } from 'ethers'
import { ERC20 } from '../abi/ERC20'
import { BridgedToL3Event } from '../abi/L2Forwarder'
import { L2ForwarderPredictor } from '../abi/L2ForwarderPredictor'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { L2ForwarderFactory__factory } from '../abi/factories/L2ForwarderFactory__factory'
import { L2Forwarder__factory } from '../abi/factories/L2Forwarder__factory'
import { L2GatewayRouter__factory } from '../abi/factories/L2GatewayRouter__factory'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { Teleporter__factory } from '../abi/factories/Teleporter__factory'
import { Address } from '../dataEntities/address'
import { DISABLED_GATEWAY } from '../dataEntities/constants'
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
import { L1ToL2TransactionRequest } from '../dataEntities/transactionRequest'
import {
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from '../message/L1ToL2Message'
import { L1ToL2MessageCreator } from '../message/L1ToL2MessageCreator'
import {
  L1ContractCallTransaction,
  L1ContractCallTransactionReceipt,
  L1EthDepositTransaction,
  L1EthDepositTransactionReceipt,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import { EventFetcher, FetchedEvent } from '../utils/eventFetcher'
import { Erc20Bridger, TokenApproveParams } from './erc20Bridger'

export enum Erc20TeleportationLeg {
  BridgeToL2,
  CallL2ForwarderFactory,
  BridgeToL3,
}

export enum EthTeleportationLeg {
  L2Retryable,
  L3Retryable,
}

export interface ManualRetryableGasParams {
  l2ForwarderFactoryGasLimit: BigNumber
  l1l2TokenBridgeGasLimit: BigNumber
  l2l3TokenBridgeGasLimit: BigNumber
  l1l2TokenBridgeRetryableSize: BigNumber
  l2l3TokenBridgeRetryableSize: BigNumber
}

export interface PopulatedRetryableGasParams extends ManualRetryableGasParams {
  l2GasPrice: BigNumber
  l3GasPrice: BigNumber
}

export interface Erc20DepositRequestParams {
  erc20L1Address: string
  amount: BigNumber
  to?: string
  overrides?: {
    gasPricePercentIncrease?: BigNumber
    relayerPaymentPercentIncrease?: BigNumber
    manualGasParams?: ManualRetryableGasParams
  }
}

export interface EthDepositRequestParams {
  amount: BigNumberish
  destinationOverrides?: {
    l3DestinationAddress: string
    l2RefundAddress: string
  }
  overrides?: {
    gasPricePercentIncrease?: BigNumber
    l2RetryableGasLimit?: BigNumber
    l3RetryableGasLimit?: BigNumber
  }
}

export interface Erc20DepositStatus {
  bridgeToL2Status: L1ToL2MessageWaitResult
  callToL2ForwarderStatus: L1ToL2MessageWaitResult
  bridgeToL3Status: L1ToL2MessageWaitResult
  completed: boolean
}

export interface RelayedErc20DepositStatus {
  bridgeToL2: L1ToL2MessageWaitResult
  l2ForwarderCall: L1ContractCallTransactionReceipt | undefined
  bridgeToL3: L1ToL2MessageWaitResult
  completed: boolean
}

export type RelayerInfo = L2ForwarderPredictor.L2ForwarderParamsStruct & {
  chainId: number
}

export type RelayedErc20DepositRequestResult = {
  txRequest: L1ToL2TransactionRequest
  relayerInfo: RelayerInfo
}

export type RelayedErc20DepositResult = {
  tx: L1ContractCallTransaction
  relayerInfo: RelayerInfo
}

export type EthDepositStatus = {
  l2RetryableStatus: L1ToL2MessageStatus
  l3RetryableStatus: L1ToL2MessageStatus
  completed: boolean
}

class BaseL1L3Bridger {
  public readonly l1Network: L1Network
  public readonly l2Network: L2Network
  public readonly l3Network: L2Network

  // TODO: REPLACE THIS WITH L1TOL2MESSAGEGASESTIMATOR
  public readonly defaultGasPricePercentIncrease: BigNumber =
    BigNumber.from(130) // 30% increase

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
   * Check the signer/provider matches the l2Network, throws if not
   * @param sop
   */
  protected async _checkL3Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l3Network.chainID)
  }

  protected _percentIncrease(base: BigNumber, percent: BigNumber) {
    return base.mul(percent).div(100)
  }
}

class BaseErc20L1L3Bridger extends BaseL1L3Bridger {
  public readonly teleporterAddresses: TeleporterAddresses

  // todo: tune these
  public readonly defaultRetryableGasParams: ManualRetryableGasParams = {
    l2ForwarderFactoryGasLimit: BigNumber.from(1_000_000),
    l1l2TokenBridgeGasLimit: BigNumber.from(1_000_000),
    l2l3TokenBridgeGasLimit: BigNumber.from(1_000_000),
    l1l2TokenBridgeRetryableSize: BigNumber.from(1000),
    l2l3TokenBridgeRetryableSize: BigNumber.from(1000),
  } as const

  public readonly defaultRelayerPaymentPercentIncrease: BigNumber =
    BigNumber.from(130) // 30% increase

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
   * @param erc20L1Address
   * @param l1Provider
   * @returns
   */
  public async getL2ERC20Address(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    await this._checkL1Network(l1Provider)
    return this._getChildErc20Address(
      erc20L1Address,
      l1Provider,
      this.l2Network
    )
  }

  /**
   * Get the corresponding L3 token address for the provided L1 token
   * @param erc20L1Address
   * @param l1Provider
   * @param l2Provider
   * @returns
   */
  public async getL3ERC20Address(
    erc20L1Address: string,
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<string> {
    await this._checkL2Network(l2Provider)
    return this._getChildErc20Address(
      await this.getL2ERC20Address(erc20L1Address, l1Provider),
      l2Provider,
      this.l3Network
    )
  }

  private _getChildErc20Address(
    erc20ParentAddress: string,
    parentProvider: Provider,
    childNetwork: L2Network
  ) {
    // assume that provider has been checked
    const parentGatewayRouter = L1GatewayRouter__factory.connect(
      childNetwork.tokenBridge.l1GatewayRouter,
      parentProvider
    )

    return parentGatewayRouter.calculateL2TokenAddress(erc20ParentAddress)
  }

  /**
   * Get the address of the l1 <-> l2 gateway on l1 for this token
   * @param erc20L1Address
   * @param l1Provider
   * @returns
   */
  public async getL1L2GatewayAddress(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    await this._checkL1Network(l1Provider)

    return await L1GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Provider
    ).getGateway(erc20L1Address)
  }

  /**
   * Get the address of the l2 <-> l3 gateway on l2 for this token
   * @param erc20L1Address
   * @param l1Provider
   * @param l2Provider
   * @returns
   */
  public async getL2L3GatewayAddress(
    erc20L1Address: string,
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<string> {
    await this._checkL1Network(l1Provider)
    await this._checkL2Network(l2Provider)

    const l2Token = await this.getL2ERC20Address(erc20L1Address, l1Provider)

    return await L1GatewayRouter__factory.connect(
      this.l3Network.tokenBridge.l1GatewayRouter,
      l2Provider
    ).getGateway(l2Token)
  }

  public async isL1L2GatewayDefault(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<boolean> {
    const gateway = await this.getL1L2GatewayAddress(erc20L1Address, l1Provider)
    return gateway === this.l2Network.tokenBridge.l1ERC20Gateway
  }

  public async isL2L3GatewayDefault(
    erc20L1Address: string,
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<boolean> {
    const gateway = await this.getL2L3GatewayAddress(
      erc20L1Address,
      l1Provider,
      l2Provider
    )
    return gateway === this.l3Network.tokenBridge.l1ERC20Gateway
  }

  /**
   * Get the L1 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesnt
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param l1Provider
   * @param l1TokenAddr
   * @returns
   */
  public getL1TokenContract(l1TokenAddr: string, l1Provider: Provider): ERC20 {
    return ERC20__factory.connect(l1TokenAddr, l1Provider)
  }

  /**
   * Get the L2 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesnt
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param l2Provider
   * @param l2TokenAddr
   * @returns
   */
  public getL2TokenContract(
    l2TokenAddr: string,
    l2Provider: Provider
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(l2TokenAddr, l2Provider)
  }

  /**
   * Get the L3 token contract at the provided address
   * Note: This function just returns a typed ethers object for the provided address, it doesnt
   * check the underlying form of the contract bytecode to see if it's an erc20, and doesn't ensure the validity
   * of any of the underlying functions on that contract.
   * @param l2Provider
   * @param l2TokenAddr
   * @returns
   */
  public getL3TokenContract(
    l3TokenAddr: string,
    l3Provider: Provider
  ): L2GatewayToken {
    return L2GatewayToken__factory.connect(l3TokenAddr, l3Provider)
  }

  /**
   * Whether the L1 token has been disabled on the router
   * @param l1TokenAddress
   * @param l1Provider
   * @returns
   */
  public async l1TokenIsDisabled(
    l1TokenAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    await this._checkL1Network(l1Provider)

    return this._tokenIsDisabled(
      l1TokenAddress,
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Provider
    )
  }

  /**
   * Whether the L2 token has been disabled on the router
   * @param l2TokenAddress
   * @param l2Provider
   * @returns
   */
  public async l2TokenIsDisabled(
    l2TokenAddress: string,
    l2Provider: Provider
  ): Promise<boolean> {
    await this._checkL2Network(l2Provider)

    return this._tokenIsDisabled(
      l2TokenAddress,
      this.l3Network.tokenBridge.l1GatewayRouter,
      l2Provider
    )
  }

  public l2ForwarderAddress(
    params: L2ForwarderPredictor.L2ForwarderParamsStruct,
    l2Provider: Provider
  ): Promise<string> {
    return L2ForwarderFactory__factory.connect(
      this.teleporterAddresses.l2ForwarderFactory,
      l2Provider
    ).l2ForwarderAddress(params)
  }

  private async _tokenIsDisabled(
    tokenAddress: string,
    gatewayRouterAddress: string,
    provider: Provider
  ): Promise<boolean> {
    // assumes provider has been checked
    const gatewayRouter = L2GatewayRouter__factory.connect(
      gatewayRouterAddress,
      provider
    )

    return (
      (await gatewayRouter.l1TokenToGateway(tokenAddress)) === DISABLED_GATEWAY
    )
  }

  protected async _populateGasParams(
    params: Erc20DepositRequestParams,
    l1Provider: Provider,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<PopulatedRetryableGasParams> {
    params.overrides = params.overrides || {}

    let manualGasParams = params.overrides.manualGasParams
    if (!manualGasParams) {
      // make sure both gateways are default
      if (
        !(await this.isL1L2GatewayDefault(params.erc20L1Address, l1Provider))
      ) {
        throw new ArbSdkError(
          `Cannot estimate gas for custom l1l2 gateway, please provide gas params`
        )
      }

      if (
        !(await this.isL2L3GatewayDefault(
          params.erc20L1Address,
          l1Provider,
          l2Provider
        ))
      ) {
        throw new ArbSdkError(
          `Cannot estimate gas for custom l2l3 gateway, please provide gas params`
        )
      }

      manualGasParams = this.defaultRetryableGasParams
    }

    // populate gasParams gas prices
    return {
      ...manualGasParams,
      l2GasPrice: this._percentIncrease(
        await l2Provider.getGasPrice(),
        params.overrides.gasPricePercentIncrease ||
          this.defaultGasPricePercentIncrease
      ),
      l3GasPrice: this._percentIncrease(
        await l3Provider.getGasPrice(),
        params.overrides.gasPricePercentIncrease ||
          this.defaultGasPricePercentIncrease
      ),
    }
  }
}

export class Erc20L1L3Bridger extends BaseErc20L1L3Bridger {
  /**
   * Get a tx request to approve tokens for teleportation.
   * The tokens will be approved for the Teleporter on L1.
   * @param params
   * @returns
   */
  public async getApproveTokenRequest(
    params: TokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    const iErc20Interface = ERC20__factory.createInterface()
    const data = iErc20Interface.encodeFunctionData('approve', [
      this.teleporterAddresses.l1Teleporter,
      params.amount || ethers.constants.MaxUint256,
    ])

    return {
      to: params.erc20L1Address,
      data,
      value: BigNumber.from(0),
    }
  }

  public async approveToken(
    params: TokenApproveParams,
    l1Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    await this._checkL1Network(l1Signer)

    const approveRequest = await this.getApproveTokenRequest(params)

    return l1Signer.sendTransaction(approveRequest)
  }

  public async getDepositRequest(
    params: Erc20DepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    await this._checkL1Network(l1Signer)
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const gasParams = await this._populateGasParams(
      params,
      l1Signer.provider!,
      l2Provider,
      l3Provider
    )

    const teleporter = Teleporter__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Signer
    )

    const calldata = teleporter.interface.encodeFunctionData('teleport', [
      {
        l1Token: params.erc20L1Address,
        l1l2Router: this.l2Network.tokenBridge.l1GatewayRouter,
        l2l3Router: this.l3Network.tokenBridge.l1GatewayRouter,
        to: params.to || (await l1Signer.getAddress()),
        amount: params.amount,
        gasParams,
        randomNonce: ethers.utils.randomBytes(32),
      },
    ])

    const l1GasPrice = await l1Signer.provider!.getGasPrice()

    const calculatedGasCosts = await teleporter.calculateRetryableGasCosts(
      this.l2Network.ethBridge.inbox,
      this._percentIncrease(l1GasPrice, this.defaultGasPricePercentIncrease),
      gasParams
    )

    return {
      to: this.teleporterAddresses.l1Teleporter,
      data: calldata,
      value: calculatedGasCosts.total,
    }
  }

  public async deposit(
    params: Erc20DepositRequestParams,
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

    return L1TransactionReceipt.monkeyPatchContractCallWait(
      await l1Signer.sendTransaction(txRequest)
    )
  }

  /**
   * Get the status of a deposit given an L1 tx receipt.
   *
   * Note: This function does not verify that the tx is actually a deposit tx.
   *
   * @param depositTxReceipt
   * @param l2Provider
   * @param l3Provider
   * @returns
   */
  public async getDepositStatus(
    depositTxReceipt: L1ContractCallTransactionReceipt,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<Erc20DepositStatus> {
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const l1l2Messages = await depositTxReceipt.getL1ToL2Messages(l2Provider)
    const firstLegRedeem = await l1l2Messages[0].getSuccessfulRedeem()
    const secondLegRedeem = await l1l2Messages[1].getSuccessfulRedeem()

    // if second leg is not redeemed, the third must not be created
    if (secondLegRedeem.status !== L1ToL2MessageStatus.REDEEMED) {
      return {
        bridgeToL2Status: firstLegRedeem,
        callToL2ForwarderStatus: secondLegRedeem,
        bridgeToL3Status: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    // otherwise, third leg must be created
    const thirdLegMessage = (
      await new L1TransactionReceipt(
        secondLegRedeem.l2TxReceipt
      ).getL1ToL2Messages(l3Provider)
    )[0]

    const thirdLegRedeem = await thirdLegMessage.getSuccessfulRedeem()

    return {
      bridgeToL2Status: firstLegRedeem,
      callToL2ForwarderStatus: secondLegRedeem,
      bridgeToL3Status: thirdLegRedeem,
      completed: thirdLegRedeem.status === L1ToL2MessageStatus.REDEEMED,
    }
  }
}

export class RelayedErc20L1L3Bridger extends BaseErc20L1L3Bridger {
  public async getApproveTokenRequest(
    params: TokenApproveParams,
    l1Provider: Provider
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    return new Erc20Bridger(this.l2Network).getApproveTokenRequest({
      ...params,
      l1Provider,
    })
  }

  public async approveToken(
    params: TokenApproveParams,
    l1Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    return new Erc20Bridger(this.l2Network).approveToken({
      ...params,
      l1Signer,
    })
  }

  public async getDepositRequest(
    params: Erc20DepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<RelayedErc20DepositRequestResult> {
    await this._checkL1Network(l1Signer)
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const populatedGasParams = await this._populateGasParams(
      params,
      l1Signer.provider!,
      l2Provider,
      l3Provider
    )

    const relayerPayment = this._percentIncrease(
      populatedGasParams.l2ForwarderFactoryGasLimit.mul(
        populatedGasParams.l2GasPrice
      ),
      params.overrides?.relayerPaymentPercentIncrease ||
        this.defaultRelayerPaymentPercentIncrease
    )

    // calculate l2 forwarder address
    const l2ForwarderParams: L2ForwarderPredictor.L2ForwarderParamsStruct = {
      owner: await l1Signer.getAddress(),
      token: await this.getL2ERC20Address(
        params.erc20L1Address,
        l1Signer.provider!
      ),
      router: this.l3Network.tokenBridge.l1GatewayRouter,
      to: params.to || (await l1Signer.getAddress()),
      amount: params.amount,
      gasLimit: populatedGasParams.l2l3TokenBridgeGasLimit,
      gasPrice: populatedGasParams.l3GasPrice,
      relayerPayment,
      randomNonce: ethers.utils.randomBytes(32),
    }

    // figure out how much extra ETH we should pass along through the token bridge
    // populatedGasParams has a 30% default increase already
    const teleporter = Teleporter__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Signer
    )
    const calculatedGasCosts = await teleporter.calculateRetryableGasCosts(
      this.l2Network.ethBridge.inbox,
      '0', // we don't care about L1 gas price, this will just set it to current gas price
      populatedGasParams
    )
    const extraValue = calculatedGasCosts.l2l3TokenBridgeGasCost
      .add(calculatedGasCosts.l2l3TokenBridgeSubmissionCost)
      .add(relayerPayment)
      .add(ethers.utils.parseEther('0.1'))

    const l2ForwarderAddress = await this.l2ForwarderAddress(
      l2ForwarderParams,
      l2Provider
    )
    const baseDepositRequestParams = {
      amount: BigNumber.from(params.amount),
      l1Provider: l1Signer.provider!,
      l2Provider: l2Provider,
      erc20L1Address: params.erc20L1Address,
      from: await l1Signer.getAddress(),
      destinationAddress: l2ForwarderAddress,
      callValueRefundAddress: l2ForwarderAddress,
      excessFeeRefundAddress: l2ForwarderAddress,
    }

    const erc20Bridger = new Erc20Bridger(this.l2Network)
    const submissionCostBefore = (
      await erc20Bridger.getDepositRequest(baseDepositRequestParams)
    ).retryableData.maxSubmissionCost
    const tokenBridgeRequest = await erc20Bridger.getDepositRequest({
      ...baseDepositRequestParams,
      retryableGasOverrides: {
        // we need to INCREASE submission cost by extraValue
        // percent increase has already been applied to submissionCostBefore and extraValue
        // so we set percentIncrease to 0 so we don't needlessly increase again
        maxSubmissionFee: {
          base: submissionCostBefore.add(extraValue),
          percentIncrease: ethers.BigNumber.from(0),
        },
      },
    })

    return {
      relayerInfo: {
        ...l2ForwarderParams,
        chainId: this.l2Network.chainID,
      },
      txRequest: tokenBridgeRequest,
    }
  }

  public async deposit(
    params: Erc20DepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<RelayedErc20DepositResult> {
    const depositRequest = await this.getDepositRequest(
      params,
      l1Signer,
      l2Provider,
      l3Provider
    )

    return {
      tx: L1TransactionReceipt.monkeyPatchContractCallWait(
        await l1Signer.sendTransaction(depositRequest.txRequest.txRequest)
      ),
      relayerInfo: depositRequest.relayerInfo,
    }
  }

  /**
   * Get the status of a deposit given an L1 tx receipt and relayer info.
   *
   * Note: This function does not verify that the tx is actually a deposit tx, nor does it check the provider chain ids.
   *
   * @param depositTxReceipt
   * @param relayerInfo
   * @param l2Provider
   * @param l3Provider
   */
  public async getDepositStatus(
    depositTxReceipt: L1ContractCallTransactionReceipt,
    relayerInfo: RelayerInfo,
    l2Provider: JsonRpcProvider,
    l3Provider: Provider
  ): Promise<RelayedErc20DepositStatus> {
    const firstLegRedeem = await (
      await depositTxReceipt.getL1ToL2Messages(l2Provider)
    )[0].getSuccessfulRedeem()

    if (firstLegRedeem.status !== L1ToL2MessageStatus.REDEEMED) {
      return {
        bridgeToL2: firstLegRedeem,
        l2ForwarderCall: undefined,
        bridgeToL3: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    const l2ForwarderAddress = await L2ForwarderFactory__factory.connect(
      this.teleporterAddresses.l2ForwarderFactory,
      l2Provider
    ).l2ForwarderAddress(relayerInfo)

    const bridgeToL3Event = await this._findBridgedToL3Event(
      l2ForwarderAddress,
      firstLegRedeem.l2TxReceipt.blockNumber,
      l2Provider
    )

    if (bridgeToL3Event === undefined) {
      return {
        bridgeToL2: firstLegRedeem,
        l2ForwarderCall: undefined,
        bridgeToL3: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    // get tx or receipt from the event
    const tx = await l2Provider.getTransaction(bridgeToL3Event.transactionHash)
    const receipt = new L1ContractCallTransactionReceipt(await tx.wait())
    const l2l3Redeem = await (
      await receipt.getL1ToL2Messages(l3Provider)
    )[0].getSuccessfulRedeem()

    return {
      bridgeToL2: firstLegRedeem,
      l2ForwarderCall: receipt,
      bridgeToL3: l2l3Redeem,
      completed: l2l3Redeem.status === L1ToL2MessageStatus.REDEEMED,
    }
  }

  // takes: deposit tx hash, l2 forwarder params, l2 signer
  public static async relayDeposit(
    relayerInfo: RelayerInfo,
    l2Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    const teleporterAddresses =
      l2Networks[relayerInfo.chainId].teleporterAddresses

    if (!teleporterAddresses) {
      throw new ArbSdkError(
        `L2 network ${
          l2Networks[relayerInfo.chainId].name
        } does not have teleporter contracts`
      )
    }

    const l2ForwarderFactory = L2ForwarderFactory__factory.connect(
      teleporterAddresses.l2ForwarderFactory,
      l2Signer
    )

    return l2ForwarderFactory.callForwarder(relayerInfo)
  }

  private async _findBridgedToL3Event(
    l2ForwarderAddress: string,
    fromL2Block: number,
    l2Provider: JsonRpcProvider
  ) {
    const latest = await l2Provider.getBlockNumber()
    const eventFetcher = new EventFetcher(l2Provider)

    const events = await eventFetcher.getEvents(
      L2Forwarder__factory,
      contract => contract.filters.BridgedToL3(),
      { address: l2ForwarderAddress, fromBlock: fromL2Block, toBlock: latest }
    )

    if (events.length === 0) {
      return undefined
    }

    return events[0]
  }
}

export class EthL1L3Bridger extends BaseL1L3Bridger {
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

    const l3DestinationAddress =
      params.destinationOverrides?.l3DestinationAddress || l1Address
    const l2RefundAddress =
      params.destinationOverrides?.l2RefundAddress || l1Address

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
      l3Provider
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
      l2Provider
    )

    return l2TicketRequest
  }

  public async deposit(
    params: EthDepositRequestParams,
    l1Signer: Signer,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<L1EthDepositTransaction> {
    const txRequest = await this.getDepositRequest(
      params,
      l1Signer,
      l2Provider,
      l3Provider
    )

    return L1TransactionReceipt.monkeyPatchEthDepositWait(
      await l1Signer.sendTransaction(txRequest.txRequest)
    )
  }

  // don't pass a tx that isn't an l1 to l3 eth deposit
  public async getDepositStatus(
    l1TxReceipt: L1EthDepositTransactionReceipt,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<EthDepositStatus> {
    const l1l2Message = (await l1TxReceipt.getL1ToL2Messages(l2Provider))[0]

    const l1l2Redeem = await l1l2Message.getSuccessfulRedeem()

    if (l1l2Redeem.status != L1ToL2MessageStatus.REDEEMED) {
      return {
        l2RetryableStatus: l1l2Redeem.status,
        l3RetryableStatus: L1ToL2MessageStatus.NOT_YET_CREATED,
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
      l2RetryableStatus: l1l2Redeem.status,
      l3RetryableStatus: l2l3Redeem.status,
      completed: l2l3Redeem.status === L1ToL2MessageStatus.REDEEMED,
    }
  }
}
