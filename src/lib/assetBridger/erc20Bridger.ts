/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { Signer } from '@ethersproject/abstract-signer'
import { Provider, BlockTag } from '@ethersproject/abstract-provider'
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { Zero, MaxUint256 } from '@ethersproject/constants'
import { ErrorCode, Logger } from '@ethersproject/logger'
import { BigNumber, ethers } from 'ethers'

import { L1GatewayRouter__factory } from '../abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../abi/factories/L2GatewayRouter__factory'
import { L1ERC20Gateway__factory } from '../abi/factories/L1ERC20Gateway__factory'
import { L1WethGateway__factory } from '../abi/factories/L1WethGateway__factory'
import { L2ArbitrumGateway__factory } from '../abi/factories/L2ArbitrumGateway__factory'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { ERC20 } from '../abi/ERC20'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { L2GatewayToken } from '../abi/L2GatewayToken'
import { ICustomToken__factory } from '../abi/factories/ICustomToken__factory'
import { IArbToken__factory } from '../abi/factories/IArbToken__factory'
import { L2CustomGateway__factory } from '../abi/factories/L2CustomGateway__factory'

import { WithdrawalInitiatedEvent } from '../abi/L2ArbitrumGateway'
import { GatewaySetEvent } from '../abi/L1GatewayRouter'
import {
  GasOverrides,
  L1ToL2MessageGasEstimator,
} from '../message/L1ToL2MessageGasEstimator'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { L2Network } from '../dataEntities/networks'
import { ArbSdkError, MissingProviderArbSdkError } from '../dataEntities/errors'
import { DISABLED_GATEWAY } from '../dataEntities/constants'
import { EventFetcher } from '../utils/eventFetcher'
import { EthDepositParams, EthWithdrawParams } from './ethBridger'
import { AssetBridger } from './assetBridger'
import {
  L1ContractCallTransaction,
  L1ContractTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import {
  L2ContractTransaction,
  L2TransactionReceipt,
} from '../message/L2Transaction'
import { getBaseFee } from '../utils/lib'
import {
  isL1ToL2TransactionRequest,
  L1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'
import { defaultAbiCoder } from 'ethers/lib/utils'

export interface TokenApproveParams {
  /**
   * L1 signer whose tokens are being approved
   */
  l1Signer: Signer

  /**
   * L1 address of the ERC20 token contract
   */
  erc20L1Address: string

  /**
   * Amount to approve. Defaults to max int.
   */
  amount?: BigNumber

  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export interface Erc20DepositParams extends EthDepositParams {
  /**
   * An L2 provider
   */
  l2Provider: Provider

  /**
   * L1 address of the token ERC20 contract
   */
  erc20L1Address: string

  /**
   * L2 address of the entity receiving the funds. Defaults to the l1FromAddress
   */
  destinationAddress?: string

  /**
   * Overrides for the retryable ticket parameters
   */
  retryableGasOverrides?: GasOverrides

  /**
   * Transaction overrides
   */
  overrides?: Overrides
}

export interface TokenWithdrawParams extends EthWithdrawParams {
  /**
   * L1 address of the token ERC20 contract
   */
  erc20l1Address: string
}

export type L1ToL2TxReqAndSignerProvider = L1ToL2TransactionRequest & {
  l1Signer: Signer
  l2Provider: Provider
  overrides?: Overrides
}

/**
 * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
 */
export class Erc20Bridger extends AssetBridger<
  Erc20DepositParams,
  TokenWithdrawParams
> {
  public static MAX_APPROVAL = MaxUint256
  public static MIN_CUSTOM_DEPOSIT_GAS_LIMIT = BigNumber.from(275000)

  /**
   * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
   */
  public constructor(l2Network: L2Network) {
    super(l2Network)
  }

  /**
   * Get the address of the l1 gateway for this token
   * @param erc20L1Address
   * @param l1Provider
   * @returns
   */
  public async getL1GatewayAddress(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    await this.checkL1Network(l1Provider)

    return await L1GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Provider
    ).getGateway(erc20L1Address)
  }

  /**
   * Get the address of the l2 gateway for this token
   * @param erc20L1Address
   * @param l2Provider
   * @returns
   */
  public async getL2GatewayAddress(
    erc20L1Address: string,
    l2Provider: Provider
  ): Promise<string> {
    await this.checkL2Network(l2Provider)

    return await L2GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l2GatewayRouter,
      l2Provider
    ).getGateway(erc20L1Address)
  }

  /**
   * Approve tokens for deposit to the bridge. The tokens will be approved for the relevant gateway.
   * @param params
   * @returns
   */
  public async approveToken(
    params: TokenApproveParams
  ): Promise<ethers.ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
    await this.checkL1Network(params.l1Signer)

    // you approve tokens to the gateway that the router will use
    const gatewayAddress = await this.getL1GatewayAddress(
      params.erc20L1Address,
      params.l1Signer.provider
    )
    const contract = await ERC20__factory.connect(
      params.erc20L1Address,
      params.l1Signer
    )
    return contract.functions.approve(
      gatewayAddress,
      params.amount || Erc20Bridger.MAX_APPROVAL,
      params.overrides || {}
    )
  }

  /**
   * Get the L2 events created by a withdrawal
   * @param l2Provider
   * @param gatewayAddress
   * @param l1TokenAddress
   * @param fromAddress
   * @param filter
   * @returns
   */
  public async getL2WithdrawalEvents(
    l2Provider: Provider,
    gatewayAddress: string,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    l1TokenAddress?: string,
    fromAddress?: string
  ): Promise<(WithdrawalInitiatedEvent['args'] & { txHash: string })[]> {
    await this.checkL2Network(l2Provider)

    const eventFetcher = new EventFetcher(l2Provider)
    const events = (
      await eventFetcher.getEvents(
        gatewayAddress,
        L2ArbitrumGateway__factory,
        contract =>
          contract.filters.WithdrawalInitiated(null, fromAddress || null),
        filter
      )
    ).map(a => ({ txHash: a.transactionHash, ...a.event }))

    return l1TokenAddress
      ? events.filter(
          log =>
            log.l1Token.toLocaleLowerCase() ===
            l1TokenAddress.toLocaleLowerCase()
        )
      : events
  }

  /**
   * Does the provided address look like a weth gateway
   * @param potentialWethGatewayAddress
   * @param l1Provider
   * @returns
   */
  private async looksLikeWethGateway(
    potentialWethGatewayAddress: string,
    l1Provider: Provider
  ) {
    try {
      const potentialWethGateway = L1WethGateway__factory.connect(
        potentialWethGatewayAddress,
        l1Provider
      )
      await potentialWethGateway.callStatic.l1Weth()
      return true
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as { code: ErrorCode }).code ===
          Logger.errors.CALL_EXCEPTION
      ) {
        return false
      } else {
        throw err
      }
    }
  }

  /**
   * Is this a known or unknown WETH gateway
   * @param gatewayAddress
   * @param l1Provider
   * @returns
   */
  private async isWethGateway(
    gatewayAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    const wethAddress = this.l2Network.tokenBridge.l1WethGateway
    if (this.l2Network.isCustom) {
      // For custom network, we do an ad-hoc check to see if it's a WETH gateway
      if (await this.looksLikeWethGateway(gatewayAddress, l1Provider)) {
        return true
      }
      // ...otherwise we directly check it against the config file
    } else if (wethAddress === gatewayAddress) {
      return true
    }
    return false
  }

  /**
   * Get the L2 token contract at the provided address
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
   * Get the L1 token contract at the provided address
   * @param l1Provider
   * @param l1TokenAddr
   * @returns
   */
  public getL1TokenContract(l1Provider: Provider, l1TokenAddr: string): ERC20 {
    return ERC20__factory.connect(l1TokenAddr, l1Provider)
  }

  /**
   * Get the corresponding L2 for the provided L1 token
   * @param erc20L1Address
   * @param l1Provider
   * @returns
   */
  public async getL2ERC20Address(
    erc20L1Address: string,
    l1Provider: Provider
  ): Promise<string> {
    await this.checkL1Network(l1Provider)

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Provider
    )

    return await l1GatewayRouter.functions
      .calculateL2TokenAddress(erc20L1Address)
      .then(([res]) => res)
  }

  /**
   * Get the corresponding L1 for the provided L2 token
   * @param erc20L1Address
   * @param l1Provider
   * @returns
   */
  public async getL1ERC20Address(
    erc20L2Address: string,
    l2Provider: Provider
  ): Promise<string> {
    await this.checkL2Network(l2Provider)

    const arbERC20 = L2GatewayToken__factory.connect(erc20L2Address, l2Provider)

    return await arbERC20.functions.l1Address().then(([res]) => res)
  }

  /**
   * Whether the token has been disabled on the router
   * @param l1TokenAddress
   * @param l1Provider
   * @returns
   */
  public async l1TokenIsDisabled(
    l1TokenAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    await this.checkL1Network(l1Provider)

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Provider
    )

    return (
      (await l1GatewayRouter.l1TokenToGateway(l1TokenAddress)) ===
      DISABLED_GATEWAY
    )
  }

  /**
   * Get the arguments for calling the deposit function
   * @param params
   * @returns
   */
  public async getDepositRequest(
    params: Omit<Erc20DepositParams, 'overrides'>
  ): Promise<L1ToL2TransactionRequest> {
    const {
      retryableGasOverrides,
      erc20L1Address,
      amount,
      l2Provider,
      l1Signer,
      destinationAddress,
    } = params

    await this.checkL1Network(params.l1Signer)
    await this.checkL2Network(params.l2Provider)
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }

    // 1. get the params for a gas estimate
    const l1GatewayAddress = await this.getL1GatewayAddress(
      erc20L1Address,
      l1Signer.provider
    )
    const l1Gateway = L1ERC20Gateway__factory.connect(
      l1GatewayAddress,
      l1Signer.provider
    )
    const sender = await l1Signer.getAddress()
    const to = destinationAddress ? destinationAddress : sender
    const depositCalldata = await l1Gateway.getOutboundCalldata(
      erc20L1Address,
      sender,
      to,
      amount,
      '0x'
    )

    // The WETH gateway is the only deposit that requires callvalue in the L2 user-tx (i.e., the recently un-wrapped ETH)
    // Here we check if this is a WETH deposit, and include the callvalue for the gas estimate query if so
    const isWeth = await this.isWethGateway(l1GatewayAddress, l1Signer.provider)
    const estimateGasCallValue = isWeth ? amount : Zero

    const l2Dest = await l1Gateway.counterpartGateway()
    const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider)

    let tokenGasOverrides: GasOverrides | undefined = retryableGasOverrides

    // we also add a hardcoded minimum gas limit for custom gateway deposits
    if (l1GatewayAddress === this.l2Network.tokenBridge.l1CustomGateway) {
      if (!tokenGasOverrides) tokenGasOverrides = {}
      if (!tokenGasOverrides.gasLimit) tokenGasOverrides.gasLimit = {}
      tokenGasOverrides.gasLimit.min = Erc20Bridger.MIN_CUSTOM_DEPOSIT_GAS_LIMIT
    }

    // 2. get the gas estimates
    const baseFee = await getBaseFee(l1Signer.provider)
    const estimates = await gasEstimator.estimateAll(
      l1GatewayAddress,
      l2Dest,
      depositCalldata,
      estimateGasCallValue,
      baseFee,
      sender,
      sender,
      l1Signer.provider,
      tokenGasOverrides
    )

    const l1GatewayRouterInterface = L1GatewayRouter__factory.createInterface()

    const innerData = defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [estimates.maxSubmissionFee, '0x']
    )

    const functionData = l1GatewayRouterInterface.encodeFunctionData(
      'outboundTransfer',
      [
        erc20L1Address,
        to,
        amount,
        estimates.gasLimit,
        estimates.maxFeePerGas,
        innerData,
      ]
    )

    return {
      l2GasLimit: estimates.gasLimit,
      l2MaxFeePerGas: estimates.maxFeePerGas,
      l2SubmissionFee: estimates.maxSubmissionFee,
      l2GasCostsMaxTotal: estimates.totalL2GasCosts,
      txRequestCore: {
        to: this.l2Network.tokenBridge.l1GatewayRouter,
        data: functionData,
        value: estimates.totalL2GasCosts,
      },
    }
  }

  private async depositTxOrGas<T extends boolean>(
    params: Erc20DepositParams | L1ToL2TxReqAndSignerProvider,
    estimate: T
  ): Promise<T extends true ? BigNumber : ethers.ContractTransaction>
  private async depositTxOrGas<T extends boolean>(
    params: Erc20DepositParams | L1ToL2TxReqAndSignerProvider,
    estimate: T
  ): Promise<BigNumber | ethers.ContractTransaction> {
    await this.checkL1Network(params.l1Signer)
    await this.checkL2Network(params.l2Provider)
    if (!SignerProviderUtils.signerHasProvider(params.l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }

    const tokenDeposit = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getDepositRequest(params)

    return await params.l1Signer[estimate ? 'estimateGas' : 'sendTransaction']({
      ...tokenDeposit.txRequestCore,
      ...params.overrides,
    })
  }

  /**
   * Estimate the gas required for a token deposit
   * @param params
   * @returns
   */
  public async depositEstimateGas(
    params: Erc20DepositParams | L1ToL2TxReqAndSignerProvider
  ): Promise<BigNumber> {
    return await this.depositTxOrGas(params, true)
  }

  /**
   * Execute a token deposit from L1 to L2
   * @param params
   * @returns
   */
  public async deposit(
    params: Erc20DepositParams | L1ToL2TxReqAndSignerProvider
  ): Promise<L1ContractCallTransaction> {
    const tx = await this.depositTxOrGas(params, false)
    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  private async withdrawTxOrGas<T extends boolean>(
    params: TokenWithdrawParams,
    estimate: T
  ): Promise<T extends true ? BigNumber : ethers.ContractTransaction>
  private async withdrawTxOrGas<T extends boolean>(
    params: TokenWithdrawParams,
    estimate: T
  ): Promise<BigNumber | ethers.ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.l2Signer)) {
      throw new MissingProviderArbSdkError('l2Signer')
    }
    await this.checkL2Network(params.l2Signer)

    const to = params.destinationAddress || (await params.l2Signer.getAddress())

    const l2GatewayRouter = L2GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l2GatewayRouter,
      params.l2Signer
    )

    return (estimate ? l2GatewayRouter.estimateGas : l2GatewayRouter.functions)[
      'outboundTransfer(address,address,uint256,bytes)'
    ](params.erc20l1Address, to, params.amount, '0x', {
      ...(params.overrides || {}),
    })
  }

  /**
   * Estimate gas for withdrawing tokens from L2 to L1
   * @param params
   * @returns
   */
  public async withdrawEstimateGas(
    params: TokenWithdrawParams
  ): Promise<BigNumber> {
    return this.withdrawTxOrGas(params, true)
  }

  /**
   * Withdraw tokens from L2 to L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: TokenWithdrawParams
  ): Promise<L2ContractTransaction> {
    const tx = await this.withdrawTxOrGas(params, false)
    return L2TransactionReceipt.monkeyPatchWait(tx)
  }
}

/**
 * A token and gateway pair
 */
