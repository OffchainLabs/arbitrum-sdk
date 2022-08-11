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
import { MaxUint256 } from '@ethersproject/constants'
import { BigNumber, ethers } from 'ethers'

import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { ERC20 } from '../abi/ERC20'
import { L2GatewayToken__factory } from '../abi/factories/L2GatewayToken__factory'
import { L2GatewayToken } from '../abi/L2GatewayToken'

import { WithdrawalInitiatedEvent } from '../abi/L2ArbitrumGateway'
import { GatewaySetEvent } from '../abi/L1GatewayRouter'
import { GasOverrides } from '../message/L1ToL2MessageGasEstimator'
import { L2Network } from '../dataEntities/networks'
import { EthDepositBase, EthWithdrawParams } from './ethBridger'
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

import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  convertGasOverrides,
  lookupExistingNetwork,
  isNitroL1,
  isNitroL2,
} from '../utils/migration_types'
import { AdminErc20Bridger as ClassicAdminErc20Bridger } from '@arbitrum/sdk-classic/dist/lib/assetBridger/erc20Bridger'
import { AdminErc20Bridger as NitroAdminErc20Bridger } from '@arbitrum/sdk-nitro/dist/lib/assetBridger/erc20Bridger'

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

export interface TokenDepositParams extends EthDepositBase {
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

/**
 * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
 */
export class Erc20Bridger extends AssetBridger<
  TokenDepositParams,
  TokenWithdrawParams
> {
  public static MAX_APPROVAL = MaxUint256
  public static MIN_CUSTOM_DEPOSIT_GAS_LIMIT = BigNumber.from(275000)

  private readonly classicBridger: classic.Erc20Bridger
  private readonly nitroBridger: nitro.Erc20Bridger

  /**
   * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
   */
  public constructor(l2Network: L2Network) {
    super(l2Network)

    this.classicBridger = new classic.Erc20Bridger(
      lookupExistingNetwork(l2Network)
    )
    this.nitroBridger = new nitro.Erc20Bridger(l2Network)
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
    return (await isNitroL1(this.l2Network.chainID, l1Provider))
      ? this.nitroBridger.getL1GatewayAddress(erc20L1Address, l1Provider)
      : this.classicBridger.getL1GatewayAddress(erc20L1Address, l1Provider)
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
    return (await isNitroL2(l2Provider))
      ? this.nitroBridger.getL2GatewayAddress(erc20L1Address, l2Provider)
      : this.classicBridger.getL2GatewayAddress(erc20L1Address, l2Provider)
  }

  /**
   * Approve tokens for deposit to the bridge. The tokens will be approved for the relevant gateway.
   * @param params
   * @returns
   */
  public async approveToken(
    params: TokenApproveParams
  ): Promise<ethers.ContractTransaction> {
    return (await isNitroL1(this.l2Network.chainID, params.l1Signer))
      ? this.nitroBridger.approveToken(params)
      : this.classicBridger.approveToken(params)
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
    return (await isNitroL2(l2Provider))
      ? this.nitroBridger.getL2WithdrawalEvents(
          l2Provider,
          gatewayAddress,
          filter,
          l1TokenAddress,
          fromAddress
        )
      : this.classicBridger.getL2WithdrawalEvents(
          l2Provider,
          gatewayAddress,
          filter,
          l1TokenAddress,
          fromAddress
        )
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
    return (await isNitroL1(this.l2Network.chainID, l1Provider))
      ? this.nitroBridger.getL2ERC20Address(erc20L1Address, l1Provider)
      : this.classicBridger.getL2ERC20Address(erc20L1Address, l1Provider)
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
    return (await isNitroL2(l2Provider))
      ? this.nitroBridger.getL1ERC20Address(erc20L2Address, l2Provider)
      : this.classicBridger.getL1ERC20Address(erc20L2Address, l2Provider)
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
    return (await isNitroL1(this.l2Network.chainID, l1Provider))
      ? this.nitroBridger.l1TokenIsDisabled(l1TokenAddress, l1Provider)
      : this.classicBridger.l1TokenIsDisabled(l1TokenAddress, l1Provider)
  }

  /**
   * Estimate the gas required for a token deposit
   * @param params
   * @returns
   */
  public async depositEstimateGas(
    params: TokenDepositParams
  ): Promise<BigNumber> {
    return (await isNitroL1(this.l2Network.chainID, params.l1Signer))
      ? this.nitroBridger.depositEstimateGas(params)
      : this.classicBridger.depositEstimateGas({
          ...params,
          retryableGasOverrides: convertGasOverrides(
            params.retryableGasOverrides
          ),
        })
  }

  /**
   * Execute a token deposit from L1 to L2
   * @param params
   * @returns
   */
  public async deposit(
    params: TokenDepositParams
  ): Promise<L1ContractCallTransaction> {
    return L1TransactionReceipt.monkeyPatchContractCallWait(
      (await isNitroL1(this.l2Network.chainID, params.l1Signer))
        ? await this.nitroBridger.deposit(params)
        : await this.classicBridger.deposit({
            ...params,
            retryableGasOverrides: convertGasOverrides(
              params.retryableGasOverrides
            ),
          })
    )
  }

  /**
   * Estimate gas for withdrawing tokens from L2 to L1
   * @param params
   * @returns
   */
  public async withdrawEstimateGas(
    params: TokenWithdrawParams
  ): Promise<BigNumber> {
    return (await isNitroL2(params.l2Signer))
      ? this.nitroBridger.withdrawEstimateGas(params)
      : this.classicBridger.withdrawEstimateGas(params)
  }

  /**
   * Withdraw tokens from L2 to L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: TokenWithdrawParams
  ): Promise<L2ContractTransaction> {
    return L2TransactionReceipt.monkeyPatchWait(
      (await isNitroL2(params.l2Signer))
        ? await this.nitroBridger.withdraw(params)
        : await this.classicBridger.withdraw(params)
    )
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
  private readonly adminClassicBridger: ClassicAdminErc20Bridger
  private readonly adminNitroBridger: NitroAdminErc20Bridger

  /**
   * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
   */
  public constructor(l2Network: L2Network) {
    super(l2Network)
    this.adminClassicBridger = new ClassicAdminErc20Bridger(
      lookupExistingNetwork(l2Network)
    )
    this.adminNitroBridger = new NitroAdminErc20Bridger(l2Network)
  }
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
    return L1TransactionReceipt.monkeyPatchContractCallWait(
      (await isNitroL1(this.l2Network.chainID, l1Signer))
        ? await this.adminNitroBridger.registerCustomToken(
            l1TokenAddress,
            l2TokenAddress,
            l1Signer,
            l2Provider
          )
        : await this.adminClassicBridger.registerCustomToken(
            l1TokenAddress,
            l2TokenAddress,
            l1Signer,
            l2Provider
          )
    )
  }

