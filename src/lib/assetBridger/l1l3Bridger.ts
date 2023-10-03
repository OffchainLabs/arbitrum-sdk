import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
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
import { L2GatewayRouter__factory } from '../abi/factories/L2GatewayRouter__factory'
import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { ERC20 } from '../abi/ERC20'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { DISABLED_GATEWAY } from '../dataEntities/constants'
import { Erc20Bridger, TokenApproveParams } from './erc20Bridger'
import {
  BigNumber,
  BigNumberish,
  ContractFactory,
  Signer,
  Wallet,
  ethers,
} from 'ethers'
import { Teleporter__factory } from '../abi/factories/Teleporter__factory'
import { AbiCoder } from 'ethers/lib/utils'
import {
  L1ContractCallTransaction,
  L1ContractCallTransactionReceipt,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import { L1ToL2MessageStatus } from '../message/L1ToL2Message'
import { L2ForwarderPredictor } from '../abi/L2ForwarderPredictor'
import { L1ToL2TransactionRequest } from '../dataEntities/transactionRequest'

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
  l1l2TokenBridgeRetryableSize: BigNumber // todo: could call the gateway to get the calldata for a given token?
  l2l3TokenBridgeRetryableSize: BigNumber // todo: could call the gateway to get the calldata for a given token?
}

export interface PopulatedRetryableGasParams extends ManualRetryableGasParams {
  l2GasPrice: BigNumber
  l3GasPrice: BigNumber
}

export interface Erc20DepositRequestParams {
  erc20L1Address: string
  to: string
  amount: BigNumberish
  overrides?: {
    gasPricePercentIncrease?: BigNumber
    relayerPaymentPercentIncrease?: BigNumber
    manualGasParams?: ManualRetryableGasParams
  }
}

export interface EthDepositRequestParams {
  to: string
  amount: BigNumberish
  overrides?: {
    gasPricePercentIncrease?: BigNumber
  }
}

// if using relayer and leg 1 times out, failedLegStatus will be undefined
export interface WaitForErc20DepositResult {
  success: boolean
  failedLeg?: Erc20TeleportationLeg
  failedLegStatus?: Exclude<L1ToL2MessageStatus, L1ToL2MessageStatus.REDEEMED>
}

export interface WaitForEthDepositResult {
  success: boolean
  failedLeg?: EthTeleportationLeg
  failedLegStatus?: Exclude<L1ToL2MessageStatus, L1ToL2MessageStatus.REDEEMED>
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

class BaseL1L3Bridger {
  public readonly l1Network: L1Network
  public readonly l2Network: L2Network
  public readonly l3Network: L2Network

  public readonly defaultGasPricePercentIncrease: BigNumber =
    BigNumber.from(130) // 30% increase