interface TokenAndGateway {
  tokenAddr: string
  gatewayAddr: string
}

/**
 * Admin functionality for the token bridge
 */
export class AdminErc20Bridger extends Erc20Bridger {
  /**
   * Register a custom token on the Arbitrum bridge
   * See https://developer.offchainlabs.com/docs/bridging_assets#the-arbitrum-generic-custom-gateway for more details
   * @param l1TokenAddress Address of the already deployed l1 token. Must inherit from https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/tokenbridge/ethereum/icustomtoken.
   * @param l2TokenAddress Address of the already deployed l2 token. Must inherit from https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/tokenbridge/arbitrum/iarbtoken.
   * @param l1Signer The signer with the rights to call registerTokenOnL2 on the l1 token
   * @param l2Provider Arbitrum rpc provider
   * @returns
   */
  public async registerCustomToken(
    l1TokenAddress: string,
    l2TokenAddress: string,
    l1Signer: Signer,
    l2Provider: Provider
  ): Promise<L1ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
    await this.checkL1Network(l1Signer)
    await this.checkL2Network(l2Provider)

    const l1SenderAddress = await l1Signer.getAddress()

    const l1Token = ICustomToken__factory.connect(l1TokenAddress, l1Signer)
    const l2Token = IArbToken__factory.connect(l2TokenAddress, l2Provider)

