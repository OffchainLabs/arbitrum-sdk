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
import { PayableOverrides, Overrides } from '@ethersproject/contracts'
import { JsonRpcProvider, WebSocketProvider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'

import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { AssetBridger } from './assetBridger'
import {
  L1EthDepositTransaction,
  L1ContractCallTransaction,
  L1TransactionReceipt,
} from '../message/L1Transaction'
import {
  L2ContractTransaction,
  L2TransactionReceipt,
} from '../message/L2Transaction'
import { L1ToL2MessageCreator } from '../message/L1ToL2MessageCreator'
import { GasOverrides } from '../message/L1ToL2MessageGasEstimator'
import {
  isL1ToL2TransactionRequest,
  isL2ToL1TransactionRequest,
  L1ToL2TransactionRequest,
  L2ToL1TransactionRequest,
} from '../dataEntities/transactionRequest'
import { OmitTyped } from '../utils/types'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
import { getL2Network } from '../dataEntities/networks'
import { Providerish, getProviderUrl } from '../utils/providerTransforms'

export interface EthWithdrawParams {
  /**
   * The amount of ETH or tokens to be withdrawn
   */
  amount: BigNumber
  /**
   * The L1 address to receive the value.
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
   * The L1 provider or signer
   */
  l1Signer: Signer
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
   * An L2 provider
   */
  l2Provider: Provider
  /**
   * L2 address of the entity receiving the funds
   */
  destinationAddress: string
  /**
   * Overrides for the retryable ticket parameters
   */
  retryableGasOverrides?: GasOverrides
}

export type L1ToL2TxReqAndSigner = L1ToL2TransactionRequest & {
  l1Signer: Signer
  overrides?: Overrides
}

export type L2ToL1TxReqAndSigner = L2ToL1TransactionRequest & {
  l2Signer: Signer
  overrides?: Overrides
}

type EthDepositRequestParams = OmitTyped<
  EthDepositParams,
  'overrides' | 'l1Signer'
> & { from: string }

type EthDepositToRequestParams = OmitTyped<
  EthDepositToParams,
  'overrides' | 'l1Signer'
> & {
  /**
   * The L1 provider
   */
  l1Provider: Provider
  /**
   * Address that is depositing the ETH
   */
  from: string
}

/**
 * Bridger for moving ETH back and forth between L1 to L2
 */
export class EthBridger extends AssetBridger<
  EthDepositParams | EthDepositToParams | L1ToL2TxReqAndSigner,
  EthWithdrawParams | L2ToL1TxReqAndSigner
> {
  /**
   * Instantiates a new EthBridger from an L2 Provider
   * @param l2Provider
   * @returns
   */
  public static async fromProvider(l2Provider: Provider | Providerish) {
    if (l2Provider instanceof Provider) {
      return new EthBridger(await getL2Network(l2Provider))
    }
    const url = getProviderUrl(l2Provider)

    if (!url) {
      throw new Error('Unable to get URL from provider')
    }

    if (url.startsWith('ws')) {
      const provider = new WebSocketProvider(url)
      return new EthBridger(await getL2Network(provider))
    }

    try {
      new URL(url)
    } catch (_) {
      throw new Error('Invalid URL received from provider')
    }

    const provider = new JsonRpcProvider(url)
    return new EthBridger(await getL2Network(provider))
  }

  /**
   * Get a transaction request for an eth deposit
   * @param params
   * @returns
   */
  public async getDepositRequest(
    params: EthDepositRequestParams
  ): Promise<OmitTyped<L1ToL2TransactionRequest, 'retryableData'>> {
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
      txRequest: {
        to: this.l2Network.ethBridge.inbox,
        value: params.amount,
        data: functionData,
        from: params.from,
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

  /**
   * Get a transaction request for an eth withdrawal
   * @param params
   * @returns
   */
  public async getWithdrawalRequest(
    params: EthWithdrawParams
  ): Promise<L2ToL1TransactionRequest> {
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
      // we make this async and expect a provider since we
      // in the future we want to do proper estimation here
      /* eslint-disable @typescript-eslint/no-unused-vars */
      estimateL1GasLimit: async (l1Provider: Provider) => {
        //  measured 126998 - add some padding
        return BigNumber.from(130000)
      },
    }
  }

  /**
   * Withdraw ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: (EthWithdrawParams & { l2Signer: Signer }) | L2ToL1TxReqAndSigner
  ): Promise<L2ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.l2Signer)) {
      throw new MissingProviderArbSdkError('l2Signer')
    }
    await this.checkL2Network(params.l2Signer)

    const request = isL2ToL1TransactionRequest<
      EthWithdrawParams & { l2Signer: Signer }
    >(params)
      ? params
      : await this.getWithdrawalRequest(params)

    const tx = await params.l2Signer.sendTransaction({
      ...request.txRequest,
      ...params.overrides,
    })
    return L2TransactionReceipt.monkeyPatchWait(tx)
  }
}