  /**
   * Get all the gateway set events on the L1 gateway router
   * @param l1Provider
   * @param customNetworkL1GatewayRouter
   * @returns
   */
  public async getL1GatewaySetEvents(
    l1Provider: Provider,
    filter: { fromBlock: BlockTag; toBlock: BlockTag },
    customNetworkL1GatewayRouter?: string
  ): Promise<GatewaySetEvent['args'][]> {
    return (await isNitroL1(this.l2Network.chainID, l1Provider))
      ? this.adminNitroBridger.getL1GatewaySetEvents(l1Provider, filter)
      : this.adminClassicBridger.getL1GatewaySetEvents(
          l1Provider,
          filter,
          customNetworkL1GatewayRouter
        )
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
    return (await isNitroL2(l2Provider))
      ? this.adminNitroBridger.getL2GatewaySetEvents(
          l2Provider,
          filter,
          customNetworkL2GatewayRouter
        )
      : this.adminClassicBridger.getL2GatewaySetEvents(
          l2Provider,
          filter,
          customNetworkL2GatewayRouter
        )
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
    tokenGateways: TokenAndGateway[],
    maxGas: BigNumber = BigNumber.from(0)
  ): Promise<L1ContractCallTransaction> {
    return L1TransactionReceipt.monkeyPatchContractCallWait(
      (await isNitroL1(this.l2Network.chainID, l1Signer))
        ? await this.adminNitroBridger.setGateways(
            l1Signer,
            l2Provider,
            tokenGateways
          )
        : await this.adminClassicBridger.setGateways(
            l1Signer,
            l2Provider,
            tokenGateways,
            maxGas
          )
    )
  }
}
