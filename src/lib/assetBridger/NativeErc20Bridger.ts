/*
 * Copyright 2023, Offchain Labs, Inc.
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
import { BigNumber, constants } from 'ethers'

import { ERC20Inbox__factory } from '../abi/factories/ERC20Inbox__factory'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import {
  L1EthDepositTransaction,
  L1ContractCallTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import { L1ToL2MessageCreator } from '../message/L1ToL2MessageCreator'
import {
  isL1ToL2TransactionRequest,
  L1ToL2TransactionRequest,
} from '../dataEntities/transactionRequest'
import { OmitTyped } from '../utils/types'
import { ArbSdkError } from '../dataEntities/errors'
import { L2Network, getL2Network } from '../dataEntities/networks'
import {
  EthBridger,
  EthDepositParams,
  EthDepositRequestParams,
  EthDepositToParams,
  EthDepositToRequestParams,
  L1ToL2TxReqAndSigner,
} from './ethBridger'

/**
 * Bridger for moving ETH back and forth between L1 to L2
 */
export class NativeErc20Bridger extends EthBridger {
  /**
   * The address of the native ERC-20 token on the parent chain.
   */
  protected readonly nativeToken: string

  public constructor(public readonly l2Network: L2Network) {
    super(l2Network)

    if (typeof l2Network.nativeToken === 'undefined') {
      throw new ArbSdkError(
        `native token is missing from the l2 network object`
      )
    }

    this.nativeToken = l2Network.nativeToken
  }

  /**
   * Instantiates a new NativeErc20Bridger from an L2 Provider
   * @param l2Provider
   * @returns
   */
  public static async fromProvider(l2Provider: Provider) {
    return new NativeErc20Bridger(await getL2Network(l2Provider))
  }

  // TODO(spsjvc): clean up, support tx request and add jsdoc
  public async approve(params: { amount?: BigNumber; l1Signer: Signer }) {
    const token = ERC20__factory.connect(this.nativeToken, params.l1Signer)
    return token.approve(
      this.l2Network.ethBridge.inbox,
      params.amount ?? constants.MaxUint256
    )
  }

  /**
   * Get a transaction request for a native ERC-20 deposit
   * @param params
   * @returns
   */
  public async getDepositRequest(
    params: EthDepositRequestParams
  ): Promise<OmitTyped<L1ToL2TransactionRequest, 'retryableData'>> {
    const inboxInterface = ERC20Inbox__factory.createInterface()

    const functionData = (
      inboxInterface as unknown as {
        encodeFunctionData(
          functionFragment: 'depositERC20(uint256)',
          values: [BigNumber]
        ): string
      }
    ).encodeFunctionData('depositERC20(uint256)', [params.amount])

    return {
      txRequest: {
        to: this.l2Network.ethBridge.inbox,
        value: constants.Zero,
        data: functionData,
        from: params.from,
      },
      isValid: async () => true,
    }
  }

  /**
   * Deposit native ERC-20 from L1 onto L2
   * @param params
   * @returns
   */
  public async deposit(
    params: EthDepositParams | L1ToL2TxReqAndSigner
  ): Promise<L1EthDepositTransaction> {
    await this.checkL1Network(params.l1Signer)

    const ethDeposit = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getDepositRequest({
          ...params,
          from: await params.l1Signer.getAddress(),
        })

    const tx = await params.l1Signer.sendTransaction({
      ...ethDeposit.txRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchEthDepositWait(tx)
  }

  /**
   * Get a transaction request for an ETH deposit to a different L2 address using Retryables
   * @param params
   * @returns
   */
  public async getDepositToRequest(
    params: EthDepositToRequestParams
  ): Promise<L1ToL2TransactionRequest> {
    const requestParams = {
      ...params,
      to: params.destinationAddress,
      l2CallValue: params.amount,
      callValueRefundAddress: params.destinationAddress,
      data: '0x',
    }

    // Gas overrides can be passed in the parameters
    const gasOverrides = params.retryableGasOverrides || undefined

    return L1ToL2MessageCreator.getTicketCreationRequest(
      requestParams,
      params.l1Provider,
      params.l2Provider,
      gasOverrides
    )
  }

  /**
   * Deposit ETH from L1 onto a different L2 address
   * @param params
   * @returns
   */
  public async depositTo(
    params:
      | EthDepositToParams
      | (L1ToL2TxReqAndSigner & { l2Provider: Provider })
  ): Promise<L1ContractCallTransaction> {
    await this.checkL1Network(params.l1Signer)
    await this.checkL2Network(params.l2Provider)

    const retryableTicketRequest = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getDepositToRequest({
          ...params,
          from: await params.l1Signer.getAddress(),
          l1Provider: params.l1Signer.provider!,
        })

    const tx = await params.l1Signer.sendTransaction({
      ...retryableTicketRequest.txRequest,
      ...params.overrides,
    })

    return L1TransactionReceipt.monkeyPatchContractCallWait(tx)
  }
}
