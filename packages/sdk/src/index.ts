/*
 * Copyright 2019-2021, Offchain Labs, Inc.
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

export {
  EthL1L3Bridger,
  EthL1L3DepositStatus,
  EthL1L3DepositRequestParams,
  Erc20L1L3Bridger,
  Erc20L1L3DepositStatus,
  Erc20L1L3DepositRequestParams,
  Erc20L1L3DepositRequestRetryableOverrides,
  GetL1L3DepositStatusParams,
} from './lib/assetBridger/l1l3Bridger'
export { EthBridger } from './lib/assetBridger/ethBridger'
export {
  Erc20Bridger,
  AdminErc20Bridger,
} from './lib/assetBridger/erc20Bridger'
export {
  ChildTransactionReceipt,
  ChildContractTransaction,
} from './lib/message/ChildTransaction'
export {
  ChildToParentMessage,
  ChildToParentMessageWriter,
  ChildToParentMessageReader,
  ChildToParentMessageReaderOrWriter,
  ChildToParentTransactionEvent,
} from './lib/message/ChildToParentMessage'
export {
  ParentEthDepositTransaction,
  ParentEthDepositTransactionReceipt,
  ParentContractCallTransaction,
  ParentContractCallTransactionReceipt,
  ParentContractTransaction,
  ParentTransactionReceipt,
} from './lib/message/ParentTransaction'
export {
  EthDepositMessage,
  EthDepositMessageStatus,
  EthDepositMessageWaitForStatusResult,
  ParentToChildMessage,
  ParentToChildMessageReader,
  ParentToChildMessageReaderClassic,
  ParentToChildMessageWriter,
  ParentToChildMessageStatus,
  ParentToChildMessageWaitForStatusResult,
} from './lib/message/ParentToChildMessage'
export { ParentToChildMessageGasEstimator } from './lib/message/ParentToChildMessageGasEstimator'
export { argSerializerConstructor } from './lib/utils/byte_serialize_params'
export { CallInput, MultiCaller } from './lib/utils/multicall'
export {
  ArbitrumNetwork,
  getArbitrumNetwork,
  getArbitrumNetworks,
  ArbitrumNetworkInformationFromRollup,
  getArbitrumNetworkInformationFromRollup,
  getChildrenForNetwork,
  registerCustomArbitrumNetwork,
  // deprecated, but here for backwards compatibility
  L2Network,
  L2NetworkTokenBridge,
  mapL2NetworkToArbitrumNetwork,
  mapL2NetworkTokenBridgeToTokenBridge,
} from './lib/dataEntities/networks'
export { InboxTools } from './lib/inbox/inbox'
export { EventFetcher } from './lib/utils/eventFetcher'
export { ArbitrumProvider } from './lib/utils/arbProvider'
export * as constants from './lib/dataEntities/constants'
export {
  ChildToParentMessageStatus,
  RetryableMessageParams,
} from './lib/dataEntities/message'
export {
  RetryableData,
  RetryableDataTools,
} from './lib/dataEntities/retryableData'
export { EventArgs } from './lib/dataEntities/event'
export { Address } from './lib/dataEntities/address'
export {
  ParentToChildTransactionRequest,
  isParentToChildTransactionRequest,
  ChildToParentTransactionRequest,
  isChildToParentTransactionRequest,
} from './lib/dataEntities/transactionRequest'
export {
  scaleFrom18DecimalsToNativeTokenDecimals,
  scaleFromNativeTokenDecimalsTo18Decimals,
} from './lib/utils/lib'
