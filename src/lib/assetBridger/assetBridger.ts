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

import { constants } from 'ethers'

import { L1ContractTransaction } from '../message/L1Transaction'
import { L2ContractTransaction } from '../message/L2Transaction'

import {
  L1Network,
  L2Network,
  getParentForNetwork,
} from '../dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'

/**
 * Base for bridging assets from l1 to l2 and back
 */
export abstract class AssetBridger<DepositParams, WithdrawParams> {
  /**
   * Parent chain for the given Arbitrum chain, can be an L1 or an L2
   */
  public readonly l1Network: L1Network | L2Network

  /**
   * In case of a chain that uses ETH as its native/gas token, this is either `undefined` or the zero address
   *
   * In case of a chain that uses an ERC-20 token from the parent chain as its native/gas token, this is the address of said token on the parent chain
   */
  public readonly nativeToken?: string

  public constructor(public readonly l2Network: L2Network) {
    this.l1Network = getParentForNetwork(l2Network)
    this.nativeToken = l2Network.nativeToken
  }

  /**
   * Check the signer/provider matches the l1Network, throws if not
   * @param sop
   */
  protected async checkL1Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l1Network.chainID)
  }

  /**
   * Check the signer/provider matches the l2Network, throws if not
   * @param sop
   */
  protected async checkL2Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l2Network.chainID)
  }

  /**
   * Whether the chain uses ETH as its native/gas token
   * @returns {boolean}
   */
  protected get nativeTokenIsEth() {
    return !this.nativeToken || this.nativeToken === constants.AddressZero
  }

  /**
   * Transfer assets from L1 to L2
   * @param params
   */
  public abstract deposit(params: DepositParams): Promise<L1ContractTransaction>

  /**
   * Transfer assets from L2 to L1
   * @param params
   */
  public abstract withdraw(
    params: WithdrawParams
  ): Promise<L2ContractTransaction>
}
