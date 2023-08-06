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

import { ArbSdkError } from '../dataEntities/errors'
import { L1ContractTransaction } from '../message/L1Transaction'
import { L2ContractTransaction } from '../message/L2Transaction'

import { l1Networks, L1Network, L2Network } from '../dataEntities/networks'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'

/**
 * Base for bridging assets from l1 to l2 and back
 * 
 * @typeParam DepositParams - Object with information to execute a deposit. For an example, see Erc20Bridger.Erc20DepositParams
 * @typeParam WithdrawParams - Object with information to execute a withdraw. For an example, see Erc20Bridger.Erc20WithdrawParams
 */
export abstract class AssetBridger<DepositParams, WithdrawParams> {
  /**
   * L1 network this bridger will operate with
   */
  public readonly l1Network: L1Network

  /**
   * @param l2Network - L2 network this bridger will operate with
   * @typeParam DepositParams - Object with information to execute a deposit. For an example, see Erc20Bridger.Erc20DepositParams
   * @typeParam WithdrawParams - Object with information to execute a withdraw. For an example, see Erc20Bridger.Erc20WithdrawParams
   * 
   * @throws {@link ArbSdkError} if `l2Network` does not have a correspondant L1 network in {@link l1Networks}
   */
  public constructor(public readonly l2Network: L2Network) {
    this.l1Network = l1Networks[l2Network.partnerChainID]
    if (!this.l1Network) {
      throw new ArbSdkError(
        `Unknown l1 network chain id: ${l2Network.partnerChainID}`
      )
    }
  }

  /**
   * Check the signer/provider matches the l1Network
   * 
   * @remarks
   * Only {@link https://docs.ethers.org/ | ethers} is allowed for the signer or provider object
   * 
   * @param sop - Signer or Provider from ethers
   */
  protected async checkL1Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l1Network.chainID)
  }

  /**
   * Check the signer/provider matches the l2Network
   * 
   * @remarks
   * Only {@link https://docs.ethers.org/ | ethers} is allowed for the signer or provider object
   * 
   * @param sop - Signer or Provider from ethers
   */
  protected async checkL2Network(sop: SignerOrProvider): Promise<void> {
    await SignerProviderUtils.checkNetworkMatches(sop, this.l2Network.chainID)
  }

  /**
   * Transfer assets from L1 to L2
   * 
   * @remarks
   * The actual content of the DepositParams object will depend on the child class used. For example, the parameters needed
   * in Erc20Bridger are different than in EthBridger as the processes to transfer ERC20 assets is different than the process
   * to transfer ETH.
   * 
   * @param params - Parameters needed to execute a deposit
   * @returns Response object for a transaction sent to an L1 contract
   */
  public abstract deposit(params: DepositParams): Promise<L1ContractTransaction>

  /**
   * Transfer assets from L2 to L1
   * 
   * @remarks
   * The actual content of the WithdrawParams object will depend on the child class used. For example, the parameters needed
   * in Erc20Bridger are different than in EthBridger as the processes to transfer ERC20 assets is different than the process
   * to transfer ETH.
   * 
   * @param params - Parameters needed to execute a withdraw
   * @returns Response object for a transaction sent to an L2 contract
   */
  public abstract withdraw(
    params: WithdrawParams
  ): Promise<L2ContractTransaction>
}