    // sanity checks
    await l1Token.deployed()
    await l2Token.deployed()

    const l1AddressFromL2 = await l2Token.l1Address()
    if (l1AddressFromL2 !== l1TokenAddress) {
      throw new ArbSdkError(
        `L2 token does not have l1 address set. Set address: ${l1AddressFromL2}, expected address: ${l1TokenAddress}.`
      )
    }
    const gasPriceEstimator = new L1ToL2MessageGasEstimator(l2Provider)

    // internally the registerTokenOnL2 sends two l1tol2 messages
    // the first registers the tokens and the second sets the gateways
    // we need to estimate gas for each of these l1tol2 messages
    // 1. registerTokenFromL1
    const il2CustomGateway = L2CustomGateway__factory.createInterface()
    const l2SetTokenCallData = il2CustomGateway.encodeFunctionData(
      'registerTokenFromL1',
      [[l1TokenAddress], [l2TokenAddress]]
    )

    const l1SignerAddr = await l1Signer.getAddress()
    const baseFee = await getBaseFee(l1Signer.provider)
    const setTokenEstimates = await gasPriceEstimator.estimateAll(
      this.l2Network.tokenBridge.l1CustomGateway,
      this.l2Network.tokenBridge.l2CustomGateway,
      l2SetTokenCallData,
      Zero,
      baseFee,
      l1SignerAddr,
      l1SignerAddr,
      l1Signer.provider
    )

