import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import { BigNumber, ContractTransaction, Overrides } from 'ethers'
import { ARB_SYS_ADDRESS } from '../dataEntities/constants'
import { GasOverrides as ClassicGasOverrides } from '@arbitrum/sdk-classic/dist/lib/message/L1ToL2MessageGasEstimator'
import { GasOverrides as NitroGasOverrides } from '@arbitrum/sdk-nitro/dist/lib/message/L1ToL2MessageGasEstimator'
import { Provider } from '@ethersproject/abstract-provider'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
import { getL1Network, getL2Network } from '../dataEntities/networks'
import { Bridge__factory } from '../abi/factories/Bridge__factory'
import { SignerOrProvider } from '../dataEntities/signerOrProvider'
import {
  L1ToL2MessageStatus,
  L1ToL2MessageWaitResult,
} from '../message/L1ToL2Message'
import { L2ToL1MessageStatus } from '../message/L2ToL1Message'
import { MessageDeliveredEvent as ClassicMessageDeliveredEvent } from '@arbitrum/sdk-classic/dist/lib/abi/Bridge'
import { FetchedEvent } from './eventFetcher'

// CHRIS: TODO: Issues
// 1. they need an outbox proof from the old node, but it wont be around any more
// 3. need to dynamically create the network object - since we wont be able to hardcode it before hand - in fact we'll have to do a lookup each time
// 4. check with the team how we want to detect the switch on either side - add something explicit, what we have atm is good though

let isNitro = false
export const isNitroL1 = async (
  l1Provider: SignerOrProvider
): Promise<boolean> => {
  if (isNitro) return true
  const l1Network = await getL1Network(l1Provider)
  const partner = l1Network.partnerChainIDs[0]
  const l2Network = await getL2Network(partner)
  const bridge = Bridge__factory.connect(l2Network.ethBridge.bridge, l1Provider)
  try {
    await bridge.allowedOutboxList(2)
    // new outbox exists, we're on nitro
    isNitro = true
    return true
  } catch {
    return false
  }
}

export const isNitroL2 = async (
  l2Provider: SignerOrProvider
): Promise<boolean> => {
  isNitro = true
  const arbSys = ArbSys__factory.connect(ARB_SYS_ADDRESS, l2Provider)
  const version = await arbSys.arbOSVersion()
  if (version.toNumber() > 56) {
    isNitro = true
    return true
  } else return false
}

export const convertNetwork = (
  l2Network: nitro.L2Network
): classic.L2Network => {
  const convertedOutboxes: {
    [address: string]: BigNumber
  } = {}
  for (const objKey of Object.keys(l2Network.ethBridge.outboxes)) {
    convertedOutboxes[objKey] = BigNumber.from(
      l2Network.ethBridge.outboxes[objKey]
    )
  }

  return {
    ...l2Network,
    ethBridge: {
      ...l2Network.ethBridge,
      outboxes: convertedOutboxes,
    },
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
  redeem(): Promise<ContractTransaction>
  cancel(): Promise<ContractTransaction>
}
export type IL1ToL2MessageReaderOrWriter<
  T extends SignerOrProvider
> = T extends Provider ? IL1ToL2MessageReader : IL1ToL2MessageWriter

export type IL2ToL1MessageReaderOrWriter<
  T extends SignerOrProvider
> = T extends Provider ? IL2ToL1MessageReader : IL2ToL1MessageWriter

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

export type ClassicForceInclusionParams = FetchedEvent<
  ClassicMessageDeliveredEvent
> & {
  delayedAcc: string
}
