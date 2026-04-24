/**
 * L1→L3 teleportation functions.
 *
 * ETH and ERC-20 bridging from L1 to L3 via L2.
 */
export {
  getEthL1L3DepositRequest,
} from './ethL1L3'
export type {
  GetEthL1L3DepositRequestParams,
} from './ethL1L3'

export {
  getErc20L1L3DepositRequest,
  getErc20L1L3ApproveTokenRequest,
  getErc20L1L3ApproveGasTokenRequest,
} from './erc20L1L3'
export type {
  GetErc20L1L3DepositRequestParams,
  Erc20L1L3DepositRequestResult,
  GetErc20L1L3ApproveTokenRequestParams,
  GetErc20L1L3ApproveGasTokenRequestParams,
  TeleporterRetryableGasParams,
} from './erc20L1L3'

export {
  predictL2ForwarderAddress,
} from './l1l3Utils'
export type {
  PredictL2ForwarderAddressParams,
  L1L3DepositStatus,
  Erc20L1L3DepositStatus,
} from './l1l3Utils'
