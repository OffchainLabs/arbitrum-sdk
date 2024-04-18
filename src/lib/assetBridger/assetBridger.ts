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

import { ParentContractTransaction } from '../message/ParentTransaction'
import { ChildContractTransaction } from '../message/ChildTransaction'

import { ArbitrumNetwork } from '../dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'

/**
 * Base for bridging assets from parent-to-child and back
 */
export abstract class AssetBridger<DepositParams, WithdrawParams> {
  /**
   * In case of a chain that uses ETH as its native/gas token, this is either `undefined` or the zero address
   *
   * In case of a chain that uses an ERC-20 token from the parent chain as its native/gas token, this is the address of said token on the parent chain
   */
  public readonly nativeToken?: string

  public constructor(public readonly childChain: ArbitrumNetwork) {
    this.nativeToken = childChain.nativeToken
  }

  /**
   * Check the signer/provider matches the parentChain, throws if not
   * @param sop
   */
  protected async checkParentChain(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(
      sop,
      this.childChain.parentChainId
    )
  }

  /**
   * Check the signer/provider matches the childChain, throws if not
   * @param sop
   */
  protected async checkChildChain(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.childChain.chainId)
  }

  /**
   * Whether the chain uses ETH as its native/gas token
   * @returns {boolean}
   */
  protected get nativeTokenIsEth() {
    return !this.nativeToken || this.nativeToken === constants.AddressZero
  }

  /**
   * Transfer assets from parent-to-child
   * @param params
   */
  public abstract deposit(
    params: DepositParams
  ): Promise<ParentContractTransaction>

  /**
   * Transfer assets from child-to-parent
   * @param params
   */
  public abstract withdraw(
    params: WithdrawParams
  ): Promise<ChildContractTransaction>
}