    // 2. setGateway
    const iL2GatewayRouter = L2GatewayRouter__factory.createInterface()
    const l2SetGatewaysCallData = iL2GatewayRouter.encodeFunctionData(
      'setGateway',
      [[l1TokenAddress], [this.l2Network.tokenBridge.l1CustomGateway]]
    )

    const setGatwayEstimates = await gasPriceEstimator.estimateAll(
      this.l2Network.tokenBridge.l1GatewayRouter,
      this.l2Network.tokenBridge.l2GatewayRouter,
      l2SetGatewaysCallData,
      Zero,
      baseFee,
      l1SignerAddr,
      l1SignerAddr,
      l1Signer.provider
    )

    // now execute the registration
    const customRegistrationTx = await l1Token.registerTokenOnL2(
      l2TokenAddress,
      setTokenEstimates.maxSubmissionFee,
      setGatwayEstimates.maxSubmissionFee,
      setTokenEstimates.gasLimit,
      setGatwayEstimates.gasLimit,
      setGatwayEstimates.maxFeePerGas,
      setTokenEstimates.totalL2GasCosts,
      setGatwayEstimates.totalL2GasCosts,
      l1SenderAddress,
      {
        value: setTokenEstimates.totalL2GasCosts.add(
          setGatwayEstimates.totalL2GasCosts
        ),
      }
    )

