import { BigNumber } from 'ethers'
import {
  Account,
  Address,
  Hash,
  PublicClient,
  TransactionRequest,
  WalletClient,
} from 'viem'
import { EthBridger } from '../lib/assetBridger/ethBridger'
import {
  transformPublicClientToProvider,
  viemTransactionReceiptToEthersTransactionReceipt,
} from './transformViemToEthers'
import { ParentTransactionReceipt } from '../lib/message/ParentTransaction'
import { ParentToChildMessageStatus } from '../lib/message/ParentToChildMessage'

export type PrepareDepositEthParameters = {
  amount: bigint
  account: Account | Address
}

export type WaitForCrossChainTxParameters = {
  hash: Hash
  timeout?: number
  confirmations?: number
}

export type CrossChainTransactionStatus = {
  status: 'success' | 'failed'
  complete: boolean
  message?: unknown
  childTxReceipt?: unknown
}

export type ArbitrumDepositActions = {
  prepareDepositEthTransaction: (
    params: PrepareDepositEthParameters
  ) => Promise<TransactionRequest>
}

export type ArbitrumParentWalletActions = {
  waitForCrossChainTransaction: (
    params: WaitForCrossChainTxParameters
  ) => Promise<CrossChainTransactionStatus>
}

async function prepareDepositEthTransaction(
  client: PublicClient,
  { amount, account }: PrepareDepositEthParameters
): Promise<TransactionRequest> {
  const provider = transformPublicClientToProvider(client)
  const ethBridger = await EthBridger.fromProvider(provider)
  const request = await ethBridger.getDepositRequest({
    amount: BigNumber.from(amount),
    from: typeof account === 'string' ? account : account.address,
  })

  return {
    to: request.txRequest.to as `0x${string}`,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as `0x${string}`,
  }
}

async function waitForCrossChainTransaction(
  parentClient: PublicClient,
  childClient: PublicClient,
  { hash, timeout, confirmations }: WaitForCrossChainTxParameters
): Promise<CrossChainTransactionStatus> {
  const childProvider = transformPublicClientToProvider(childClient)

  // Wait for the transaction to be mined and get the receipt
  const viemReceipt = await parentClient.waitForTransactionReceipt({
    hash,
    confirmations,
  })

  const ethersReceipt =
    viemTransactionReceiptToEthersTransactionReceipt(viemReceipt)
  const parentReceipt = new ParentTransactionReceipt(ethersReceipt)

  // Try to get eth deposits first
  try {
    const ethDeposits = await parentReceipt.getEthDeposits(childProvider)
    if (ethDeposits.length > 0) {
      const result = await ethDeposits[0].wait(confirmations, timeout)
      return {
        status: result ? 'success' : 'failed',
        complete: Boolean(result),
        message: ethDeposits[0],
        childTxReceipt: result,
      }
    }
  } catch (e) {
    // Not an eth deposit, continue to check for other message types
  }

  // Check for other cross chain messages
  try {
    const messages = await parentReceipt.getParentToChildMessages(childProvider)
    if (messages.length > 0) {
      const result = await messages[0].waitForStatus(confirmations, timeout)
      return {
        status:
          result.status === ParentToChildMessageStatus.REDEEMED
            ? 'success'
            : 'failed',
        complete: result.status === ParentToChildMessageStatus.REDEEMED,
        message: messages[0],
        childTxReceipt: result,
      }
    }
  } catch (e) {
    // Not a cross chain message
  }

  throw new Error('No cross chain message found in transaction')
}

export function arbitrumDepositActions() {
  return (client: PublicClient): ArbitrumDepositActions => ({
    prepareDepositEthTransaction: params =>
      prepareDepositEthTransaction(client, params),
  })
}

export function arbitrumParentWalletActions(
  parentClient: PublicClient,
  childClient: PublicClient
) {
  return (walletClient: WalletClient): ArbitrumParentWalletActions => ({
    waitForCrossChainTransaction: (params: WaitForCrossChainTxParameters) =>
      waitForCrossChainTransaction(parentClient, childClient, params),
  })
}