  constructor(l3Network: L2Network) {
    const l2Network = l2Networks[l3Network.partnerChainID]
    if (!l2Network) {
      throw new ArbSdkError(
        `Unknown l2 network chain id: ${l3Network.partnerChainID}`
      )
    }

    if (!l2Network.teleporterAddresses) {
      throw new ArbSdkError(
        `L2 network ${l2Network.name} does not have a teleporter`
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

  // todo: find and replace '100' with this
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
  public getL1TokenContract(l1Provider: Provider, l1TokenAddr: string): ERC20 {
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
    l2Provider: Provider,
    l2TokenAddr: string
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
    l3Provider: Provider,
    l3TokenAddr: string
  ): L2GatewayToken {
    return this.getL2TokenContract(l3Provider, l3TokenAddr)
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
      if (!(await this.isL1L2GatewayDefault(params.erc20L1Address, l1Provider))) {
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
    l1Provider: Provider,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    await this._checkL1Network(l1Provider)
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const gasParams = await this._populateGasParams(
      params,
      l1Provider,
      l2Provider,
      l3Provider
    )

    const teleporter = Teleporter__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Provider
    )

    const calldata = teleporter.interface.encodeFunctionData('teleport', [
      params.erc20L1Address,
      this.l2Network.tokenBridge.l1GatewayRouter,
      this.l3Network.tokenBridge.l1GatewayRouter,
      params.to,
      params.amount,
      gasParams,
    ])

    const l1GasPrice = await l1Provider.getGasPrice()

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
      l1Signer.provider!,
      l2Provider,
      l3Provider
    )

    return L1TransactionReceipt.monkeyPatchContractCallWait(
      await l1Signer.sendTransaction(txRequest)
    )
  }

  public async waitForDeposit(
    depositTxReceipt: L1TransactionReceipt,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<WaitForErc20DepositResult> {
    if (depositTxReceipt.to !== this.teleporterAddresses.l1Teleporter) {
      throw new ArbSdkError(
        `Transaction receipt is not for the teleporter: ${depositTxReceipt.to}`
      )
    }

    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const l1l2Messages = await depositTxReceipt.getL1ToL2Messages(l2Provider)
    const firstLegStatus = (await l1l2Messages[0].waitForStatus()).status
    const secondLegStatus = (await l1l2Messages[1].waitForStatus()).status

    if (firstLegStatus != L1ToL2MessageStatus.REDEEMED) {
      return {
        success: false,
        failedLeg: Erc20TeleportationLeg.BridgeToL2,
        failedLegStatus: firstLegStatus,
      }
    } else if (secondLegStatus != L1ToL2MessageStatus.REDEEMED) {
      return {
        success: false,
        failedLeg: Erc20TeleportationLeg.CallL2ForwarderFactory,
        failedLegStatus: secondLegStatus,
      }
    }

    const thirdLegMessage = (
      await new L1ContractCallTransactionReceipt(
        (await l1l2Messages[1].getAutoRedeemAttempt())!
      ).getL1ToL2Messages(l3Provider)
    )[0]

    const thirdLegStatus = (await thirdLegMessage.waitForStatus()).status

    if (thirdLegStatus != L1ToL2MessageStatus.REDEEMED) {
      return {
        success: false,
        failedLeg: Erc20TeleportationLeg.BridgeToL3,
        failedLegStatus: thirdLegStatus,
      }
    }

    return {
      success: true,
    }
  }
}

export class RelayedErc20L1L3Bridger extends BaseErc20L1L3Bridger {
  public async getApproveTokenRequest(
    params: TokenApproveParams,
    l1Provider: Provider
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>> {
    throw new Error('Not implemented')
  }

  public async approveToken(
    params: TokenApproveParams,
    l1Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    throw new Error('Not implemented')
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

    const teleporter = Teleporter__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Signer
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
      token: params.erc20L1Address,
      router: this.l3Network.tokenBridge.l1GatewayRouter,
      to: params.to,
      amount: params.amount,
      gasLimit: populatedGasParams.l2l3TokenBridgeGasLimit,
      gasPrice: populatedGasParams.l3GasPrice,
      relayerPayment,
    }

    const l2ForwarderAddress = await teleporter.l2ForwarderAddress(
      l2ForwarderParams
    )

    const erc20Bridger = new Erc20Bridger(this.l2Network)

    const tokenBridgeRequest = await erc20Bridger.getDepositRequest({
      amount: BigNumber.from(params.amount),
      l1Provider: l1Signer.provider!,
      l2Provider: l2Provider,
      erc20L1Address: params.erc20L1Address,
      from: await l1Signer.getAddress(),
      destinationAddress: l2ForwarderAddress,
      callValueRefundAddress: l2ForwarderAddress,
      excessFeeRefundAddress: l2ForwarderAddress,
    })

    // add relayer payment and l3 retryable costs to value
    const calculatedGasCosts = await teleporter.calculateRetryableGasCosts(
      this.l2Network.ethBridge.inbox,
      '0', // we don't care about L1 gas price, this will just set it to current gas price
      populatedGasParams
    )
    const extraValue = calculatedGasCosts.l2l3TokenBridgeGasCost
      .add(calculatedGasCosts.l2l3TokenBridgeSubmissionCost)
      .add(relayerPayment)
    tokenBridgeRequest.txRequest.value = extraValue.add(
      tokenBridgeRequest.txRequest.value
    )

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
    throw new Error('Not implemented')
  }

  public async waitForDeposit(
    depositResult: RelayedErc20DepositResult,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<WaitForErc20DepositResult> {
    throw new Error('Not implemented')
  }

  // takes: deposit tx hash, l2 forwarder params, l2 signer
  public static async relayDeposit(
    relayerInfo: RelayerInfo,
    l2Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    throw new Error('Not implemented')
  }
}

export class EthL1L3Bridger extends BaseL1L3Bridger {

}
