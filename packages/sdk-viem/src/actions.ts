import {
  ChildToParentMessageStatus,
  ChildTransactionReceipt,
  EthBridger,
  Erc20Bridger,
  ParentToChildMessageStatus,
  ParentTransactionReceipt,
} from '@arbitrum/sdk'
import {
  publicClientToProvider,
  viemTransactionReceiptToEthersTransactionReceipt,
} from '@offchainlabs/ethers-viem-compat'
import { BigNumber } from 'ethers'
import {
  Account,
  Address,
  Hash,
  PublicClient,
  TransactionRequest,
  WalletClient,
} from 'viem'

export const DEFAULT_CONFIRMATIONS = 1
export const DEFAULT_TIMEOUT = 1000 * 60 * 5 // 5 minutes

// Cross-chain transaction types
export type WaitForCrossChainTxParameters = {
  hash: Hash
  timeout?: number
  confirmations?: number
}

export type SendCrossChainTransactionParameters = {
  request: TransactionRequest
  timeout?: number
  confirmations?: number
}

export type CrossChainTransactionStatus = {
  status: 'success' | 'failed'
  complete: boolean
  message?: unknown
  childTxReceipt?: unknown
  hash: Hash
}

// Deposit types
export type PrepareDepositEthParameters = {
  amount: bigint
  account: Account | Address
}

export type DepositEthParameters = PrepareDepositEthParameters & {
  confirmations?: number
  timeout?: number
}

// ERC20 Deposit types
export type PrepareDepositErc20Parameters = {
  amount: bigint
  erc20ParentAddress: string
  account: Account | Address
  destinationAddress?: string
  childClient: PublicClient
}

export type DepositErc20Parameters = PrepareDepositErc20Parameters & {
  confirmations?: number
  timeout?: number
}

// ERC20 Deposit types
export type PrepareApproveErc20Parameters = {
  erc20ParentAddress: string
  amount?: bigint
  _account: Account | Address
}

export type ApproveErc20Parameters = Omit<
  PrepareApproveErc20Parameters,
  '_account'
> & {
  account: Account | Address
  confirmations?: number
  timeout?: number
}

export type ArbitrumDepositActions = {
  prepareDepositEthTransaction: (
    params: PrepareDepositEthParameters
  ) => Promise<TransactionRequest>
  prepareDepositErc20Transaction: (
    params: PrepareDepositErc20Parameters
  ) => Promise<TransactionRequest>
  prepareApproveErc20Transaction: (
    params: PrepareApproveErc20Parameters
  ) => Promise<TransactionRequest>
}

// Withdraw types
export type PrepareWithdrawEthParameters = {
  amount: bigint
  destinationAddress: Address
  account: Account | Address
}

export type WithdrawEthParameters = PrepareWithdrawEthParameters & {
  confirmations?: number
  timeout?: number
}

export type ArbitrumChildWalletActions = {
  prepareWithdrawEthTransaction: (
    params: PrepareWithdrawEthParameters
  ) => Promise<{
    request: TransactionRequest
    l1GasEstimate: bigint
  }>

  withdrawEth: (
    params: WithdrawEthParameters
  ) => Promise<CrossChainTransactionStatus>
}

// Parent wallet types
export type ArbitrumParentWalletActions = {
  waitForCrossChainTransaction: (
    params: WaitForCrossChainTxParameters
  ) => Promise<CrossChainTransactionStatus>

  sendCrossChainTransaction: (
    params: SendCrossChainTransactionParameters
  ) => Promise<CrossChainTransactionStatus>

  depositEth: (
    params: DepositEthParameters
  ) => Promise<CrossChainTransactionStatus>

  depositErc20: (
    params: DepositErc20Parameters
  ) => Promise<CrossChainTransactionStatus>

  approveErc20: (
    params: ApproveErc20Parameters
  ) => Promise<CrossChainTransactionStatus>
}

