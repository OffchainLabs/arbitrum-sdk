/**
 * Compat layer: L1-L3 bridger facades
 *
 * Re-exports the original L1L3 bridger classes from the lib since
 * they are complex and already class-based. The compat layer just
 * provides a clean export path.
 */
export {
  Erc20L1L3Bridger,
  EthL1L3Bridger,
} from '../lib/assetBridger/l1l3Bridger'

export type {
  Erc20L1L3DepositRequestParams,
  EthL1L3DepositRequestParams,
  Erc20L1L3DepositStatus,
  EthL1L3DepositStatus,
  TxRequestParams,
  DepositRequestResult,
  TeleporterRetryableGasOverride,
  TeleportationType,
  TokenApproveParams as L1L3TokenApproveParams,
  GetL1L3DepositStatusParams,
  TxReference,
} from '../lib/assetBridger/l1l3Bridger'
