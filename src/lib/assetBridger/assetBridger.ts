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
 * Base for bridging assets from a parent chain to a child chain and back.
 */
export abstract class AssetBridger<DepositParams, WithdrawParams> {
  /**
   * The parent chain. Could be an L1 or an L2.
   */
  public readonly l1Network: L1Network | L2Network

  public constructor(public readonly l2Network: L2Network) {
    this.l1Network = getParentForNetwork(l2Network)
  }

  /**
   * Check the signer/provider matches the parent chain, throws if not.
   * @param sop
   */
  protected async checkL1Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l1Network.chainID)
  }

  /**
   * Check the signer/provider matches the child chain, throws if not.
   * @param sop
   */
  protected async checkL2Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l2Network.chainID)
  }

  /**
   * Transfer assets from parent chain to child chain.
   * @param params
   */
  public abstract deposit(params: DepositParams): Promise<L1ContractTransaction>

  /**
   * Transfer assets from child chain to parent chain.
   * @param params
   */
  public abstract withdraw(
    params: WithdrawParams
  ): Promise<L2ContractTransaction>
}
