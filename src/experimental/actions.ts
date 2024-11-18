import { BigNumber } from 'ethers'
import {
  Account,
  Address,
  Client,
  type PublicClient,
  TransactionRequest,
} from 'viem'
import { EthBridger } from '../lib/assetBridger/ethBridger'
import { transformPublicClientToProvider } from './transformViemToEthers'

export type PrepareDepositEthParameters = {
  amount: bigint
  account: Account | Address
}

export type PrepareDepositEthToParameters = PrepareDepositEthParameters & {
  destinationAddress: Address
  parentPublicClient: PublicClient
}

export async function prepareDepositEthTransaction(
  client: Client,
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

export async function prepareDepositEthToTransaction(
  client: Client,
  {
    amount,
    account,
    destinationAddress,
    parentPublicClient,
  }: PrepareDepositEthToParameters
): Promise<TransactionRequest> {
  const childProvider = transformPublicClientToProvider(client)
  const parentProvider = transformPublicClientToProvider(parentPublicClient)
  const ethBridger = await EthBridger.fromProvider(childProvider)

  const request = await ethBridger.getDepositToRequest({
    amount: BigNumber.from(amount),
    destinationAddress,
    from: typeof account === 'string' ? account : account.address,
    parentProvider,
    childProvider,
  })

  return {
    to: request.txRequest.to as `0x${string}`,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as `0x${string}`,
  }
}

export function arbitrumDepositActions() {
  return function (client: Client) {
    return {
      prepareDepositEthTransaction: (args: PrepareDepositEthParameters) =>
        prepareDepositEthTransaction(client, args),
      prepareDepositEthToTransaction: (args: PrepareDepositEthToParameters) =>
        prepareDepositEthToTransaction(client, args),
    }
  }
}
