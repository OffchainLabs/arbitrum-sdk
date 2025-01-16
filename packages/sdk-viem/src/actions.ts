import {
  ChildToParentMessageStatus,
  ChildTransactionReceipt,
  EthBridger,
  Erc20Bridger,
  ParentToChildMessageStatus,
  ParentTransactionReceipt,
  ParentToChildTransactionRequest,
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
  request: TransactionRequest | ParentToChildTransactionRequest
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

// Deposit types
export type PrepareDepositEthToParameters = {
  amount: bigint
  account: Account | Address
  destinationAddress: string
  retryableGasOverrides?: {
    gasLimit?: {
      base?: BigNumber
      percentIncrease?: BigNumber
      min?: BigNumber
    }
    maxSubmissionFee?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
    maxFeePerGas?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
    deposit?: {
      base?: BigNumber
    }
  }
}

export type DepositEthToParameters = PrepareDepositEthToParameters & {
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
  retryableGasOverrides?: {
    gasLimit?: {
      base?: BigNumber
      percentIncrease?: BigNumber
      min?: BigNumber
    }
    maxSubmissionFee?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
    maxFeePerGas?: {
      base?: BigNumber
      percentIncrease?: BigNumber
    }
    deposit?: {
      base?: BigNumber
    }
  }
  maxSubmissionCost?: BigNumber
  excessFeeRefundAddress?: string
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

// ERC20 Gas Token Approval types
export type PrepareApproveGasTokenParameters = {
  erc20ParentAddress: string
  amount?: bigint
  _account: Account | Address
}

export type ApproveGasTokenParameters = Omit<
  PrepareApproveGasTokenParameters,
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
  prepareDepositEthToTransaction: (
    params: PrepareDepositEthToParameters
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

// ERC20 Withdraw types
export type PrepareWithdrawErc20Parameters = {
  amount: bigint
  erc20ParentAddress: string
  destinationAddress: Address
  account: Account | Address
}

export type WithdrawErc20Parameters = PrepareWithdrawErc20Parameters & {
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

  prepareWithdrawErc20Transaction: (
    params: PrepareWithdrawErc20Parameters
  ) => Promise<{
    request: TransactionRequest
    l1GasEstimate: bigint
  }>

  withdrawErc20: (
    params: WithdrawErc20Parameters
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

  approveGasToken: (
    params: ApproveGasTokenParameters
  ) => Promise<CrossChainTransactionStatus>

  depositEthTo: (
    params: DepositEthToParameters
  ) => Promise<CrossChainTransactionStatus>
}

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
    to: request.txRequest.to as Address,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as Address,
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
    retryableGasOverrides,
    maxSubmissionCost,
    excessFeeRefundAddress,
  }: PrepareDepositErc20Parameters
): Promise<TransactionRequest> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)

  const depositParams = {
    parentProvider,
    childProvider,
    erc20ParentAddress,
    amount: BigNumber.from(amount),
    maxSubmissionCost,
    excessFeeRefundAddress:
      excessFeeRefundAddress ||
      (typeof account === 'string' ? account : account.address),
    destinationAddress:
      destinationAddress ||
      (typeof account === 'string' ? account : account.address),
    retryableGasOverrides,
    from: typeof account === 'string' ? account : account.address,
  }

  const request = await erc20Bridger.getDepositRequest(depositParams)
  return {
    to: request.txRequest.to as `0x${string}`,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as `0x${string}`,
    from: request.txRequest.from as `0x${string}`,
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
    retryableGasOverrides,
    maxSubmissionCost,
    excessFeeRefundAddress,
  }: DepositErc20Parameters
): Promise<CrossChainTransactionStatus> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)

  // Validate token registration
  const isRegistered = await erc20Bridger.isRegistered({
    erc20ParentAddress,
    parentProvider,
    childProvider,
  })

  if (!isRegistered) {
    const parentChainId = (await parentProvider.getNetwork()).chainId
    throw new Error(
      `Token ${erc20ParentAddress} on chain ${parentChainId} is not registered on the gateways`
    )
  }

  // Get gateway address for allowance check
  const expectedParentGatewayAddress =
    await erc20Bridger.getParentGatewayAddress(
      erc20ParentAddress,
      parentProvider
    )

  // Check token allowance
  const parentToken = erc20Bridger.getParentTokenContract(
    parentProvider,
    erc20ParentAddress
  )
  const senderAddress = typeof account === 'string' ? account : account.address
  const allowance = await parentToken.allowance(
    senderAddress,
    expectedParentGatewayAddress
  )

  if (allowance.lt(BigNumber.from(amount))) {
    throw new Error(
      'Insufficient token allowance. Please approve tokens before depositing.'
    )
  }

  // Check if using custom fee token
  const nativeToken = erc20Bridger.nativeToken
  if (nativeToken) {
    const feeTokenContract = erc20Bridger.getParentTokenContract(
      parentProvider,
      nativeToken
    )
    const feeTokenAllowance = await feeTokenContract.allowance(
      senderAddress,
      expectedParentGatewayAddress
    )

    if (feeTokenAllowance.lt(Erc20Bridger.MAX_APPROVAL)) {
      throw new Error(
        'Insufficient gas token allowance. Please approve gas token before depositing.'
      )
    }
  }

  // Prepare and send the deposit transaction
  const request = await prepareDepositErc20Transaction(parentClient, {
    amount,
    erc20ParentAddress,
    account,
    destinationAddress,
    childClient,
    retryableGasOverrides,
    maxSubmissionCost,
    excessFeeRefundAddress,
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

// Approve Gas Token functions
export async function prepareApproveGasTokenTransaction(
  parentClient: PublicClient,
  childClient: PublicClient,
  { erc20ParentAddress, amount, _account }: PrepareApproveGasTokenParameters
): Promise<TransactionRequest> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)

  if (!erc20Bridger.nativeToken) {
    throw new Error('chain uses ETH as its native/gas token')
  }

  const request = await erc20Bridger.getApproveGasTokenRequest({
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

export async function approveGasToken(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    erc20ParentAddress,
    amount,
    account,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: ApproveGasTokenParameters
): Promise<CrossChainTransactionStatus> {
  const request = await prepareApproveGasTokenTransaction(
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

// Withdraw ERC20 functions
export async function prepareWithdrawErc20Transaction(
  client: PublicClient,
  {
    amount,
    erc20ParentAddress,
    destinationAddress,
    account,
  }: PrepareWithdrawErc20Parameters
): Promise<{
  request: TransactionRequest
  l1GasEstimate: bigint
}> {
  const provider = publicClientToProvider(client)
  const erc20Bridger = await Erc20Bridger.fromProvider(provider)
  const request = await erc20Bridger.getWithdrawalRequest({
    amount: BigNumber.from(amount),
    erc20ParentAddress,
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

export async function withdrawErc20(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    amount,
    erc20ParentAddress,
    destinationAddress,
    account,
    confirmations = DEFAULT_CONFIRMATIONS,
  }: WithdrawErc20Parameters
): Promise<CrossChainTransactionStatus> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)
  const erc20Bridger = await Erc20Bridger.fromProvider(childProvider)

  // Get the withdrawal request from the bridger
  const withdrawalRequest = await erc20Bridger.getWithdrawalRequest({
    amount: BigNumber.from(amount),
    erc20ParentAddress,
    destinationAddress,
    from: typeof account === 'string' ? account : account.address,
  })

  // Send the transaction
  const hash = await walletClient.sendTransaction({
    to: withdrawalRequest.txRequest.to as `0x${string}`,
    data: withdrawalRequest.txRequest.data as `0x${string}`,
    value: BigNumber.from(withdrawalRequest.txRequest.value).toBigInt(),
    chain: walletClient.chain,
    account: walletClient.account as Account,
    kzg: undefined,
  })

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

// Add new prepareDepositEthToTransaction function
export async function prepareDepositEthToTransaction(
  client: PublicClient,
  childClient: PublicClient,
  {
    amount,
    account,
    destinationAddress,
    retryableGasOverrides,
  }: PrepareDepositEthToParameters
): Promise<TransactionRequest> {
  const provider = publicClientToProvider(client)
  const childProvider = publicClientToProvider(childClient)
  const ethBridger = await EthBridger.fromProvider(childProvider)
  const request = await ethBridger.getDepositToRequest({
    amount: BigNumber.from(amount),
    destinationAddress,
    from: typeof account === 'string' ? account : account.address,
    parentProvider: provider,
    childProvider,
    retryableGasOverrides,
  })

  return {
    to: request.txRequest.to as `0x${string}`,
    value: BigNumber.from(request.txRequest.value).toBigInt(),
    data: request.txRequest.data as `0x${string}`,
  }
}

export async function depositEthTo(
  parentClient: PublicClient,
  childClient: PublicClient,
  walletClient: WalletClient,
  {
    amount,
    account,
    destinationAddress,
    retryableGasOverrides,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
  }: DepositEthToParameters
): Promise<CrossChainTransactionStatus> {
  const request = await prepareDepositEthToTransaction(
    parentClient,
    childClient,
    {
      amount,
      account,
      destinationAddress,
      retryableGasOverrides,
    }
  )

  return sendCrossChainTransaction(parentClient, childClient, walletClient, {
    request,
    confirmations,
    timeout,
  })
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
    prepareDepositEthToTransaction: (params: PrepareDepositEthToParameters) =>
      prepareDepositEthToTransaction(client, client, params),
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
    depositEthTo: (params: DepositEthToParameters) =>
      depositEthTo(parentClient, childClient, walletClient, params),
    depositErc20: (params: DepositErc20Parameters) =>
      depositErc20(parentClient, childClient, walletClient, params),
    approveErc20: (params: ApproveErc20Parameters) =>
      approveErc20(parentClient, childClient, walletClient, params),
    approveGasToken: (params: ApproveGasTokenParameters) =>
      approveGasToken(parentClient, childClient, walletClient, params),
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
    prepareWithdrawErc20Transaction: (params: PrepareWithdrawErc20Parameters) =>
      prepareWithdrawErc20Transaction(childClient, params),
    withdrawErc20: (params: WithdrawErc20Parameters) =>
      withdrawErc20(parentClient, childClient, walletClient, params),
  })
}
