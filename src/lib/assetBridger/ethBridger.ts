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
import { BigNumber, ethers } from 'ethers'

import { Inbox__factory } from '../abi/factories/Inbox__factory'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { SignerProviderUtils } from '../dataEntities/signerOrProvider'
import { MissingProviderArbSdkError } from '../dataEntities/errors'
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
  isL2ToL1TransactionRequest,
  L1ToL2TransactionRequest,
  L2ToL1TransactionRequest,
} from '../dataEntities/transactionRequest'

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

export type EthDepositParams = {
  /**
   * The L1 entity depositing the assets
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

export type L1ToL2TxReqAndSigner = L1ToL2TransactionRequest & {
  l1Signer: Signer
  overrides?: Overrides
}

export type L2ToL1TxReqAndSigner = L2ToL1TransactionRequest & {
  l2Signer: Signer
  overrides?: Overrides
}

/**
 * Bridger for moving ETH back and forth betwen L1 to L2
 */
export class EthBridger extends AssetBridger<
  EthDepositParams | L1ToL2TxReqAndSigner,
  EthWithdrawParams | L2ToL1TxReqAndSigner
> {
  private async depositTxOrGas<T extends boolean>(
    params: EthDepositParams | L1ToL2TxReqAndSigner,
    estimate: T
  ): Promise<T extends true ? BigNumber : ethers.ContractTransaction>
  private async depositTxOrGas<T extends boolean>(
    params: EthDepositParams | L1ToL2TxReqAndSigner,
    estimate: T
  ): Promise<BigNumber | ethers.ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.l1Signer)) {
      throw new MissingProviderArbSdkError('l1Signer')
    }
    await this.checkL1Network(params.l1Signer)

    const ethDeposit = isL1ToL2TransactionRequest(params)
      ? params
      : await this.getDepositRequest(params)

    return await params.l1Signer[estimate ? 'estimateGas' : 'sendTransaction']({
      ...ethDeposit.core,
      ...params.overrides,
    })
  }

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
      l2GasLimit: BigNumber.from(0),
      l2GasCostsMaxTotal: BigNumber.from(0),
      l2MaxFeePerGas: BigNumber.from(0),
      l2SubmissionFee: BigNumber.from(0),
      core: {
        to: this.l2Network.ethBridge.inbox,
        value: params.amount,
        data: functionData,
      },
      isValid: async () => true,
    }
  }

  /**
   * Estimate gas for depositing ETH from L1 onto L2
   * @param params
   * @returns
   */
  public async depositEstimateGas(
    params: EthDepositParams | L1ToL2TxReqAndSigner
  ): Promise<BigNumber> {
    return await this.depositTxOrGas(params, true)
  }

  /**
   * Deposit ETH from L1 onto L2
   * @param params
   * @returns
   */
  public async deposit(
    params: EthDepositParams | L1ToL2TxReqAndSigner
  ): Promise<L1EthDepositTransaction> {
    const tx = await this.depositTxOrGas(params, false)
    return L1TransactionReceipt.monkeyPatchEthDepositWait(tx)
  }

  public async getWithdrawalRequest(
    params: EthWithdrawParams
  ): Promise<L2ToL1TransactionRequest> {
    if (!SignerProviderUtils.signerHasProvider(params.l2Signer)) {
      throw new MissingProviderArbSdkError('l2Signer')
    }
    await this.checkL2Network(params.l2Signer)

    const addr =
      params.destinationAddress || (await params.l2Signer.getAddress())

    const iArbSys = ArbSys__factory.createInterface()
    const functionData = iArbSys.encodeFunctionData('withdrawEth', [addr])

    return {
      txRequest: {
        to: ARB_SYS_ADDRESS,
        data: functionData,
        value: params.amount,
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

  private async withdrawTxOrGas<T extends boolean>(
    params: EthWithdrawParams | L2ToL1TxReqAndSigner,
    estimate: T
  ): Promise<T extends true ? BigNumber : ethers.ContractTransaction>
  private async withdrawTxOrGas<T extends boolean>(
    params: EthWithdrawParams | L2ToL1TxReqAndSigner,
    estimate: T
  ): Promise<BigNumber | ethers.ContractTransaction> {
    if (!SignerProviderUtils.signerHasProvider(params.l2Signer)) {
      throw new MissingProviderArbSdkError('l2Signer')
    }
    await this.checkL2Network(params.l2Signer)

    const request = isL2ToL1TransactionRequest(params)
      ? params
      : await this.getWithdrawalRequest(params)

    return await params.l2Signer[estimate ? 'estimateGas' : 'sendTransaction']({
      ...request.txRequest,
      ...params.overrides,
    })
  }

  /**
   * Estimate gas for withdrawing ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdrawEstimateGas(
    params: EthWithdrawParams | L2ToL1TxReqAndSigner
  ): Promise<BigNumber> {
    return await this.withdrawTxOrGas(params, true)
  }

  /**
   * Withdraw ETH from L2 onto L1
   * @param params
   * @returns
   */
  public async withdraw(
    params: EthWithdrawParams | L2ToL1TxReqAndSigner
  ): Promise<L2ContractTransaction> {
    const tx = await this.withdrawTxOrGas(params, false)
    return L2TransactionReceipt.monkeyPatchWait(tx)
  }
}
