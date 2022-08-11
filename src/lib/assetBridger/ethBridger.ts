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
import { Provider } from '@ethersproject/abstract-provider'
import { PayableOverrides } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { PercentIncrease } from '../message/L1ToL2MessageGasEstimator'
import { AssetBridger } from './assetBridger'
import {
  L1EthDepositTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import {
  L2ContractTransaction,
  L2TransactionReceipt,
} from '../message/L2Transaction'

import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import {
  lookupExistingNetwork,
  isNitroL1,
  isNitroL2,
} from '../utils/migration_types'
import { L2Network } from '../dataEntities/networks'

export interface EthWithdrawParams {
  /**
   * L2 signer who is sending the assets
   */
  l2Signer: Signer

  /**
   * The amount of ETH or tokens to be withdrawn
   */
  amount: BigNumber

  /**
   * The L1 address to receive the value. Defaults to l2Signer's address
   */
  destinationAddress?: string

  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export type EthDepositBase = {
  /**
   * The L1 entity depositing the assets
   */
  l1Signer: Signer

  /**
   * An l2 provider
   */
  l2Provider: Provider

  /**
   * The amount of ETH or tokens to be deposited
   */
  amount: BigNumber

  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export interface EthDepositParams extends EthDepositBase {
  /**
   * Retryable transaction overrides
   */
  retryableGasOverrides?: {
    maxSubmissionPrice?: PercentIncrease
  }
}

/**
 * Bridger for moving ETH back and forth betwen L1 to L2
 */
export class EthBridger extends AssetBridger<
  EthDepositParams,
  EthWithdrawParams
> {
  private readonly classicBridger: classic.EthBridger
  private readonly nitroBridger: nitro.EthBridger
  /**
   * Bridger for moving ERC20 tokens back and forth betwen L1 to L2
   */
  public constructor(l2Network: L2Network) {
    super(l2Network)
    this.classicBridger = new classic.EthBridger(
      lookupExistingNetwork(l2Network)
    )
    this.nitroBridger = new nitro.EthBridger(l2Network)
  }

  /**
   * Estimate gas for depositing ETH from L1 onto L2
   * @param params
   * @returns
   */
  public async depositEstimateGas(
    params: EthDepositParams
  ): Promise<BigNumber> {
    return (await isNitroL1(this.l2Network.chainID, params.l1Signer))
      ? this.nitroBridger.depositEstimateGas(params)
      : this.classicBridger.depositEstimateGas(params)
  }

  /**
   * Deposit ETH from L1 onto L2
   * @param params
   * @returns
   */
  public async deposit(
    params: EthDepositParams
  ): Promise<L1EthDepositTransaction> {
    return L1TransactionReceipt.monkeyPatchEthDepositWait(
      (await isNitroL1(this.l2Network.chainID, params.l1Signer))
        ? await this.nitroBridger.deposit(params)
        : await this.classicBridger.deposit(params)
    )
  }

  /**
   * Estimate gas for withdrawing ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdrawEstimateGas(
    params: EthWithdrawParams
  ): Promise<BigNumber> {
    return (await isNitroL2(params.l2Signer))
      ? this.nitroBridger.withdrawEstimateGas(params)
      : this.classicBridger.withdrawEstimateGas(params)
  }

  /**
   * Withdraw ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: EthWithdrawParams
  ): Promise<L2ContractTransaction> {
    return L2TransactionReceipt.monkeyPatchWait(
      (await isNitroL2(params.l2Signer))
        ? await this.nitroBridger.withdraw(params)
        : await this.classicBridger.withdraw(params)
    )
  }
}