// Cross-chain transaction functions
export async function waitForCrossChainTransaction(
  parentClient: PublicClient,
  childClient: PublicClient,
  {
    hash,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: WaitForCrossChainTxParameters
): Promise<CrossChainTransactionStatus> {
  const childProvider = publicClientToProvider(childClient)

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
        hash,
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
        hash,
      }
    }
  } catch (e) {
    // Not a cross chain message
  }

  throw new Error('No cross chain message found in transaction')
}

export async function sendCrossChainTransaction(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    request,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: SendCrossChainTransactionParameters
): Promise<CrossChainTransactionStatus> {
  const hash = await walletClient.sendTransaction({
    ...request,
    chain: walletClient.chain,
    account: walletClient.account as Account,
    kzg: undefined,
  })

  return waitForCrossChainTransaction(parentClient, childClient, {
    hash,
    confirmations,
    timeout,
  })
}

// Deposit functions
export async function prepareDepositEthTransaction(
  client: PublicClient,
  { amount, account }: PrepareDepositEthParameters
): Promise<TransactionRequest> {
  const provider = publicClientToProvider(client)
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

export async function depositEth(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    amount,
    account,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: DepositEthParameters
): Promise<CrossChainTransactionStatus> {
  const request = await prepareDepositEthTransaction(childClient, {
    amount,
    account,
  })

  return sendCrossChainTransaction(parentClient, childClient, walletClient, {
    request,
    confirmations,
    timeout,
  })
}

export async function prepareDepositErc20Transaction(
  parentClient: PublicClient,
  {
    amount,
    erc20ParentAddress,
    account,
    destinationAddress,
    childClient,
  }: PrepareDepositErc20Parameters
): Promise<TransactionRequest> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)
  const request = await erc20Bridger.getDepositRequest({
    amount: BigNumber.from(amount),
    erc20ParentAddress,
    from: typeof account === 'string' ? account : account.address,
    destinationAddress,
    childProvider: childProvider,
    parentProvider: parentProvider,
  })

  return {
    to: request.txRequest.to as `0x${string}`,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as `0x${string}`,
  }
}

export async function depositErc20(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    amount,
    erc20ParentAddress,
    account,
    destinationAddress,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: DepositErc20Parameters
): Promise<CrossChainTransactionStatus> {
  const request = await prepareDepositErc20Transaction(parentClient, {
    amount,
    erc20ParentAddress,
    account,
    destinationAddress,
    childClient,
  })

  return sendCrossChainTransaction(parentClient, childClient, walletClient, {
    request,
    confirmations,
    timeout,
  })
}

// Approve ERC20 functions
export async function prepareApproveErc20Transaction(
  parentClient: PublicClient,
  childClient: PublicClient,
  { erc20ParentAddress, amount, _account }: PrepareApproveErc20Parameters
): Promise<TransactionRequest> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)
  const request = await erc20Bridger.getApproveTokenRequest({
    erc20ParentAddress,
    amount: amount ? BigNumber.from(amount) : undefined,
    parentProvider,
  })

  return {
    to: request.to as `0x${string}`,
    value: BigNumber.from(request.value).toBigInt(),
    data: request.data as `0x${string}`,
  }
}

export async function approveErc20(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    erc20ParentAddress,
    amount,
    account,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: ApproveErc20Parameters
): Promise<CrossChainTransactionStatus> {
  const request = await prepareApproveErc20Transaction(
    parentClient,
    childClient,
    {
      erc20ParentAddress,
      amount,
      _account: account,
    }
  )

  const hash = await walletClient.sendTransaction({
    ...request,
    chain: walletClient.chain,
    account: walletClient.account as Account,
    kzg: undefined,
  })

  const receipt = await parentClient.waitForTransactionReceipt({
    hash,
    confirmations,
    timeout,
  })

  return {
    status: receipt.status === 'success' ? 'success' : 'failed',
    complete: true,
    hash,
  }
}

