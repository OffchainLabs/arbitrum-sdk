import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import { BigNumber, ContractTransaction, ethers, Overrides } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import {
  ARB_SYS_ADDRESS,
  SEVEN_DAYS_IN_SECONDS,
} from '../dataEntities/constants'
import { GasOverrides as ClassicGasOverrides } from '@arbitrum/sdk-classic/dist/lib/message/L1ToL2MessageGasEstimator'
import { GasOverrides as NitroGasOverrides } from '@arbitrum/sdk-nitro/dist/lib/message/L1ToL2MessageGasEstimator'
import { Provider } from '@ethersproject/abstract-provider'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { Bridge__factory } from '../abi/factories/Bridge__factory'
import {
  SignerOrProvider,
  SignerProviderUtils,
} from '../dataEntities/signerOrProvider'
import {
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from '../message/L1ToL2Message'
import { L2ToL1MessageStatus } from '../message/L2ToL1Message'
import { MessageDeliveredEvent as ClassicMessageDeliveredEvent } from '@arbitrum/sdk-classic/dist/lib/abi/Bridge'
import { FetchedEvent } from './eventFetcher'
import { L2Network as NitroL2Network } from '@arbitrum/sdk-nitro'
import { Inbox__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/Inbox__factory'
import { Bridge__factory as NitroBridgeFactory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/Bridge__factory'
import { RollupUserLogic__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/RollupUserLogic__factory'
import { L1ToL2MessageReader as ClassicL1ToL2MessageReader } from '@arbitrum/sdk-classic/dist/index'

import { l2Networks as classicL2Networks } from '@arbitrum/sdk-classic/dist/lib/dataEntities/networks'
import { l2Networks as nitroL2Networks } from '@arbitrum/sdk-nitro/dist/lib/dataEntities/networks'
import { ArbSdkError } from '../dataEntities/errors'

let isNitro = false

export const generateL2NitroNetwork = async (
  existingNitroL2Network: nitro.L2Network,
  l1Provider: Provider
): Promise<NitroL2Network> => {
  // we know the inbox hasnt changed
  const inboxAddr = existingNitroL2Network.ethBridge.inbox

  const inbox = Inbox__factory.connect(inboxAddr, l1Provider)
  const bridgeAddr = await inbox.bridge()

  // the rollup is the bridge owner
  const bridge = NitroBridgeFactory.connect(bridgeAddr, l1Provider)
  const rollupAddr = await bridge.owner()

  const rollup = RollupUserLogic__factory.connect(rollupAddr, l1Provider)
  const sequencerInboxAddr = await rollup.sequencerBridge()
  const outboxAddr = await rollup.outbox()

  return {
    chainID: existingNitroL2Network.chainID,
    confirmPeriodBlocks: existingNitroL2Network.confirmPeriodBlocks,
    ethBridge: {
      inbox: inboxAddr,
      bridge: bridgeAddr,
      outbox: outboxAddr,
      rollup: rollupAddr,
      sequencerInbox: sequencerInboxAddr,
    },
    explorerUrl: existingNitroL2Network.explorerUrl,
    isArbitrum: existingNitroL2Network.isArbitrum,
    isCustom: existingNitroL2Network.isCustom,
    name: existingNitroL2Network.name,
    partnerChainID: existingNitroL2Network.partnerChainID,
    retryableLifetimeSeconds: existingNitroL2Network.retryableLifetimeSeconds,
    rpcURL: existingNitroL2Network.rpcURL,
    tokenBridge: existingNitroL2Network.tokenBridge,
    gif: existingNitroL2Network.gif,
  }
}

/**
 * New outboxes can be added to the bridge, and withdrawals always use the latest outbox.
 * This function finds the outbox address for a supplied batch number
 * @param network
 * @param batchNumber
 * @returns
 */
export const getOutboxAddr = (
  network: classic.L2Network,
  batchNumber: number
) => {
  // find the outbox where the activation batch number of the next outbox
  // is greater than the supplied batch
  const res = Object.entries(network.ethBridge.outboxes)
    .sort((a, b) => {
      if (a[1] < b[1]) return -1
      else if (a[1] === b[1]) return 0
      else return 1
    })
    .find(
      (_, index, array) =>
        array[index + 1] === undefined || array[index + 1][1].gt(batchNumber)
    )

  if (!res) {
    throw new ArbSdkError(
      `No outbox found for batch number: ${batchNumber} on network: ${network.chainID}.`
    )
  }

  return res[0]
}

type LastUpdated = { timestamp: number; value: boolean }
const fifthteenMinutesMs = 15 * 60 * 1000

const lastUpdatedL1: LastUpdated = {
  timestamp: 0,
  value: false,
}

const lastUpdatedL2: LastUpdated = {
  timestamp: 0,
  value: false,
}

export const isNitroL1 = async (l1Provider: SignerOrProvider) => {
  if (isNitro) return true
  if (Date.now() - lastUpdatedL1.timestamp > fifthteenMinutesMs) {
    const l1Network = await nitro.getL1Network(l1Provider)
    const partner = l1Network.partnerChainIDs[0]
    const l2Network = await nitro.getL2Network(partner)
    if (!l2Network)
      throw new ArbSdkError(`No l2 network found with chain id ${partner}`)
    try {
      const inboxAddr = l2Network.ethBridge.inbox
      const inbox = Inbox__factory.connect(inboxAddr, l1Provider)
      const bridgeAddr = await inbox.bridge()
      const bridge = Bridge__factory.connect(bridgeAddr, l1Provider)
      const rollupAdd = await bridge.owner()
      const rollup = RollupUserLogic__factory.connect(rollupAdd, l1Provider)
      // this will error if we're not nitro
      await rollup.wasmModuleRoot()

      // when we've switched to nitro we need to regenerate the nitro
      // network config and set it
      const nitroL2Network = await generateL2NitroNetwork(
        l2Network,
        SignerProviderUtils.getProviderOrThrow(l1Provider)
      )

      nitroL2Networks[nitroL2Network.chainID] = nitroL2Network
      isNitro = true
      lastUpdatedL1.timestamp = Date.now()
      lastUpdatedL1.value = true
    } catch (err) {
      lastUpdatedL1.timestamp = Date.now()
      lastUpdatedL1.value = false
    }
  }
  return lastUpdatedL1.value
}

export const isNitroL2 = async (
  l2SignerOrProvider: SignerOrProvider
): Promise<boolean> => {
  if (isNitro) return true
  if (Date.now() - lastUpdatedL2.timestamp > fifthteenMinutesMs) {
    const arbSys = ArbSys__factory.connect(ARB_SYS_ADDRESS, l2SignerOrProvider)
    const l2Network = await nitro.getL2Network(l2SignerOrProvider)
    const blockNumber = await arbSys.arbBlockNumber()
    try {
      // will throw an error if pre nitro
      await arbSys.arbBlockHash(blockNumber.sub(1))

      const l1Network = await nitro.getL1Network(l2Network.partnerChainID)
      const l1Provider = new JsonRpcProvider(l1Network.rpcURL)
      // when we've switched to nitro we need to regenerate the nitro
      // network config and set it
      const nitroL2Network = await generateL2NitroNetwork(
        l2Network,
        SignerProviderUtils.getProviderOrThrow(l1Provider)
      )
      nitroL2Networks[nitroL2Network.chainID] = nitroL2Network
      isNitro = true
      lastUpdatedL2.timestamp = Date.now()
      lastUpdatedL2.value = true
    } catch {
      lastUpdatedL2.timestamp = Date.now()
      lastUpdatedL2.value = false
    }
  }
  return lastUpdatedL2.value
}

export const lookupExistingNetwork = (
  l2Network: nitro.L2Network
): classic.L2Network => {
  const classicNetwork = classicL2Networks[l2Network.chainID]
  if (!classicNetwork) {
    throw new ArbSdkError(
      `Unexpected missing classic network for chain ${l2Network.chainID}`
    )
  }
  return classicNetwork
}

export const convertNetworkNitroToClassic = (
  l2Network: nitro.L2Network
): classic.L2Network => {
  return {
    ...l2Network,
    ethBridge: {
      ...l2Network.ethBridge,
      outboxes: {
        [l2Network.ethBridge.outbox]: BigNumber.from(0),
      },
    },
  }
}

export const convertNetworkClassicToNitro = (
  l2Network: classic.L2Network
): nitro.L2Network => {
  const outboxes = Object.keys(l2Network.ethBridge.outboxes)

  return {
    ...l2Network,
    ethBridge: {
      ...l2Network.ethBridge,
      outbox: outboxes[outboxes.length - 1],
    },
    retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
  }
}

export const convertGasOverrides = (
  gasOverrides?: NitroGasOverrides
): Omit<ClassicGasOverrides, 'sendL2CallValueFromL1'> => {
  return {
    maxGas: gasOverrides?.gasLimit,
    maxSubmissionPrice: gasOverrides?.maxSubmissionFee,
    maxGasPrice: gasOverrides?.maxFeePerGas,
  }
}

export const convertEstimates = (estimates: {
  maxGasBid: BigNumber
  maxSubmissionPriceBid: BigNumber
  maxGasPriceBid: BigNumber
  totalDepositValue: BigNumber
}): {
  gasLimit: BigNumber
  maxSubmissionFee: BigNumber
  maxFeePerGas: BigNumber
  totalL2GasCosts: BigNumber
} => {
  return {
    gasLimit: estimates.maxGasBid,
    maxSubmissionFee: estimates.maxSubmissionPriceBid,
    maxFeePerGas: estimates.maxGasPriceBid,
    totalL2GasCosts: estimates.maxGasPriceBid
      .mul(estimates.maxGasBid)
      .add(estimates.maxSubmissionPriceBid),
  }
}

export const convertL2ToL1Status = (
  status: classic.L2ToL1MessageStatus
): nitro.L2ToL1MessageStatus => {
  switch (status) {
    case classic.L2ToL1MessageStatus.CONFIRMED:
      return nitro.L2ToL1MessageStatus.CONFIRMED
    case classic.L2ToL1MessageStatus.EXECUTED:
      return nitro.L2ToL1MessageStatus.EXECUTED
    case classic.L2ToL1MessageStatus.NOT_FOUND:
      return nitro.L2ToL1MessageStatus.UNCONFIRMED
    case classic.L2ToL1MessageStatus.UNCONFIRMED:
      return nitro.L2ToL1MessageStatus.UNCONFIRMED
  }
}

export interface IL1ToL2MessageReader {
  readonly retryableCreationId: string
  isExpired(): Promise<boolean>
  status(): Promise<L1ToL2MessageStatus>
  waitForStatus(
    confirmations?: number,
    timeout?: number
  ): Promise<L1ToL2MessageWaitResult>
  getTimeout(): Promise<BigNumber>
  getBeneficiary(): Promise<string>
}

export interface IL1ToL2MessageWriter extends IL1ToL2MessageReader {
  redeem(overrides?: Overrides): Promise<ContractTransaction>
  cancel(overrides?: Overrides): Promise<ContractTransaction>
}
export type IL1ToL2MessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? IL1ToL2MessageReader : IL1ToL2MessageWriter

export type IL2ToL1MessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? IL2ToL1MessageReader : IL2ToL1MessageWriter

export interface IL2ToL1MessageReader {
  getOutboxProof(
    l2Provider: Provider
  ): Promise<MessageBatchProofInfo | null | string[]>
  status(l2Provider: Provider): Promise<L2ToL1MessageStatus>
  waitUntilReadyToExecute(
    l2Provider: Provider,
    retryDelay?: number
  ): Promise<void>

  getFirstExecutableBlock(l2Provider: Provider): Promise<BigNumber | null>
}
export interface IL2ToL1MessageWriter extends IL2ToL1MessageReader {
  execute(
    l2Provider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction>
}

export interface MessageBatchProofInfo {
  /**
   * Merkle proof of message inclusion in outbox entry
   */
  proof: string[]

  /**
   * Merkle path to message
   */
  path: BigNumber

  /**
   * Sender of original message (i.e., caller of ArbSys.sendTxToL1)
   */
  l2Sender: string

  /**
   * Destination address for L1 contract call
   */
  l1Dest: string

  /**
   * L2 block number at which sendTxToL1 call was made
   */
  l2Block: BigNumber

  /**
   * L1 block number at which sendTxToL1 call was made
   */
  l1Block: BigNumber

  /**
   * L2 Timestamp at which sendTxToL1 call was made
   */
  timestamp: BigNumber

  /**
   * Value in L1 message in wei
   */
  amount: BigNumber

  /**
   * ABI-encoded L1 message data
   */
  calldataForL1: string
}
export { ClassicMessageDeliveredEvent }

export type ClassicForceInclusionParams =
  FetchedEvent<ClassicMessageDeliveredEvent> & {
    delayedAcc: string
  }

/**
 * Nitro compatible EthDepositMessage
 */
export interface EthDepositMessage {
  readonly l2ChainId: number
  readonly messageNumber: BigNumber
  readonly to: string
  readonly value: BigNumber
  readonly l2DepositTxHash: string
  wait(
    confirmations?: number,
    timeout?: number
  ): Promise<ethers.providers.TransactionReceipt | null>
}

export const toNitroEthDepositMessage = async (
  message: ClassicL1ToL2MessageReader,
  l2ChainId: number
): Promise<EthDepositMessage> => {
  const inputs = await message.getInputs()
  return {
    l2ChainId: l2ChainId,
    l2DepositTxHash: message.l2TxHash,
    messageNumber: message.messageNumber,
    to: inputs.destinationAddress,
    value: inputs.l2CallValue,

    wait: async (confirmations?: number, timeout?: number) => {
      const statusRes = await message.waitForStatus(confirmations, timeout)

      if (statusRes.status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
        return await message.getRetryableCreationReceipt()
      } else return null
    },
  }
}
