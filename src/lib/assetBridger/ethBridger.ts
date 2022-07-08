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
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { SignerOrProvider } from '../dataEntities/signerOrProvider'
import { AssetBridger } from './assetBridger'
import {
  L1EthDepositTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import {
  L2ContractTransaction,
  L2TransactionReceipt,
} from '../message/L2Transaction'
import {
  isL1ToL2TransactionRequest,
  L1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'

export interface EthWithdrawParams {
  /**
   * L2 provider
   */
  l2SignerOrProvider: SignerOrProvider

  /**
   * address that is sending the assets
   */
  from: string

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

export type EthDepositParams = {
  /**
   * The L1 provider or signer
   */
  l1Signer: Signer

  /**
   * address that is depositing the assets
   */
  from: string

  /**
   * The amount of ETH or tokens to be deposited
   */
  amount: BigNumber

  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export type L1ToL2TxReqAndSigner = L1ToL2TransactionRequest & {
  l1Signer: Signer
  overrides?: Overrides
}

/**
 * Bridger for moving ETH back and forth betwen L1 to L2
 */
export class EthBridger extends AssetBridger<
  EthDepositParams,
  EthWithdrawParams
> {


  public async getDepositRequest(
    params: Omit<EthDepositParams, 'overrides'>
  ): Promise<L1ToL2TransactionRequest> {
    const inboxInterface = Inbox__factory.createInterface()

    const functionData = (
      inboxInterface as unknown as {
        encodeFunctionData(
          functionFragment: 'depositEth()',
          values?: undefined
        ): string
      }
    ).encodeFunctionData('depositEth()')

    return {
      core: {
        to: this.l2Network.ethBridge.inbox,
        value: params.amount,
        data: functionData,
      },
      isValid: async () => true,
    }
  }

  /**
   * Deposit ETH from L1 onto L2
   * @param params
   * @returns
   */
  public async deposit(
    params: EthDepositParams | L1ToL2TxReqAndSigner
  ): Promise<L1EthDepositTransaction> {
    await this.checkL1Network(params.l1Signer)

    const ethDeposit = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getDepositRequest(params)

      const tx = await params.l1Signer.sendTransaction({
        ...ethDeposit.core,
        ...params.overrides,
      })
    
    return L1TransactionReceipt.monkeyPatchEthDepositWait(tx)
  }

  /**
   * Withdraw ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: EthWithdrawParams
  ): Promise<L2ContractTransaction> {
    await this.checkL2Network(params.l2SignerOrProvider)

    const addr = params.destinationAddress || params.from
    const arbSys = ArbSys__factory.connect(
      ARB_SYS_ADDRESS,
      params.l2SignerOrProvider
    )

    const tx = await arbSys.functions.withdrawEth(
      addr,
      {
        value: params.amount,
        ...(params.overrides || {}),
      }
    )
    return L2TransactionReceipt.monkeyPatchWait(tx)
  }
}
