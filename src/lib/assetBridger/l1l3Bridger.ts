import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import {
  BigNumber,
  BigNumberish,
  Overrides,
  PayableOverrides,
  Signer,
  ethers,
} from 'ethers'
import { IERC20 } from '../abi/IERC20'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { IL1Teleporter } from '../abi/IL1Teleporter'
import { IERC20__factory } from '../abi/factories/IERC20__factory'
import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { IL2ForwarderFactory__factory } from '../abi/factories/IL2ForwarderFactory__factory'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { IL1Teleporter__factory } from '../abi/factories/IL1Teleporter__factory'
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
import { L1ToL2TransactionRequest } from '../dataEntities/transactionRequest'
import {
  L1ToL2MessageReader,
  L1ToL2MessageStatus,
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
  L1EthDepositTransactionReceipt,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import { Erc20Bridger } from './erc20Bridger'
import { isDefined } from '../utils/lib'
import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { OmitTyped } from '../utils/types'
import { getAddress } from 'ethers/lib/utils'
import { IL2Forwarder } from '../abi/IL2Forwarder'
import { ERC20__factory } from '../abi/factories/ERC20__factory'

type PickedTransactionRequest = Required<
  Pick<TransactionRequest, 'to' | 'data' | 'value'>
>

export enum TeleportationType {
  /**
   * Teleporting to an ETH fee L3
   */
  Standard,
  /**
   * Teleporting the fee token to a custom fee L3
   */
  OnlyFeeToken,
  /**
   * Teleporting a non-fee token to a custom fee L3
   */
  NonFeeTokenToCustomFee,
}

export type TxRequestParams = {
  txRequest: PickedTransactionRequest
  l1Signer: Signer
  overrides?: PayableOverrides
}

type RetryableGasValues = {
  gasLimit: BigNumber
  maxSubmissionFee: BigNumber
}

export type DepositRequestResult = {
  txRequest: PickedTransactionRequest
  feeTokenAmount: BigNumber
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

type Erc20DepositRequestRetryableOverrides = {
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
  retryableOverrides?: Erc20DepositRequestRetryableOverrides
}

export type Erc20DepositMessagesParams = {
  txHash: string
  l1Provider: Provider
  l2Provider: Provider
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
  l1l2FeeTokenBridge: L1ToL2MessageReader | undefined
  /**
   * L2ForwarderFactory message
   */
  l2ForwarderFactory: L1ToL2MessageReader
  /**
   * L2 to L3 token bridge message
   */
  l2l3TokenBridge: L1ToL2MessageReader | undefined
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
   * L1 to L2 message
   */
  l2Retryable: L1ToL2MessageReader
  /**
   * L2 to L3 message
   */
  l3Retryable: L1ToL2MessageReader | undefined
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
  public readonly defaultGasLimitPercentIncrease: BigNumber =
    BigNumber.from(100)

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

/**
 * Check if an object has an l1Signer property
 */
const hasL1Signer = <T>(
  x: DoesNotHaveL1Signer<T> | { l1Signer: Signer }
): x is { l1Signer: Signer } => {
  return isDefined((x as { l1Signer: Signer }).l1Signer)
}

/**
 * Check if an object is of TxRequestParams type
 */
const isTxRequestParams = <T>(
  possibleRequest: IsNotTxRequestParams<T> | TxRequestParams
): possibleRequest is TxRequestParams => {
  const req = possibleRequest as TxRequestParams
  return isDefined(req.txRequest) && isDefined(req.l1Signer)
}

/**
 * Bridger for moving ERC20 tokens from L1 to L3
 */
export class Erc20L1L3Bridger extends BaseL1L3Bridger {
  /**
   * Addresses of teleporter contracts on L2
   */
  public readonly teleporterAddresses: TeleporterAddresses

  /**
   * Default gas limit for L2ForwarderFactory.callForwarder of 1,000,000
   *
   * Measured Standard: 361746
   *
   * Measured OnlyCustomFee: 220416
   *
   * Measured NonFeeTokenToCustomFee: 373449
   */
  public readonly l2ForwarderFactoryDefaultGasLimit = BigNumber.from(1_000_000)

  /**
   * If the L3 network uses a custom (non-eth) fee token, this is the address of that token on L2
   */
  public readonly l2FeeTokenAddress: string | undefined

  protected readonly l2Erc20Bridger = new Erc20Bridger(this.l2Network)
  protected readonly l3Erc20Bridger = new Erc20Bridger(this.l3Network)

  /**
   * If the L3 network uses a custom fee token, this is the address of that token on L1
   */
  protected _l1FeeTokenAddress: string | undefined

  public constructor(l3Network: L2Network) {
    super(l3Network)

    if (!this.l2Network.teleporterAddresses) {
      throw new ArbSdkError(
        `L2 network ${this.l2Network.name} does not have teleporter contracts`
      )
    }

    if (
      this.l3Network.nativeToken &&
      this.l3Network.nativeToken !== ethers.constants.AddressZero
    ) {
      this.l2FeeTokenAddress = this.l3Network.nativeToken
    }

    this.teleporterAddresses = this.l2Network.teleporterAddresses
  }

  /**
   * If the L3 network uses a custom fee token, return the address of that token on L1.
   * If the L3 network uses ETH for fees, return undefined.
   * If the L3 network uses a custom fee token that is not available on L1, throw.
   * If the L3 network uses a custom fee token that doesn't use 18 decimals on L1 and L2, throw.
   */
  public async l1FeeTokenAddress(
    l1Provider: Provider,
    l2Provider: Provider
  ): Promise<string | undefined> {
    // if the L3 network uses ETH for fees, early return undefined
    if (!this.l2FeeTokenAddress) return undefined

    // if we've already fetched the L1 fee token address, early return it
    if (this._l1FeeTokenAddress) return this._l1FeeTokenAddress

    await this._checkL1Network(l1Provider)
    await this._checkL2Network(l2Provider)

    let l1FeeTokenAddress: string | undefined

    try {
      l1FeeTokenAddress = await this.l2Erc20Bridger.getL1ERC20Address(
        this.l2FeeTokenAddress,
        l2Provider
      )
    } catch (e: any) {
      // todo: this feels like a hack
      // if the error is a CALL_EXCEPTION, we can't find the token on L1
      // if the error is something else, rethrow
      if (e.code !== 'CALL_EXCEPTION') {
        throw e
      }
    }

    if (
      !l1FeeTokenAddress ||
      l1FeeTokenAddress === ethers.constants.AddressZero
    ) {
      throw new ArbSdkError(`Could not find address for L3's fee token on L1`)
    }

    // make sure both the L1 and L2 tokens have 18 decimals
    if (
      (await ERC20__factory.connect(
        l1FeeTokenAddress,
        l1Provider
      ).decimals()) !== 18
    ) {
      throw new ArbSdkError(`L3's fee token doesn't use 18 decimals on L1`)
    }
    if (
      (await ERC20__factory.connect(
        this.l2FeeTokenAddress,
        l2Provider
      ).decimals()) !== 18
    ) {
      throw new ArbSdkError(`L3's fee token doesn't use 18 decimals on L2`)
    }

    return (this._l1FeeTokenAddress = l1FeeTokenAddress)
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
   * Whether the L1 token has been disabled on the L1 <-> L2 router given an L1 token address
   */
  public async l1TokenIsDisabled(
    l1TokenAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    return this.l2Erc20Bridger.l1TokenIsDisabled(l1TokenAddress, l1Provider)
  }

  /**
   * Whether the L2 token has been disabled on the L2 <-> L3 router given an L2 token address
   */
  public async l2TokenIsDisabled(
    l2TokenAddress: string,
    l2Provider: Provider
  ): Promise<boolean> {
    return this.l3Erc20Bridger.l1TokenIsDisabled(l2TokenAddress, l2Provider)
  }

  /**
   * Given some L2Forwarder parameters, get the address of the L2Forwarder contract
   */
  public async l2ForwarderAddress(
    owner: string,
    routerOrInbox: string,
    to: string,
    l1Provider: Provider
  ): Promise<string> {
    await this._checkL1Network(l1Provider)

    return IL2ForwarderFactory__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Provider
    ).l2ForwarderAddress(owner, routerOrInbox, to)
  }

  /**
   * Get a tx request to approve tokens for teleportation.
   * The tokens will be approved for L1Teleporter.
   */
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

  /**
   * Approve tokens for teleportation.
   * The tokens will be approved for L1Teleporter.
   */
  public async approveToken(
    params:
      | (TokenApproveParams & { l1Signer: Signer; overrides?: Overrides })
      | TxRequestParams
  ): Promise<ethers.ContractTransaction> {
    await this._checkL1Network(params.l1Signer)

    const approveRequest = isTxRequestParams(params)
      ? params.txRequest
      : await this.getApproveTokenRequest(params)

    return params.l1Signer.sendTransaction({
      ...approveRequest,
      ...params.overrides,
    })
  }

  /**
   * Get a tx request to approve the L3's fee token for teleportation.
   * The tokens will be approved for L1Teleporter.
   * Will throw if the L3 network uses ETH for fees or the fee token doesn't exist on L1.
   */
  public async getApproveFeeTokenRequest(params: {
    l1Provider: Provider
    l2Provider: Provider
    amount?: BigNumber
  }): Promise<PickedTransactionRequest> {
    return this.getApproveTokenRequest({
      erc20L1Address: await this._l1FeeTokenAddressOrThrow(
        params.l1Provider,
        params.l2Provider
      ),
      amount: params.amount,
    })
  }

  /**
   * Approve the L3's fee token for teleportation.
   * The tokens will be approved for L1Teleporter.
   * Will throw if the L3 network uses ETH for fees or the fee token doesn't exist on L1.
   */
  public async approveFeeToken(
    params:
      | {
          l1Signer: Signer
          l2Provider: Provider
          amount?: BigNumber
          overrides?: Overrides
        }
      | TxRequestParams
  ): Promise<ethers.ContractTransaction> {
    await this._checkL1Network(params.l1Signer)

    const approveRequest = isTxRequestParams(params)
      ? params.txRequest
      : await this.getApproveFeeTokenRequest({
          l1Provider: params.l1Signer.provider!,
          l2Provider: params.l2Provider,
          amount: params.amount,
        })

    return params.l1Signer.sendTransaction({
      ...approveRequest,
      ...params.overrides,
    })
  }

  /**
   * Get a tx request for teleporting some tokens from L1 to L3.
   */
  public async getDepositRequest(
    params: Erc20DepositRequestParams &
      (
        | {
            from: string
            l1Provider: Provider
          }
        | { l1Signer: Signer }
      )
  ): Promise<DepositRequestResult> {
    const l1Provider = hasL1Signer(params)
      ? params.l1Signer.provider!
      : params.l1Provider
    await this._checkL1Network(l1Provider)
    await this._checkL2Network(params.l2Provider)
    await this._checkL3Network(params.l3Provider)

    const from = hasL1Signer(params)
      ? await params.l1Signer.getAddress()
      : params.from

    const l1FeeToken = await this.l1FeeTokenAddress(
      l1Provider,
      params.l2Provider
    )
    const partialTeleportParams: OmitTyped<
      IL1Teleporter.TeleportParamsStruct,
      'gasParams'
    > = {
      l1Token: params.erc20L1Address,
      l3FeeTokenL1Addr: l1FeeToken || ethers.constants.AddressZero,
      l1l2Router: this.l2Network.tokenBridge.l1GatewayRouter,
      l2l3RouterOrInbox:
        l1FeeToken &&
        getAddress(params.erc20L1Address) === getAddress(l1FeeToken)
          ? this.l3Network.ethBridge.inbox
          : this.l3Network.tokenBridge.l1GatewayRouter,
      to: params.to || from,
      amount: params.amount,
    }

    const { teleportParams, costs } = await this._fillPartialTeleportParams(
      partialTeleportParams,
      params.retryableOverrides || {},
      l1Provider,
      params.l2Provider,
      params.l3Provider
    )

    const data = IL1Teleporter__factory.createInterface().encodeFunctionData(
      'teleport',
      [teleportParams]
    )

    return {
      txRequest: {
        to: this.teleporterAddresses.l1Teleporter,
        data,
        value: costs.ethAmount,
      },
      feeTokenAmount: costs.feeTokenAmount,
    }
  }

  /**
   * Execute a teleportation of some tokens from L1 to L3.
   */
  public async deposit(
    params:
      | (Erc20DepositRequestParams & {
          l1Signer: Signer
          overrides?: PayableOverrides
        })
      | TxRequestParams
  ): Promise<L1ContractCallTransaction> {
    await this._checkL1Network(params.l1Signer)

    const depositRequest = isTxRequestParams(params)
      ? params.txRequest
      : (await this.getDepositRequest(params)).txRequest

    const tx = await params.l1Signer.sendTransaction({
      ...depositRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  /**
   * Fetch the cross chain messages from a teleportation transaction hash
   */
  public async getDepositMessages(
    params: Erc20DepositMessagesParams
  ): Promise<Erc20DepositMessages> {
    await this._checkL1Network(params.l1Provider)
    await this._checkL2Network(params.l2Provider)
    await this._checkL3Network(params.l3Provider)

    const tx = await params.l1Provider.getTransaction(params.txHash)
    const teleportParams = this._decodeTeleportCalldata(tx.data)

    const l1TxReceipt = new L1TransactionReceipt(
      await params.l1Provider.getTransactionReceipt(params.txHash)
    )
    const l1l2Messages = await l1TxReceipt.getL1ToL2Messages(params.l2Provider)

    let partialResult: OmitTyped<
      Erc20DepositMessages,
      'completed' | 'l2l3TokenBridge'
    >

    const type = this.teleportationType(teleportParams)
    if (
      type === TeleportationType.Standard ||
      type === TeleportationType.OnlyFeeToken
    ) {
      partialResult = {
        l1l2TokenBridge: l1l2Messages[0],
        l2ForwarderFactory: l1l2Messages[1],
        l1l2FeeTokenBridge: undefined,
      }
    } else {
      partialResult = {
        l1l2FeeTokenBridge: l1l2Messages[0],
        l1l2TokenBridge: l1l2Messages[1],
        l2ForwarderFactory: l1l2Messages[2],
      }
    }

    const factoryRedeem =
      await partialResult.l2ForwarderFactory.getSuccessfulRedeem()

    const l2l3Message =
      factoryRedeem.status === L1ToL2MessageStatus.REDEEMED
        ? (
            await new L1TransactionReceipt(
              factoryRedeem.l2TxReceipt
            ).getL1ToL2Messages(params.l3Provider)
          )[0]
        : undefined

    return {
      ...partialResult,
      l2l3TokenBridge: l2l3Message,
      completed: (await l2l3Message?.status()) === L1ToL2MessageStatus.REDEEMED,
    }
  }

  /**
   * Get the type of teleportation from the l1Token and l3FeeTokenL1Addr teleport parameters
   */
  public teleportationType(
    partialTeleportParams: Pick<
      IL1Teleporter.TeleportParamsStruct,
      'l3FeeTokenL1Addr' | 'l1Token'
    >
  ) {
    if (
      partialTeleportParams.l3FeeTokenL1Addr === ethers.constants.AddressZero
    ) {
      return TeleportationType.Standard
    } else if (
      getAddress(partialTeleportParams.l1Token) ===
      getAddress(partialTeleportParams.l3FeeTokenL1Addr)
    ) {
      return TeleportationType.OnlyFeeToken
    } else {
      return TeleportationType.NonFeeTokenToCustomFee
    }
  }

  /**
   * Estimate the gasLimit and maxSubmissionFee for a token bridge retryable
   */
  protected async _getTokenBridgeGasEstimates(params: {
    parentProvider: Provider
    childProvider: Provider
    parentGasPrice: BigNumber
    parentErc20Address: string
    parentGatewayAddress: string
    from: string
    to: string
    amount: BigNumber
  }): Promise<RetryableGasValues> {
    const parentGateway = L1GatewayRouter__factory.connect(
      params.parentGatewayAddress,
      params.parentProvider
    )

    const outboundCalldata = await parentGateway.getOutboundCalldata(
      params.parentErc20Address,
      params.from,
      params.to,
      params.amount,
      '0x'
    )

    const estimates = await new L1ToL2MessageGasEstimator(
      params.childProvider
    ).estimateAll(
      {
        to: await parentGateway.counterpartGateway(),
        data: outboundCalldata,
        from: parentGateway.address,
        l2CallValue: BigNumber.from(0),
        excessFeeRefundAddress: params.to,
        callValueRefundAddress: new Address(params.from).applyAlias().value,
      },
      params.parentGasPrice,
      params.parentProvider
    )

    return {
      gasLimit: estimates.gasLimit,
      maxSubmissionFee: estimates.maxSubmissionCost,
    }
  }

  /**
   * Estimate the gasLimit and maxSubmissionFee for the L1 to L2 token bridge leg of a teleportation
   */
  protected async _getL1L2TokenBridgeGasEstimates(params: {
    l1Token: string
    amount: BigNumberish
    l1GasPrice: BigNumber
    l2ForwarderAddress: string
    l1Provider: Provider
    l2Provider: Provider
  }): Promise<RetryableGasValues> {
    return this._getTokenBridgeGasEstimates({
      parentProvider: params.l1Provider,
      childProvider: params.l2Provider,
      parentGasPrice: params.l1GasPrice,
      parentErc20Address: params.l1Token,
      parentGatewayAddress: await this.getL1L2GatewayAddress(
        params.l1Token,
        params.l1Provider
      ),
      from: this.teleporterAddresses.l1Teleporter,
      to: params.l2ForwarderAddress,
      amount: BigNumber.from(params.amount),
    })
  }

  /**
   * Estimate the gasLimit and maxSubmissionFee for the L1 to L2 fee token bridge leg of a teleportation
   */
  protected async _getL1L2FeeTokenBridgeGasEstimates(params: {
    l1GasPrice: BigNumber
    feeTokenAmount: BigNumber
    l2ForwarderAddress: string
    l1Provider: Provider
    l2Provider: Provider
  }): Promise<RetryableGasValues> {
    const l1FeeTokenAddress = await this._l1FeeTokenAddressOrThrow(
      params.l1Provider,
      params.l2Provider
    )
    return this._getTokenBridgeGasEstimates({
      parentProvider: params.l1Provider,
      childProvider: params.l2Provider,
      parentGasPrice: params.l1GasPrice,
      parentErc20Address: l1FeeTokenAddress,
      parentGatewayAddress: await this.getL1L2GatewayAddress(
        l1FeeTokenAddress,
        params.l1Provider
      ),
      from: this.teleporterAddresses.l1Teleporter,
      to: params.l2ForwarderAddress,
      amount: params.feeTokenAmount,
    })
  }

  /**
   * Estimate the gasLimit and maxSubmissionFee for L2ForwarderFactory.callForwarder leg of a teleportation.
   * Gas limit is hardcoded to 1,000,000
   */
  protected async _getL2ForwarderFactoryGasEstimates(
    l1GasPrice: BigNumber,
    l1Provider: Provider
  ): Promise<RetryableGasValues> {
    const inbox = Inbox__factory.connect(
      this.l2Network.ethBridge.inbox,
      l1Provider
    )
    const maxSubmissionFee = await inbox.calculateRetryableSubmissionFee(
      this._l2ForwarderFactoryCalldataSize(),
      l1GasPrice
    )

    return {
      gasLimit: this.l2ForwarderFactoryDefaultGasLimit,
      maxSubmissionFee,
    }
  }

  /**
   * Estimate the gasLimit and maxSubmissionFee for the L2 -> L3 leg of a teleportation.
   */
  protected async _getL2L3BridgeGasEstimates(params: {
    partialTeleportParams: OmitTyped<
      IL1Teleporter.TeleportParamsStruct,
      'gasParams'
    >
    l2GasPrice: BigNumber
    l1Provider: Provider
    l2Provider: Provider
    l3Provider: Provider
    l2ForwarderAddress: string
  }): Promise<RetryableGasValues> {
    if (
      this.teleportationType(params.partialTeleportParams) ===
      TeleportationType.OnlyFeeToken
    ) {
      // we are bridging the fee token to l3, this will not go through the l2l3 token bridge, instead it's just a regular retryable
      const estimate = await new L1ToL2MessageGasEstimator(
        params.l3Provider
      ).estimateAll(
        {
          to: params.partialTeleportParams.to,
          data: '0x',
          from: params.l2ForwarderAddress,
          // l2CallValue will be amount less the fees in reality
          l2CallValue: BigNumber.from(params.partialTeleportParams.amount),
          excessFeeRefundAddress: params.partialTeleportParams.to,
          callValueRefundAddress: params.partialTeleportParams.to,
        },
        params.l2GasPrice,
        params.l2Provider
      )
      return {
        gasLimit: estimate.gasLimit,
        maxSubmissionFee: estimate.maxSubmissionCost,
      }
    } else {
      // we are bridging a non fee token to l3, this will go through the token bridge
      return this._getTokenBridgeGasEstimates({
        parentProvider: params.l2Provider,
        childProvider: params.l3Provider,
        parentGasPrice: params.l2GasPrice,
        parentErc20Address: await this.getL2ERC20Address(
          params.partialTeleportParams.l1Token,
          params.l1Provider
        ),
        parentGatewayAddress: await this.getL2L3GatewayAddress(
          params.partialTeleportParams.l1Token,
          params.l1Provider,
          params.l2Provider
        ),
        from: params.l2ForwarderAddress,
        to: params.partialTeleportParams.to,
        amount: BigNumber.from(params.partialTeleportParams.amount),
      })
    }
  }

  /**
   * Given TeleportParams without the gas parameters, return TeleportParams with gas parameters populated.
   * Does not modify the input parameters.
   */
  protected async _fillPartialTeleportParams(
    partialTeleportParams: OmitTyped<
      IL1Teleporter.TeleportParamsStruct,
      'gasParams'
    >,
    retryableOverrides: Erc20DepositRequestRetryableOverrides,
    l1Provider: Provider,
    l2Provider: Provider,
    l3Provider: Provider
  ) {
    // get gasLimit and submission cost for a retryable while respecting overrides
    const getRetryableGasValuesWithOverrides = async (
      overrides: TeleporterRetryableGasOverride | undefined,
      getValues: () => Promise<RetryableGasValues>
    ): Promise<RetryableGasValues> => {
      let base: RetryableGasValues
      if (overrides?.gasLimit?.base && overrides?.maxSubmissionFee?.base) {
        base = {
          gasLimit: overrides.gasLimit.base,
          maxSubmissionFee: overrides.maxSubmissionFee.base,
        }
      } else {
        const calculated = await getValues()
        base = {
          gasLimit: overrides?.gasLimit?.base || calculated.gasLimit,
          maxSubmissionFee:
            overrides?.maxSubmissionFee?.base || calculated.maxSubmissionFee,
        }
      }

      const gasLimit = this._percentIncrease(
        base.gasLimit,
        overrides?.gasLimit?.percentIncrease ||
          this.defaultGasLimitPercentIncrease
      )
      const submissionFee = this._percentIncrease(
        base.maxSubmissionFee,
        overrides?.maxSubmissionFee?.percentIncrease || BigNumber.from(0)
      )

      const minGasLimit = overrides?.gasLimit?.min || BigNumber.from(0)
      return {
        gasLimit: gasLimit.gt(minGasLimit) ? gasLimit : minGasLimit,
        maxSubmissionFee: submissionFee,
      }
    }

    // get gas price while respecting overrides
    const applyGasPercentIncrease = async (
      overrides: PercentIncrease | undefined,
      getValue: () => Promise<BigNumber>
    ) => {
      return this._percentIncrease(
        overrides?.base || (await getValue()),
        overrides?.percentIncrease || this.defaultGasPricePercentIncrease
      )
    }

    const l1GasPrice = await applyGasPercentIncrease(
      retryableOverrides.l1GasPrice,
      () => l1Provider.getGasPrice()
    )
    const l2GasPrice = await applyGasPercentIncrease(
      retryableOverrides.l2GasPrice,
      () => l2Provider.getGasPrice()
    )
    const l3GasPrice = await applyGasPercentIncrease(
      retryableOverrides.l3GasPrice,
      () => l3Provider.getGasPrice()
    )

    const fakeRandomL2Forwarder = ethers.utils.hexlify(
      ethers.utils.randomBytes(20)
    )

    const l1l2TokenBridgeGasValues = await getRetryableGasValuesWithOverrides(
      retryableOverrides.l1l2TokenBridgeRetryableGas,
      () =>
        this._getL1L2TokenBridgeGasEstimates({
          l1Token: partialTeleportParams.l1Token,
          amount: partialTeleportParams.amount,
          l1GasPrice,
          l2ForwarderAddress: fakeRandomL2Forwarder,
          l1Provider,
          l2Provider,
        })
    )

    const l2ForwarderFactoryGasValues =
      await getRetryableGasValuesWithOverrides(
        retryableOverrides.l2ForwarderFactoryRetryableGas,
        () => this._getL2ForwarderFactoryGasEstimates(l1GasPrice, l1Provider)
      )

    const l2l3TokenBridgeGasValues = await getRetryableGasValuesWithOverrides(
      retryableOverrides.l2l3TokenBridgeRetryableGas,
      () =>
        this._getL2L3BridgeGasEstimates({
          partialTeleportParams,
          l2GasPrice,
          l1Provider,
          l2Provider,
          l3Provider,
          l2ForwarderAddress: fakeRandomL2Forwarder,
        })
    )

    let l1l2FeeTokenBridgeGasValues: RetryableGasValues
    if (
      this.teleportationType(partialTeleportParams) ===
      TeleportationType.NonFeeTokenToCustomFee
    ) {
      l1l2FeeTokenBridgeGasValues = await getRetryableGasValuesWithOverrides(
        retryableOverrides.l1l2FeeTokenBridgeRetryableGas,
        () =>
          this._getL1L2FeeTokenBridgeGasEstimates({
            l1GasPrice,
            feeTokenAmount: l2l3TokenBridgeGasValues.gasLimit
              .mul(l3GasPrice)
              .add(l2l3TokenBridgeGasValues.maxSubmissionFee),
            l2ForwarderAddress: fakeRandomL2Forwarder,
            l1Provider,
            l2Provider,
          })
      )
    } else {
      // eth fee l3, or only bridging fee token. this retryable will not be created
      l1l2FeeTokenBridgeGasValues = {
        gasLimit: BigNumber.from(0),
        maxSubmissionFee: BigNumber.from(0),
      }
    }

    const gasParams: IL1Teleporter.RetryableGasParamsStruct = {
      l2GasPriceBid: l2GasPrice,
      l3GasPriceBid: l3GasPrice,
      l1l2TokenBridgeGasLimit: l1l2TokenBridgeGasValues.gasLimit,
      l1l2FeeTokenBridgeGasLimit: l1l2FeeTokenBridgeGasValues.gasLimit,
      l2l3TokenBridgeGasLimit: l2l3TokenBridgeGasValues.gasLimit,
      l2ForwarderFactoryGasLimit: l2ForwarderFactoryGasValues.gasLimit,
      l2ForwarderFactoryMaxSubmissionCost:
        l2ForwarderFactoryGasValues.maxSubmissionFee,
      l1l2TokenBridgeMaxSubmissionCost:
        l1l2TokenBridgeGasValues.maxSubmissionFee,
      l1l2FeeTokenBridgeMaxSubmissionCost:
        l1l2FeeTokenBridgeGasValues.maxSubmissionFee,
      l2l3TokenBridgeMaxSubmissionCost:
        l2l3TokenBridgeGasValues.maxSubmissionFee,
    }

    const teleportParams = {
      ...partialTeleportParams,
      gasParams,
    }

    const costs = await IL1Teleporter__factory.connect(
      this.teleporterAddresses.l1Teleporter,
      l1Provider
    ).determineTypeAndFees(teleportParams)

    return {
      teleportParams,
      costs,
    }
  }

  /**
   * @returns The size of the calldata for a call to L2ForwarderFactory.callForwarder
   */
  protected _l2ForwarderFactoryCalldataSize() {
    const struct: IL2Forwarder.L2ForwarderParamsStruct = {
      owner: ethers.constants.AddressZero,
      l2Token: ethers.constants.AddressZero,
      l3FeeTokenL2Addr: ethers.constants.AddressZero,
      routerOrInbox: ethers.constants.AddressZero,
      to: ethers.constants.AddressZero,
      gasLimit: 0,
      gasPriceBid: 0,
      maxSubmissionCost: 0,
    }
    const dummyCalldata =
      IL2ForwarderFactory__factory.createInterface().encodeFunctionData(
        'callForwarder',
        [struct]
      )
    return ethers.utils.hexDataLength(dummyCalldata) - 4
  }

  /**
   * Get the L1 address of the L3's fee token, or if there isn't one throw.
   */
  protected async _l1FeeTokenAddressOrThrow(
    l1Provider: Provider,
    l2Provider: Provider
  ) {
    const ft = await this.l1FeeTokenAddress(l1Provider, l2Provider)
    if (!ft)
      throw new Error(`L3 network ${this.l3Network.name} uses ETH for fees`)
    return ft
  }

  /**
   * Given raw calldata for a teleport tx, decode the teleport parameters
   */
  protected _decodeTeleportCalldata(
    data: string
  ): IL1Teleporter.TeleportParamsStruct {
    const iface = IL1Teleporter__factory.createInterface()
    const decoded = iface.parseTransaction({ data })
    if (decoded.functionFragment.name !== 'teleport') {
      throw new ArbSdkError(`not a teleport tx`)
    }
    return decoded.args[0]
  }
}

/**
 * Bridge ETH from L1 to L3 using a double retryable ticket
 */
export class EthL1L3Bridger extends BaseL1L3Bridger {
  constructor(l3Network: L2Network) {
    super(l3Network)

    if (
      l3Network.nativeToken &&
      l3Network.nativeToken !== ethers.constants.AddressZero
    ) {
      throw new ArbSdkError(
        `L3 network ${l3Network.name} uses a custom fee token`
      )
    }
  }

  /**
   * Get a tx request to deposit ETH to L3 via a double retryable ticket
   */
  public async getDepositRequest(
    params: EthDepositRequestParams &
      (
        | {
            from: string
            l1Provider: Provider
          }
        | { l1Signer: Signer }
      )
  ): Promise<L1ToL2TransactionRequest> {
    const l1Provider = hasL1Signer(params)
      ? params.l1Signer.provider!
      : params.l1Provider
    await this._checkL1Network(l1Provider)
    await this._checkL2Network(params.l2Provider)
    await this._checkL3Network(params.l3Provider)

    const from = hasL1Signer(params)
      ? await params.l1Signer.getAddress()
      : params.from

    const l3DestinationAddress = params.to || from
    const l2RefundAddress = params.l2RefundAddress || from

    const l3TicketRequest = await L1ToL2MessageCreator.getTicketCreationRequest(
      {
        to: l3DestinationAddress,
        data: '0x',
        from: new Address(from).applyAlias().value,
        l2CallValue: BigNumber.from(params.amount),
        excessFeeRefundAddress: l3DestinationAddress,
        callValueRefundAddress: l3DestinationAddress,
      },
      params.l2Provider,
      params.l3Provider,
      params.l3TicketGasOverrides
    )

    const l2TicketRequest = await L1ToL2MessageCreator.getTicketCreationRequest(
      {
        from,
        to: l3TicketRequest.txRequest.to,
        l2CallValue: BigNumber.from(l3TicketRequest.txRequest.value),
        data: ethers.utils.hexlify(l3TicketRequest.txRequest.data),
        excessFeeRefundAddress: l2RefundAddress,
        callValueRefundAddress: l2RefundAddress,
      },
      l1Provider,
      params.l2Provider,
      params.l2TicketGasOverrides
    )

    return l2TicketRequest
  }

  /**
   * Deposit ETH to L3 via a double retryable ticket
   */
  public async deposit(
    params:
      | (EthDepositRequestParams & {
          l1Signer: Signer
          overrides?: PayableOverrides
        })
      | TxRequestParams
  ): Promise<L1ContractCallTransaction> {
    await this._checkL1Network(params.l1Signer)

    const depositRequest = isTxRequestParams(params)
      ? params.txRequest
      : (await this.getDepositRequest(params)).txRequest

    const tx = await params.l1Signer.sendTransaction({
      ...depositRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  /**
   * Get the status of a deposit given an L1 tx receipt. Does not check if the tx is actually a deposit tx.
   *
   * @return Information regarding each step of the deposit
   * and `EthDepositStatus.completed` which indicates whether the deposit has fully completed.
   */
  public async getDepositMessages(params: {
    l1TxReceipt: L1ContractCallTransactionReceipt
    l2Provider: Provider
    l3Provider: Provider
  }): Promise<EthDepositStatus> {
    await this._checkL2Network(params.l2Provider)
    await this._checkL3Network(params.l3Provider)

    const l1l2Message = (
      await params.l1TxReceipt.getL1ToL2Messages(params.l2Provider)
    )[0]
    const l1l2Redeem = await l1l2Message.getSuccessfulRedeem()

    if (l1l2Redeem.status != L1ToL2MessageStatus.REDEEMED) {
      return {
        l2Retryable: l1l2Message,
        l3Retryable: undefined,
        completed: false,
      }
    }

    const l2l3Message = (
      await new L1EthDepositTransactionReceipt(
        l1l2Redeem.l2TxReceipt
      ).getL1ToL2Messages(params.l3Provider)
    )[0]

    if (l2l3Message === undefined) {
      throw new ArbSdkError(`L2 to L3 message not found`)
    }

    return {
      l2Retryable: l1l2Message,
      l3Retryable: l2l3Message,
      completed: (await l2l3Message.status()) === L1ToL2MessageStatus.REDEEMED,
    }
  }
}
