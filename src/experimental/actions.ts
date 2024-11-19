import { BigNumber } from 'ethers'
import { Account, Address, Chain, PublicClient, TransactionRequest } from 'viem'
import { EthBridger } from '../lib/assetBridger/ethBridger'
import { transformPublicClientToProvider } from './transformViemToEthers'

export type PrepareDepositEthParameters = {
  amount: bigint
  account: Account | Address
}

export type PrepareDepositEthToParameters = {
  amount: bigint
  account: Address
  destinationAddress: Address
  parentPublicClient: PublicClient
}

export type ArbitrumDepositActions = {
  prepareDepositEthTransaction: (
    params: PrepareDepositEthParameters
  ) => Promise<TransactionRequest>
  prepareDepositEthToTransaction: (
    params: PrepareDepositEthToParameters
  ) => Promise<TransactionRequest>
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

async function prepareDepositEthToTransaction(
  client: PublicClient,
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
    from: account,
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
  return (client: PublicClient): ArbitrumDepositActions => ({
    prepareDepositEthTransaction: params =>
      prepareDepositEthTransaction(client, params),
    prepareDepositEthToTransaction: params =>
      prepareDepositEthToTransaction(client, params),
  })
}
