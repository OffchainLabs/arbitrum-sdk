import type { Address, Hash, Transport } from 'viem'
import type { 
  PublicClient, 
  WalletClient, 
  Account,
  Chain
} from 'viem'

export type ArbitrumDepositConfig = {
  inboxAddress: Address
}

export type GasOverrides = {
  gasLimit?: {
    min?: bigint
    max?: bigint
  }
  maxFeePerGas?: {
    min?: bigint
    max?: bigint
  }
  maxSubmissionCost?: {
    min?: bigint
    max?: bigint
  }
}

export type RetryableGasParams = {
  gasLimit: bigint
  maxFeePerGas: bigint
  maxSubmissionCost: bigint
}

export type EthDepositParameters = {
  amount: bigint
  account: Account | Address
  to?: Address // Optional destination address
  retryableGasOverrides?: GasOverrides
}

export type Erc20DepositParameters = {
  token: Address
  amount: bigint
  account: Account | Address
  to?: Address // Optional destination address, defaults to sender
}

export type ApproveErc20Parameters = {
  token: Address 
  amount: bigint
  account: Account | Address
}

export type ArbitrumDepositActions = {
  depositEth: (args: EthDepositParameters) => Promise<Hash>
} 