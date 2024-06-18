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
import { Provider, TransactionRequest } from '@ethersproject/abstract-provider'
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { BigNumber, constants } from 'ethers'

import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { ERC20Inbox__factory } from '../abi/factories/ERC20Inbox__factory'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { AssetBridger } from './assetBridger'
import {
  ParentEthDepositTransaction,
  ParentContractCallTransaction,
  ParentTransactionReceipt,
} from '../message/ParentTransaction'
import {
  ChildContractTransaction,
  ChildTransactionReceipt,
} from '../message/ChildTransaction'
import { ParentToChildMessageCreator } from '../message/ParentToChildMessageCreator'
import { GasOverrides } from '../message/ParentToChildMessageGasEstimator'
import {
  isParentToChildTransactionRequest,
  isChildToParentTransactionRequest,
  ParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
} from '../dataEntities/transactionRequest'
import { OmitTyped } from '../utils/types'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getArbitrumNetwork } from '../dataEntities/networks'
import { ERC20__factory } from '../abi/factories/ERC20__factory'
import { isArbitrumChain } from '../utils/lib'

export type ApproveGasTokenParams = {
  /**
   * Amount to approve. Defaults to max int.
   */
  amount?: BigNumber
  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export type ApproveGasTokenTxRequest = {
  /**
   * Transaction request
   */
  txRequest: Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>>
  /**
   * Transaction overrides
   */
  overrides?: Overrides
}

export type ApproveGasTokenParamsOrTxRequest =
  | ApproveGasTokenParams
  | ApproveGasTokenTxRequest

type WithParentSigner<T extends ApproveGasTokenParamsOrTxRequest> = T & {
  parentSigner: Signer
}

export interface EthWithdrawParams {
  /**
   * The amount of ETH or tokens to be withdrawn
   */
  amount: BigNumber
  /**
   * The parent chain address to receive the value.
   */
  destinationAddress: string
  /**
   * The address of the withdrawal sender
   */
  from: string
  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export type EthDepositParams = {
  /**
   * Parent chain provider or signer
   */
  parentSigner: Signer
  /**
   * The amount of ETH or tokens to be deposited
   */
  amount: BigNumber
  /**
   * Transaction overrides
   */
  overrides?: PayableOverrides
}

export type EthDepositToParams = EthDepositParams & {
  /**
   * Child chain provider
   */
  childProvider: Provider
  /**
   * Child chain address of the entity receiving the funds
   */
  destinationAddress: string
  /**
   * Overrides for the retryable ticket parameters
   */
  retryableGasOverrides?: GasOverrides
}

export type ParentToChildTxReqAndSigner = ParentToChildTransactionRequest & {
  parentSigner: Signer
  overrides?: Overrides
}

export type ChildToParentTxReqAndSigner = ChildToParentTransactionRequest & {
  childSigner: Signer
  overrides?: Overrides
}

type EthDepositRequestParams = OmitTyped<
  EthDepositParams,
  'overrides' | 'parentSigner'
> & { from: string }

type EthDepositToRequestParams = OmitTyped<
  EthDepositToParams,
  'overrides' | 'parentSigner'
> & {
  /**
   * Parent chain provider
   */
  parentProvider: Provider
  /**
   * Address that is depositing the ETH
   */
  from: string
}

/**
 * Bridger for moving either ETH or custom gas tokens back and forth between parent and child chains
 */
export class EthBridger extends AssetBridger<
  EthDepositParams | EthDepositToParams | ParentToChildTxReqAndSigner,
  EthWithdrawParams | ChildToParentTxReqAndSigner
> {
  /**
   * Instantiates a new EthBridger from a child chain Provider
   * @param childProvider
   * @returns
   */
  public static async fromProvider(childProvider: Provider) {
    return new EthBridger(await getArbitrumNetwork(childProvider))
  }

  /**
   * Asserts that the provided argument is of type `ApproveGasTokenParams` and not `ApproveGasTokenTxRequest`.
   * @param params
   */
  private isApproveGasTokenParams(
    params: ApproveGasTokenParamsOrTxRequest
  ): params is WithParentSigner<ApproveGasTokenParams> {
    return typeof (params as ApproveGasTokenTxRequest).txRequest === 'undefined'
  }

  /**
   * Creates a transaction request for approving the custom gas token to be spent by the inbox on the parent chain
   * @param params
   */
  public getApproveGasTokenRequest(
    params?: ApproveGasTokenParams
  ): Required<Pick<TransactionRequest, 'to' | 'data' | 'value'>> {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const data = ERC20__factory.createInterface().encodeFunctionData(
      'approve',
      [
        // spender
        this.childChain.ethBridge.inbox,
        // value
        params?.amount ?? constants.MaxUint256,
      ]
    )

    return {
      to: this.nativeToken!,
      data,
      value: BigNumber.from(0),
    }
  }

  /**
   * Approves the custom gas token to be spent by the Inbox on the parent chain.
   * @param params
   */
  public async approveGasToken(
    params: WithParentSigner<ApproveGasTokenParamsOrTxRequest>
  ) {
    if (this.nativeTokenIsEth) {
      throw new Error('chain uses ETH as its native/gas token')
    }

    const approveGasTokenRequest = this.isApproveGasTokenParams(params)
      ? this.getApproveGasTokenRequest(params)
      : params.txRequest

    return params.parentSigner.sendTransaction({
      ...approveGasTokenRequest,
      ...params.overrides,
    })
  }

  /**
   * Gets transaction calldata for a tx request for depositing ETH or custom gas token
   * @param params
   * @returns
   */
  private getDepositRequestData(params: EthDepositRequestParams) {
    if (!this.nativeTokenIsEth) {
      return (
        ERC20Inbox__factory.createInterface() as unknown as {
          encodeFunctionData(
            functionFragment: 'depositERC20(uint256)',
            values: [BigNumber]
          ): string
        }
      ).encodeFunctionData('depositERC20(uint256)', [params.amount])
    }

    return (
      Inbox__factory.createInterface() as unknown as {
        encodeFunctionData(
          functionFragment: 'depositEth()',
          values?: undefined
        ): string
      }
    ).encodeFunctionData('depositEth()')
  }

  /**
   * Gets tx request for depositing ETH or custom gas token
   * @param params
   * @returns
   */
  public async getDepositRequest(
    params: EthDepositRequestParams
  ): Promise<OmitTyped<ParentToChildTransactionRequest, 'retryableData'>> {
    return {
      txRequest: {
        to: this.childChain.ethBridge.inbox,
        value: this.nativeTokenIsEth ? params.amount : 0,
        data: this.getDepositRequestData(params),
        from: params.from,
      },
      isValid: async () => true,
    }
  }

  /**
   * Deposit ETH from Parent onto Child chain
   * @param params
   * @returns
   */
  public async deposit(
    params: EthDepositParams | ParentToChildTxReqAndSigner
  ): Promise<ParentEthDepositTransaction> {
    await this.checkParentChain(params.parentSigner)

    const ethDeposit = isParentToChildTransactionRequest(params)
      ? params
      : await this.getDepositRequest({
          ...params,
          from: await params.parentSigner.getAddress(),
        })

    const tx = await params.parentSigner.sendTransaction({
      ...ethDeposit.txRequest,
      ...params.overrides,
    })

    return ParentTransactionReceipt.monkeyPatchEthDepositWait(tx)
  }

  /**
   * Get a transaction request for an ETH deposit to a different child chain address using Retryables
   * @param params
   * @returns
   */
  public async getDepositToRequest(
    params: EthDepositToRequestParams
  ): Promise<ParentToChildTransactionRequest> {
    const requestParams = {
      ...params,
      to: params.destinationAddress,
      l2CallValue: params.amount,
      callValueRefundAddress: params.destinationAddress,
      data: '0x',
    }

    // Gas overrides can be passed in the parameters
    const gasOverrides = params.retryableGasOverrides || undefined

    return ParentToChildMessageCreator.getTicketCreationRequest(
      requestParams,
      params.parentProvider,
      params.childProvider,
      gasOverrides
    )
  }

  /**
   * Deposit ETH from parent chain onto a different child chain address
   * @param params
   * @returns
   */
  public async depositTo(
    params:
      | EthDepositToParams
      | (ParentToChildTxReqAndSigner & { childProvider: Provider })
  ): Promise<ParentContractCallTransaction> {
    await this.checkParentChain(params.parentSigner)
    await this.checkChildChain(params.childProvider)

    const retryableTicketRequest = isParentToChildTransactionRequest(params)
      ? params
      : await this.getDepositToRequest({
          ...params,
          from: await params.parentSigner.getAddress(),
          parentProvider: params.parentSigner.provider!,
        })

    const parentToChildMessageCreator = new ParentToChildMessageCreator(
      params.parentSigner
    )

    const tx = await parentToChildMessageCreator.createRetryableTicket(
      retryableTicketRequest,
      params.childProvider
    )

    return ParentTransactionReceipt.monkeyPatchContractCallWait(tx)
  }

  /**
   * Get a transaction request for an eth withdrawal
   * @param params
   * @returns
   */
  public async getWithdrawalRequest(
    params: EthWithdrawParams
  ): Promise<ChildToParentTransactionRequest> {
    const iArbSys = ArbSys__factory.createInterface()
    const functionData = iArbSys.encodeFunctionData('withdrawEth', [
      params.destinationAddress,
    ])

    return {
      txRequest: {
        to: ARB_SYS_ADDRESS,
        data: functionData,
        value: params.amount,
        from: params.from,
      },
      // todo: do proper estimation
      estimateParentGasLimit: async (parentProvider: Provider) => {
        if (await isArbitrumChain(parentProvider)) {
          // values for L3 are dependent on the L1 base fee, so hardcoding can never be accurate
          // however, this is only an estimate used for display, so should be good enough
          //
          // measured with withdrawals from Xai and Rari then added some padding
          return BigNumber.from(4_000_000)
        }

        // measured 126998 - add some padding
        return BigNumber.from(130000)
      },
    }
  }

  /**
   * Withdraw ETH from child chain onto parent chain
   * @param params
   * @returns
   */
  public async withdraw(
    params:
      | (EthWithdrawParams & { childSigner: Signer })
      | ChildToParentTxReqAndSigner
  ): Promise<ChildContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.childSigner)) {
      throw new MissingProviderArbSdkError('childSigner')
    }
    await this.checkChildChain(params.childSigner)

    const request = isChildToParentTransactionRequest<
      EthWithdrawParams & { childSigner: Signer }
    >(params)
      ? params
      : await this.getWithdrawalRequest(params)

    const tx = await params.childSigner.sendTransaction({
      ...request.txRequest,
      ...params.overrides,
    })
    return ChildTransactionReceipt.monkeyPatchWait(tx)
  }
}