    return L1TransactionReceipt.monkeyPatchWait(customRegistrationTx)
  }

  /**
   * Get all the gateway set events on the L1 gateway router
   * @param l1Provider
   * @param customNetworkL1GatewayRouter
   * @returns
   */
  public async getL1GatewaySetEvents(
    l1Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag }
  ): Promise<GatewaySetEvent['args'][]> {
    await this.checkL1Network(l1Provider)

    const l1GatewayRouterAddress = this.l2Network.tokenBridge.l1GatewayRouter
    const eventFetcher = new EventFetcher(l1Provider)
    return (
      await eventFetcher.getEvents(
        l1GatewayRouterAddress,
        L1GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        filter
      )
    ).map(a => a.event)
  }

  /**
   * Get all the gateway set events on the L2 gateway router
   * @param l1Provider
   * @param customNetworkL1GatewayRouter
   * @returns
   */
  public async getL2GatewaySetEvents(
    l2Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    customNetworkL2GatewayRouter?: string
  ): Promise<GatewaySetEvent['args'][]> {
    if (this.l2Network.isCustom && !customNetworkL2GatewayRouter) {
      throw new ArbSdkError(
        'Must supply customNetworkL2GatewayRouter for custom network '
      )
    }
    await this.checkL2Network(l2Provider)

    const l2GatewayRouterAddress =
      customNetworkL2GatewayRouter || this.l2Network.tokenBridge.l2GatewayRouter

    const eventFetcher = new EventFetcher(l2Provider)
    return (
      await eventFetcher.getEvents(
        l2GatewayRouterAddress,
        L1GatewayRouter__factory,
        t => t.filters.GatewaySet(),
        filter
      )
    ).map(a => a.event)
  }

  /**
   * Register the provided token addresses against the provided gateways
   * @param l1Signer
   * @param l2Provider
   * @param tokenGateways
   * @returns
   */
  public async setGateways(
    l1Signer: Signer,
    l2Provider: Provider,
    tokenGateways: TokenAndGateway[]
  ): Promise<L1ContractCallTransaction> {
    if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
    await this.checkL1Network(l1Signer)
    await this.checkL2Network(l2Provider)

    const estimator = new L1ToL2MessageGasEstimator(l2Provider)
    const baseFee = await getBaseFee(l1Signer.provider)

    const iL2GatewayRouter = L2GatewayRouter__factory.createInterface()
    const l2SetGatewaysCallData = iL2GatewayRouter.encodeFunctionData(
      'setGateway',
      [
        tokenGateways.map(tG => tG.tokenAddr),
        tokenGateways.map(tG => tG.gatewayAddr),
      ]
    )

    const l1SignerAddr = await l1Signer.getAddress()
    const estimates = await estimator.estimateAll(
      this.l2Network.tokenBridge.l1GatewayRouter,
      this.l2Network.tokenBridge.l2GatewayRouter,
      l2SetGatewaysCallData,
      Zero,
      baseFee,
      l1SignerAddr,
      l1SignerAddr,
      l1Signer.provider
    )

    const l1GatewayRouter = L1GatewayRouter__factory.connect(
      this.l2Network.tokenBridge.l1GatewayRouter,
      l1Signer
    )

    const res = await l1GatewayRouter.functions.setGateways(
      tokenGateways.map(tG => tG.tokenAddr),
      tokenGateways.map(tG => tG.gatewayAddr),
      estimates.gasLimit,
      estimates.maxFeePerGas,
      estimates.maxSubmissionFee,
      { value: estimates.totalL2GasCosts }
    )

    return L1TransactionReceipt.monkeyPatchContractCallWait(res)
  }
}
