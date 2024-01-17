import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, BigNumberish, Signer, ethers } from 'ethers'
import { IERC20 } from '../abi/IERC20'
import { BridgedToL3Event } from '../abi/L2Forwarder'
import { L2ForwarderPredictor } from '../abi/L2ForwarderPredictor'
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
import { L1ToL2TransactionRequest } from '../dataEntities/transactionRequest'
import {
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from '../message/L1ToL2Message'
import { L1ToL2MessageCreator } from '../message/L1ToL2MessageCreator'
import {
  GasOverrides,
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
import { Erc20Bridger, TokenApproveParams } from './erc20Bridger'
import { L2ForwarderPredictor__factory } from '../abi/factories/L2ForwarderPredictor__factory'
import { AbiCoder } from 'ethers/lib/utils'
import { NODE_INTERFACE_ADDRESS } from '../dataEntities/constants'
import { NodeInterface__factory } from '../abi/factories/NodeInterface__factory'

/**
 * Manual gas parameters for the L1 to L2 and L2 to L3 tickets.
 * Percent increase is not applied to these values.
 */
export type ManualRetryableGasParams = {
  /**
   * Gas limit for the L2ForwarderFactory contract call
   */
  l2ForwarderFactoryGasLimit: BigNumber
  /**
   * Gas limit for the L1 to L2 token bridge ticket redemption
   */
  l1l2TokenBridgeGasLimit: BigNumber
  /**
   * Gas limit for the L2 to L3 token bridge ticket redemption
   */
  l2l3TokenBridgeGasLimit: BigNumber
  /**
   * Calldata size of the L1 to L2 token bridge ticket
   */
  l1l2TokenBridgeRetryableSize: BigNumber
  /**
   * Calldata size of the L2 to L3 token bridge ticket
   */
  l2l3TokenBridgeRetryableSize: BigNumber
}

export type BaseErc20DepositRequestParamsGasOverrides = {
  /**
   * Optional L2 gas price override
   */
  l2GasPrice?: PercentIncrease
  /**
   * Optional L3 gas price override
   */
  l3GasPrice?: PercentIncrease
  /**
   * Optional manual gas params override. Not optional if the L1 to L2 or L2 to L3 gateways are not the default gateways.
   */
  manualGasParams?: ManualRetryableGasParams
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
   * Optional recipient on L3, defaults to signer's address
   */
  to?: string
  /**
   * Optional overrides for retryable gas parameters
   */
  overrides?: BaseErc20DepositRequestParamsGasOverrides & {
    /**
     * Optional L1 gas price override. Used to estimate submission fees.
     */
    l1GasPrice?: PercentIncrease
  }
}

export type RelayedErc20DepositRequestParams = Erc20DepositRequestParams & {
  /**
   * Optional overrides for retryable gas parameters, relayer payment and L2Forwarder owner
   */
  overrides?: BaseErc20DepositRequestParamsGasOverrides & {
    /**
     * Optional relayer payment override
     */
    relayerPayment?: PercentIncrease
    /**
     * Optional L2Forwarder owner override. This L2 account is able to make arbitrary calls from the L2Forwarder in order to rescue funds.
     */
    l2ForwarderOwner?: string
  }
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

type BaseErc20DepositStatus = {
  /**
   * Status + redemption tx receipt of the token bridge to L2
   */
  bridgeToL2: L1ToL2MessageWaitResult
  /**
   * Tx receipt of the call to the L2Forwarder contract
   */
  l2ForwarderCall: L1ContractCallTransactionReceipt | undefined
  /**
   * Status + redemption tx receipt of the token bridge to L3
   */
  bridgeToL3: L1ToL2MessageWaitResult
  /**
   * Whether the teleportation has completed
   */
  completed: boolean
}

/**
 * When using the L1Teleporter the second step is a retryable tx, so this type includes the status of that tx as well as the base type's `l2ForwarderCall`.
 * This is because the retryable could possibly be frontrun and the teleportation will still succeed.
 */
export type Erc20DepositStatus = BaseErc20DepositStatus & {
  /**
   * The status + redemption tx receipt of the retryable to call the L2Forwarder contract
   */
  retryableL2ForwarderCall: L1ToL2MessageWaitResult
}

export type RelayedErc20DepositStatus = BaseErc20DepositStatus

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
 * Information required by a relayer to relay a deposit.
 *
 * This information is also required to rescue funds from the L2Forwarder contract.
 */
export type RelayerInfo = L2ForwarderPredictor.L2ForwarderParamsStruct & {
  chainId: number
}

export type RelayedErc20DepositRequestResult = {
  /**
   * The transaction request to deposit ERC20 tokens to L3 using a relayer
   */
  txRequest: L1ToL2TransactionRequest
  /**
   * Information required by the relayer to forward tokens from L2 to L3
   */
  relayerInfo: RelayerInfo
}

/**
 * Return type for `RelayedErc20L1L3Bridger.deposit`. Includes the transaction as well as relayer info.
 */
export type RelayedErc20DepositResult = {
  /**
   * The transaction that was sent to deposit ERC20 tokens to L3 using a relayer
   */
  tx: L1ContractCallTransaction
  /**
   * Information required by the relayer to forward tokens from L2 to L3
   */
  relayerInfo: RelayerInfo
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
 * Base functionality for bridging ERC20 tokens from L1 to L3.
 */
class BaseErc20L1L3Bridger extends BaseL1L3Bridger {
  public readonly teleporterAddresses: TeleporterAddresses

  protected readonly l2Erc20Bridger = new Erc20Bridger(this.l2Network)
  protected readonly l3Erc20Bridger = new Erc20Bridger(this.l3Network)

  public readonly defaultRetryableGasParams: ManualRetryableGasParams = {
    l2ForwarderFactoryGasLimit: BigNumber.from(500_000), // measured: 357,751 L2 Gas
    l1l2TokenBridgeGasLimit: BigNumber.from(700_000), // measured: 531,744 L2 Gas
    l2l3TokenBridgeGasLimit: BigNumber.from(700_000), // measured: 531,756 L2 Gas
    l1l2TokenBridgeRetryableSize: BigNumber.from(1000), // measured: 740. includes variable length information like token symbol
    l2l3TokenBridgeRetryableSize: BigNumber.from(1000), // measured: 740. includes variable length information like token symbol
  } as const

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
   * Whether the L1 <-> L2 gateway is the default gateway given an L1 token address
   */
  public async isL1L2GatewayDefault(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<boolean> {
    const gateway = await this.getL1L2GatewayAddress(erc20L1Address, l1Provider)
    return gateway === this.l2Network.tokenBridge.l1ERC20Gateway
  }

  /**
   * Whether the L2 <-> L3 gateway is the default gateway given an L1 token address
   */
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
   * Given L2Forwarder parameters, get the address of the L2Forwarder contract
   */
  public async l2ForwarderAddress(
    params: L2ForwarderPredictor.L2ForwarderParamsStruct,
    l2Provider: Provider
  ): Promise<string> {
    await this._checkL2Network(l2Provider)

    return L2ForwarderFactory__factory.connect(
      this.teleporterAddresses.l2ForwarderFactory,
      l2Provider
    ).l2ForwarderAddress(params)
  }

  /**
   * Given a parent network token bridge deposit transaction receipt, get the recipient address on the child network
   */
  public getRecipientFromParentBridgeTx(
    depositTxReceipt: L1ContractCallTransactionReceipt
  ) {
    const iface = L1GatewayRouter__factory.createInterface()
    const topic0 = iface.getEventTopic('TransferRouted')
    const log = depositTxReceipt.logs.find(x => x.topics[0] === topic0)

    if (!log) {
      throw new ArbSdkError(`Could not find TransferRouted event in tx receipt`)
    }

    return iface.parseLog(log).args._userTo
  }

  /**
   * Get the status of a deposit given an L1 tx receipt.
   *
   * Note: This function does not verify that the tx is actually a deposit tx.
   */
  protected async _getDepositStatus(
    depositTxReceipt: L1ContractCallTransactionReceipt,
    l2Provider: JsonRpcProvider,
    l3Provider: Provider
  ): Promise<BaseErc20DepositStatus> {
    await this._checkL2Network(l2Provider)
    await this._checkL3Network(l3Provider)

    const l1l2Messages = await depositTxReceipt.getL1ToL2Messages(l2Provider)
    const firstStepRedeem = await l1l2Messages[0].getSuccessfulRedeem()

    if (firstStepRedeem.status !== L1ToL2MessageStatus.REDEEMED) {
      return {
        bridgeToL2: firstStepRedeem,
        l2ForwarderCall: undefined,
        bridgeToL3: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    // see if there are any calls to the l2 forwarder after the first step redeem
    const bridgedToL3Event = await this._findBridgedToL3Event(
      this.getRecipientFromParentBridgeTx(depositTxReceipt),
      firstStepRedeem.l2TxReceipt.blockNumber,
      l2Provider
    )

    // second step has not completed
    if (!bridgedToL3Event) {
      return {
        bridgeToL2: firstStepRedeem,
        l2ForwarderCall: undefined,
        bridgeToL3: { status: L1ToL2MessageStatus.NOT_YET_CREATED },
        completed: false,
      }
    }

    // second step has completed
    const secondStepTxReceipt = new L1ContractCallTransactionReceipt(
      await l2Provider.getTransactionReceipt(bridgedToL3Event.transactionHash)
    )

    const thirdStepMessage = (
      await secondStepTxReceipt.getL1ToL2Messages(l3Provider)
    )[0]

    const thirdStepRedeem = await thirdStepMessage.getSuccessfulRedeem()

    return {
      bridgeToL2: firstStepRedeem,
      l2ForwarderCall: secondStepTxReceipt,
      bridgeToL3: thirdStepRedeem,
      completed: thirdStepRedeem.status === L1ToL2MessageStatus.REDEEMED,
    }
  }

  /**
   * Given a ERC20 deposit request parameters, return the gas params with default values if not provided
   */
  protected async _populateGasParams(
    params: Erc20DepositRequestParams,
    l1Provider: Provider,
    l2Provider: Provider,
    l3Provider: Provider
  ): Promise<L1Teleporter.RetryableGasParamsStruct> {
    let manualGasParams = params.overrides?.manualGasParams
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
        params.overrides?.l2GasPrice?.base || (await l2Provider.getGasPrice()),
        params.overrides?.l2GasPrice?.percentIncrease ||
          this.defaultGasPricePercentIncrease
      ),
      l3GasPrice: this._percentIncrease(
        params.overrides?.l3GasPrice?.base || (await l3Provider.getGasPrice()),
        params.overrides?.l3GasPrice?.percentIncrease ||
          this.defaultGasPricePercentIncrease
      ),
    }
  }

  /**
   * Find the first BridgedToL3 event emitted by the L2Forwarder contract after the provided block number
   */
  protected async _findBridgedToL3Event(
    l2ForwarderAddress: string,
    fromL2Block: number,
    l2Provider: JsonRpcProvider
  ): Promise<FetchedEvent<BridgedToL3Event> | undefined> {
    const latest = await l2Provider.getBlockNumber()
    const eventFetcher = new EventFetcher(l2Provider)

    const events = await eventFetcher.getEvents(
      L2Forwarder__factory,
      contract => contract.filters.BridgedToL3(),
      { address: l2ForwarderAddress, fromBlock: fromL2Block, toBlock: latest }
    )

    return events[0]
  }

  protected async _getApproveTokenRequest(
    params: TokenApproveParams,
    spender: string
  ) {
    const iErc20Interface = IERC20__factory.createInterface()
    const data = iErc20Interface.encodeFunctionData('approve', [
      spender,
      params.amount || ethers.constants.MaxUint256,
    ])

    return {
      to: params.erc20L1Address,
      data,
    }
  }
}

/**
 * Bridge ERC20 tokens from L1 to L3 using the L1Teleporter contract.
 */
export class Erc20L1L3Bridger extends BaseErc20L1L3Bridger {
  /**
   * Get a tx request to approve tokens for teleportation.
   * The tokens will be approved to be spent by the L1Teleporter.
   */
  public async getApproveTokenRequest(
    params: TokenApproveParams
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data'>>> {
    return this._getApproveTokenRequest(
      params,
      this.teleporterAddresses.l1Teleporter
    )
  }

  /**
   * Approve tokens for teleportation. The tokens will be approved to be spent by the `L1Teleporter`
   */
  public async approveToken(
    params: TokenApproveParams,
    l1Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    await this._checkL1Network(l1Signer)

    const approveRequest = await this.getApproveTokenRequest(params)

    return l1Signer.sendTransaction(approveRequest)
  }

  /**
   * Get a tx request to deposit tokens to L3 through the L1Teleporter contract.
   */
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

    const teleporter = L1Teleporter__factory.connect(
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
      },
    ])

    const adjustedL1GasPrice = this._percentIncrease(
      params.overrides?.l1GasPrice?.base ||
        (await l1Signer.provider!.getGasPrice()),
      params.overrides?.l1GasPrice?.percentIncrease ||
        this.defaultGasPricePercentIncrease
    )

    const calculatedGasCosts = await teleporter.calculateRetryableGasCosts(
      this.l2Network.ethBridge.inbox,
      adjustedL1GasPrice,
      gasParams
    )

    return {
      to: this.teleporterAddresses.l1Teleporter,
      data: calldata,
      value: calculatedGasCosts.total,
    }
  }

  /**
   * Deposit tokens to L3 through the L1Teleporter contract.
   */
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

    return this.executeDepositRequest(txRequest, l1Signer)
  }

  /**
   * Execute a deposit request to L3 through the L1Teleporter contract.
   */
  public async executeDepositRequest(
    depositRequest: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>,
    l1Signer: Signer
  ): Promise<L1ContractCallTransaction> {
    return L1TransactionReceipt.monkeyPatchContractCallWait(
      await l1Signer.sendTransaction(depositRequest)
    )
  }

  /**
   * Get the status of a deposit given an L1 tx receipt. See `Erc20DepositStatus` interface for more info on the return type.
   *
   * Note: This function does not verify that the tx is actually a deposit tx.
   * 
   * @return Information regarding each step of the deposit 
   * and `Erc20DepositStatus.completed` which indicates whether the deposit has fully completed.
   * 
   * If `Erc20DepositStatus.bridgeToL2.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the first step has failed (the token bridge to L2).
   * The first retryable to L2 must be manually redeemed before proceeding.
   * 
   * If `Erc20DepositStatus.l2ForwarderCall` is `undefined` 
   * AND `Erc20DepositStatus.retryableL2ForwarderCall.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the second step has failed (the call to the `L2Forwarder` contract). 
   * The second retryable to L2 must be manually redeemed or the `L2Forwarder` must be called manually before proceeding.
   * Note that if the `L2Forwarder` is called manually, then the second retryable to L2 will remain unredeemed.
   * 
   * It is possible that the second retryable to L2 is not redeemed but `Erc20DepositStatus.l2ForwarderCall` is defined.
   * In this case the teleportation flow can proceed but the second retryable to L2 will remain unredeemed.
   * 
   * If the call to the `L2Forwarder` cannot succeed (due to bad parameters for example), 
   * then the forwarder's owner can call `L2Forwarder.rescue` to recover the funds.
   * The owner of the `L2Forwarder` is the signer's aliased address by default.
   * 
   * If `Erc20DepositStatus.bridgeToL3.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the third step has failed (the token bridge to L3).
   * The retryable to L3 must be manually redeemed.
   */
  public async getDepositStatus(
    depositTxReceipt: L1ContractCallTransactionReceipt,
    l2Provider: JsonRpcProvider,
    l3Provider: Provider
  ): Promise<Erc20DepositStatus> {
    const baseStatus = await this._getDepositStatus(
      depositTxReceipt,
      l2Provider,
      l3Provider
    )

    const secondStepRetryableRedeem = await (
      await depositTxReceipt.getL1ToL2Messages(l2Provider)
    )[1].getSuccessfulRedeem()

    return {
      ...baseStatus,
      retryableL2ForwarderCall: secondStepRetryableRedeem,
    }
  }
}

/**
 * Bridge ERC20 tokens from L1 to L3 directly through the token bridge, using a relayer on L2 to call the L2Forwarder contract.
 */
export class RelayedErc20L1L3Bridger extends BaseErc20L1L3Bridger {
  /**
   * The default percent increase for the relayer payment
   */
  public readonly defaultRelayerPaymentPercentIncrease: BigNumber =
    BigNumber.from(30)

  /**
   * Get a tx request to approve tokens for teleportation. Will approve the token's L1 gateway to spend the provided amount.
   */
  public async getApproveTokenRequest(
    params: TokenApproveParams,
    l1Provider: Provider
  ): Promise<Required<Pick<TransactionRequest, 'to' | 'data'>>> {
    return this._getApproveTokenRequest(
      params,
      await this.getL1L2GatewayAddress(params.erc20L1Address, l1Provider)
    )
  }

  /**
   * Approve tokens for teleportation. Will approve the token's L1 gateway to spend the provided amount.
   */
  public async approveToken(
    params: TokenApproveParams,
    l1Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    return l1Signer.sendTransaction(
      await this.getApproveTokenRequest(params, l1Signer.provider!)
    )
  }

  /**
   * Get a tx request to deposit tokens to L3. Will call the `L1GatewayRouter` directly.
   * 
   * It is important to specify `params.overrides.l2ForwarderOwner` if signer is not an EOA.
   * Failure to set an appropriate owner could result in loss of funds.
   *
   * Relayer info will be returned as well as appended to calldata.
   */
  public async getDepositRequest(
    params: RelayedErc20DepositRequestParams,
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
      params.overrides?.relayerPayment?.base ||
        BigNumber.from(populatedGasParams.l2ForwarderFactoryGasLimit)
          .add(await this._estimateL1GasForL2ForwarderCall(l2Provider))
          .mul(populatedGasParams.l2GasPrice),
      params.overrides?.relayerPayment?.percentIncrease ||
        this.defaultRelayerPaymentPercentIncrease
    )

    const l2ForwarderParams: L2ForwarderPredictor.L2ForwarderParamsStruct = {
      owner:
        params.overrides?.l2ForwarderOwner || (await l1Signer.getAddress()),
      token: await this.getL2ERC20Address(
        params.erc20L1Address,
        l1Signer.provider!
      ),
      router: this.l3Network.tokenBridge.l1GatewayRouter,
      to: params.to || (await l1Signer.getAddress()),
      gasLimit: populatedGasParams.l2l3TokenBridgeGasLimit,
      gasPrice: populatedGasParams.l3GasPrice,
      relayerPayment,
    }

    // figure out how much extra ETH we should pass along through the token bridge
    // _populateGasParams has already applied a percent increase to gas prices
    const teleporter = L1Teleporter__factory.connect(
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

    const l2ForwarderAddress = await this.l2ForwarderAddress(
      l2ForwarderParams,
      l2Provider
    )

    // parameters cfor Erc20Bridger.getDepositRequest
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

    const submissionCostBefore = (
      await this.l2Erc20Bridger.getDepositRequest(baseDepositRequestParams)
    ).retryableData.maxSubmissionCost
    const tokenBridgeRequest = await this.l2Erc20Bridger.getDepositRequest({
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

    // append forwarder params to calldata
    const encodedForwarderParamsWithSelector =
      L2ForwarderPredictor__factory.createInterface().encodeFunctionData(
        'l2ForwarderAddress',
        [l2ForwarderParams]
      )
    // strip selector and add to tx data
    tokenBridgeRequest.txRequest.data = ethers.utils.concat([
      tokenBridgeRequest.txRequest.data,
      ethers.utils.hexDataSlice(encodedForwarderParamsWithSelector, 4),
    ])

    return {
      relayerInfo: {
        ...l2ForwarderParams,
        chainId: this.l2Network.chainID,
      },
      txRequest: tokenBridgeRequest,
    }
  }

  /**
   * Deposit tokens to L3. Will call the `L1GatewayRouter` directly.
   *
   * Relayer info will be returned as well as appended to calldata.
   */
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

    return this.executeDepositRequest(depositRequest, l1Signer)
  }

  /**
   * Execute the result of `getDepositRequest` to deposit tokens to L3. Will call the `L1GatewayRouter` directly.
   *
   * Relayer info will be returned as well as appended to calldata.
   */
  public async executeDepositRequest(
    depositRequest: RelayedErc20DepositRequestResult,
    l1Signer: Signer
  ): Promise<RelayedErc20DepositResult> {
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
   * Note: This function does not verify that the tx is actually a deposit tx.
   * 
   * @return Information regarding each step of the deposit 
   * and `Erc20DepositStatus.completed` which indicates whether the deposit has fully completed.
   * 
   * If `Erc20DepositStatus.bridgeToL2.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the first step has failed (the token bridge to L2).
   * The first retryable to L2 must be manually redeemed before proceeding.
   * 
   * If `Erc20DepositStatus.l2ForwarderCall` is `undefined`,
   * then the second step has not yet been executed (the call to the `L2Forwarder` contract).
   * The `L2Forwarder` must be called before proceeding.
   * 
   * If the call to the `L2Forwarder` cannot succeed (due to bad parameters for example), 
   * then the forwarder's owner can call `L2Forwarder.rescue` to recover the funds.
   * The owner of the `L2Forwarder` is the signer's address by default.
   * 
   * If `Erc20DepositStatus.bridgeToL3.status` is `L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2`,
   * then the third step has failed (the token bridge to L3).
   * the third retryable to L3 must be manually redeemed.
   */
  public getDepositStatus(
    depositTxReceipt: L1ContractCallTransactionReceipt,
    l2Provider: JsonRpcProvider,
    l3Provider: Provider
  ): Promise<RelayedErc20DepositStatus> {
    return this._getDepositStatus(depositTxReceipt, l2Provider, l3Provider)
  }

  /**
   * Parse relayer info from a transaction. If the transaction was created using this class, then the relayer info is appended to the calldata.
   * To determine L2 chain id, 'to' is assumed to be the L1GatewayRouter. All l2Networks are searched for the L1GatewayRouter.
   *
   * @param tx A Transaction, TransactionRequest, or TransactionReceipt that initiated step 1 of a relayed teleportation
   */
  public static parseRelayerInfoFromTx(
    tx: Required<Pick<TransactionRequest, 'data' | 'to'>>
  ): RelayerInfo {
    // 'to' is the L1GatewayRouter. Go through the list of chains and find the one that matches the L1GatewayRouter
    const chainId = Object.values(l2Networks).find(
      network => network.tokenBridge.l1GatewayRouter === tx.to
    )?.chainID

    if (!chainId) {
      throw new ArbSdkError(`Could not find chain id for L1GatewayRouter`)
    }

    const l2ForwarderAddressFragment =
      L2ForwarderPredictor__factory.createInterface().fragments.find(
        f => f.name === 'l2ForwarderAddress'
      )!

    const l2ForwarderParamsStructLength =
      l2ForwarderAddressFragment.inputs[0].components.length

    // get the last x words of the calldata
    const encodedL2ForwarderParams = ethers.utils.hexDataSlice(
      tx.data,
      ethers.utils.hexDataLength(tx.data) - l2ForwarderParamsStructLength * 32
    )

    // parse the encoded params
    const decodedL2ForwarderParams = new AbiCoder().decode(
      l2ForwarderAddressFragment.inputs,
      encodedL2ForwarderParams
    )[0] as L2ForwarderPredictor.L2ForwarderParamsStruct

    return {
      chainId,
      ...decodedL2ForwarderParams,
    }
  }

  /**
   * Call an `L2Forwarder` to relay a deposit to L3.
   */
  public static async relayDeposit(
    relayerInfo: RelayerInfo,
    l2Signer: Signer
  ): Promise<ethers.ContractTransaction> {
    if ((await l2Signer.getChainId()) !== relayerInfo.chainId) {
      throw new ArbSdkError(
        `L2 signer chain id ${await l2Signer.getChainId()} does not match correct chain id ${
          relayerInfo.chainId
        }`
      )
    }

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

  private async _estimateL1GasForL2ForwarderCall(l2Provider: Provider) {
    const nodeInterface = NodeInterface__factory.connect(
      NODE_INTERFACE_ADDRESS,
      l2Provider
    )

    // generate some fake calldata with random values
    const r = (n: number) => ethers.utils.hexlify(ethers.utils.randomBytes(n))
    const params: L2ForwarderPredictor.L2ForwarderParamsStruct = {
      owner: r(20),
      token: r(20),
      router: r(20),
      to: r(20),
      gasLimit: r(32),
      gasPrice: r(32),
      relayerPayment: r(32),
    }

    const txData =
      L2ForwarderFactory__factory.createInterface().encodeFunctionData(
        'callForwarder',
        [params]
      )

    return (
      await nodeInterface.callStatic.gasEstimateL1Component(
        this.l2Network.teleporterAddresses!.l2ForwarderFactory,
        false,
        txData
      )
    ).gasEstimateForL1
  }
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