// Withdraw functions
export async function prepareWithdrawEthTransaction(
  client: PublicClient,
  { amount, destinationAddress, account }: PrepareWithdrawEthParameters
): Promise<{
  request: TransactionRequest
  l1GasEstimate: bigint
}> {
  const provider = publicClientToProvider(client)
  const ethBridger = await EthBridger.fromProvider(provider)
  const request = await ethBridger.getWithdrawalRequest({
    amount: BigNumber.from(amount),
    destinationAddress,
    from: typeof account === 'string' ? account : account.address,
  })

  const l1GasEstimate = await request.estimateParentGasLimit(provider)

  return {
    request: {
      to: request.txRequest.to as `0x${string}`,
      value: BigNumber.from(request.txRequest.value).toBigInt(),
      data: request.txRequest.data as `0x${string}`,
    },
    l1GasEstimate: l1GasEstimate.toBigInt(),
  }
}

export async function withdrawEth(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    amount,
    destinationAddress,
    account,
    confirmations = DEFAULT_CONFIRMATIONS,
  }: WithdrawEthParameters
): Promise<CrossChainTransactionStatus> {
  const { request } = await prepareWithdrawEthTransaction(childClient, {
    amount,
    destinationAddress,
    account,
  })

  const hash = await walletClient.sendTransaction({
    ...request,
    chain: walletClient.chain,
    account: walletClient.account as Account,
    kzg: undefined,
  })

  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)

  const viemReceipt = await childClient.waitForTransactionReceipt({
    hash,
    confirmations,
  })

  const ethersReceipt =
    viemTransactionReceiptToEthersTransactionReceipt(viemReceipt)

  const childReceipt = new ChildTransactionReceipt(ethersReceipt)

  const messages = await childReceipt.getChildToParentMessages(parentProvider)
  if (messages.length === 0) {
    return {
      status: 'failed',
      complete: false,
      hash,
      message: undefined,
      childTxReceipt: undefined,
    }
  }

  const message = messages[0]
  const messageStatus = await message.status(childProvider)

  // For withdrawals, return early since it needs to wait for challenge period
  const isUnconfirmed = messageStatus === ChildToParentMessageStatus.UNCONFIRMED
  return {
    status: isUnconfirmed ? 'success' : 'failed',
    complete: false, // Not complete until executed after challenge period
    message,
    childTxReceipt: ethersReceipt,
    hash,
  }
}

// Client action creators
export function arbitrumParentClientActions() {
  return (client: PublicClient): ArbitrumDepositActions => ({
    prepareDepositEthTransaction: params =>
      prepareDepositEthTransaction(client, params),
    prepareDepositErc20Transaction: params =>
      prepareDepositErc20Transaction(client, params),
    prepareApproveErc20Transaction: (params: PrepareApproveErc20Parameters) =>
      prepareApproveErc20Transaction(client, client, params),
  })
}

export function arbitrumParentWalletActions(
  parentClient: PublicClient,
  childClient: PublicClient
) {
  return (walletClient: WalletClient): ArbitrumParentWalletActions => ({
    waitForCrossChainTransaction: (params: WaitForCrossChainTxParameters) =>
      waitForCrossChainTransaction(parentClient, childClient, params),
    sendCrossChainTransaction: (params: SendCrossChainTransactionParameters) =>
      sendCrossChainTransaction(
        parentClient,
        childClient,
        walletClient,
        params
      ),
    depositEth: (params: DepositEthParameters) =>
      depositEth(parentClient, childClient, walletClient, params),
    depositErc20: (params: DepositErc20Parameters) =>
      depositErc20(parentClient, childClient, walletClient, params),
    approveErc20: (params: ApproveErc20Parameters) =>
      approveErc20(parentClient, childClient, walletClient, params),
  })
}

export function arbitrumChildWalletActions(
  parentClient: PublicClient,
  childClient: PublicClient
) {
  return (walletClient: WalletClient): ArbitrumChildWalletActions => ({
    prepareWithdrawEthTransaction: (params: PrepareWithdrawEthParameters) =>
      prepareWithdrawEthTransaction(childClient, params),
    withdrawEth: (params: WithdrawEthParameters) =>
      withdrawEth(parentClient, childClient, walletClient, params),
  })
}
