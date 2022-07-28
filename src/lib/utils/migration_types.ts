import * as classic from '@arbitrum/sdk-classic'
import * as nitro from '@arbitrum/sdk-nitro'
import { BigNumber, ContractTransaction, ethers, Overrides } from 'ethers'
import { JsonRpcProvider, TransactionReceipt } from '@ethersproject/providers'
import { Zero } from '@ethersproject/constants'
import { ErrorCode, Logger } from '@ethersproject/logger'
import {
  ARB_SYS_ADDRESS,
  SEVEN_DAYS_IN_SECONDS,
} from '../dataEntities/constants'
import { GasOverrides as ClassicGasOverrides } from '@arbitrum/sdk-classic/dist/lib/message/L1ToL2MessageGasEstimator'
import { GasOverrides as NitroGasOverrides } from '@arbitrum/sdk-nitro/dist/lib/message/L1ToL2MessageGasEstimator'
import { Provider } from '@ethersproject/abstract-provider'
import { ArbSys__factory } from '../abi/factories/ArbSys__factory'
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
import { L1ERC20Gateway__factory as ClassicL1ERC20Gateway__factory } from '@arbitrum/sdk-classic/dist/lib/abi/factories/L1ERC20Gateway__factory'
import { L1WethGateway__factory as ClassicL1WethGateway__factory } from '@arbitrum/sdk-classic/dist/lib/abi/factories/L1WethGateway__factory'
import { L1ERC20Gateway__factory as NitroL1ERC20Gateway__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/L1ERC20Gateway__factory'
import { L1WethGateway__factory as NitroL1WethGateway__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/L1WethGateway__factory'
import { FetchedEvent } from './eventFetcher'
import { L2Network as NitroL2Network } from '@arbitrum/sdk-nitro'
import { Inbox__factory as NitroInbox__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/Inbox__factory'
import { Inbox__factory as ClassicInbox__factory } from '@arbitrum/sdk-classic/dist/lib/abi/factories/Inbox__factory'
import { InboxMessageDeliveredEvent as ClassicInboxMessageDeliveredEvent } from '@arbitrum/sdk-classic/dist/lib/abi/Inbox'
import { Bridge__factory as NitroBridgeFactory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/Bridge__factory'
import { RollupUserLogic__factory as NitroRollupUserLogic__factory } from '@arbitrum/sdk-nitro/dist/lib/abi/factories/RollupUserLogic__factory'
import { L1ToL2MessageReader as ClassicL1ToL2MessageReader } from '@arbitrum/sdk-classic/dist/index'

import { l1Networks as classicL1Networks } from '@arbitrum/sdk-classic/dist/lib/dataEntities/networks'
import { l1Networks as nitroL1Networks } from '@arbitrum/sdk-nitro/dist/lib/dataEntities/networks'

import { l2Networks as classicL2Networks } from '@arbitrum/sdk-classic/dist/lib/dataEntities/networks'
import { l2Networks as nitroL2Networks } from '@arbitrum/sdk-nitro/dist/lib/dataEntities/networks'
import { ArbSdkError, MissingProviderArbTsError } from '../dataEntities/errors'
import {
  EthBridger,
  EthDepositParams,
  EthWithdrawParams,
} from '../assetBridger/ethBridger'
import { L2Network } from '../dataEntities/networks'
import {
  Erc20Bridger,
  TokenDepositParams,
  TokenWithdrawParams,
} from '../assetBridger/erc20Bridger'
import { GasOverrides } from '../message/L1ToL2MessageGasEstimator'

let isNitro = false

export const generateL2NitroNetwork = async (
  existingNitroL2Network: nitro.L2Network,
  l1Provider: Provider
): Promise<NitroL2Network> => {
  // we know the inbox hasnt changed
  const inboxAddr = existingNitroL2Network.ethBridge.inbox

  const inbox = NitroInbox__factory.connect(inboxAddr, l1Provider)
  const bridgeAddr = await inbox.bridge()

  // the rollup is the bridge owner
  const bridge = NitroBridgeFactory.connect(bridgeAddr, l1Provider)
  const rollupAddr = await bridge.rollup()

  const rollup = NitroRollupUserLogic__factory.connect(rollupAddr, l1Provider)
  const sequencerInboxAddr = await rollup.sequencerInbox()
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
      if (a[1].lt(b[1])) return -1
      else if (a[1].eq(b[1])) return 0
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

export const isNitroL1 = async (
  l1Provider: SignerOrProvider,
  /**
   * Wait at least this amount of time before rechecking if isNitro
   */
  timeSinceCheckMs: number = fifthteenMinutesMs
) => {
  if (isNitro) return true
  if (Date.now() - lastUpdatedL1.timestamp > timeSinceCheckMs) {
    const l1Network = await nitro.getL1Network(l1Provider)
    const partner = l1Network.partnerChainIDs[0]
    const l2Network = await nitro.getL2Network(partner)
    if (!l2Network)
      throw new ArbSdkError(`No l2 network found with chain id ${partner}`)
    try {
      const inboxAddr = l2Network.ethBridge.inbox
      const inbox = NitroInbox__factory.connect(inboxAddr, l1Provider)
      const bridgeAddr = await inbox.bridge()
      const bridge = NitroBridgeFactory.connect(bridgeAddr, l1Provider)
      if (!(await bridge.allowedDelayedInboxes(inboxAddr))) {
        // In the middle of the migration the bridge is switched over,
        // but the inbox isn't enabled yet.
        // This error will be caught below and return false.
        throw new ArbSdkError(`inbox isn't authorized by bridge`)
      }
      const rollupAdd = await bridge.rollup()
      const rollup = NitroRollupUserLogic__factory.connect(
        rollupAdd,
        l1Provider
      )
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
  l2SignerOrProvider: SignerOrProvider,
  /**
   * Wait at least this amount of time before rechecking if isNitro
   */
  timeSinceCheckMs: number = fifthteenMinutesMs
): Promise<boolean> => {
  if (isNitro) return true
  if (Date.now() - lastUpdatedL2.timestamp > timeSinceCheckMs) {
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
  getInputs(): ReturnType<classic.L1ToL2MessageReader['getInputs']>
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

import { getTransactionReceipt } from '@arbitrum/sdk-nitro/dist/lib/utils/lib'

export const toNitroEthDepositMessage = async (
  message: ClassicL1ToL2MessageReader,
  l2ChainId: number,
  destinationAddress: string,
  l2CallValue: BigNumber
): Promise<EthDepositMessage> => {
  return {
    l2ChainId: l2ChainId,
    l2DepositTxHash: message.retryableCreationId,
    messageNumber: message.messageNumber,
    to: destinationAddress,
    value: l2CallValue,

    wait: async (confirmations?: number, timeout?: number) => {
      return (
        (await getTransactionReceipt(
          message.l2Provider,
          message.retryableCreationId,
          confirmations,
          timeout
        )) || null
      )
    },
  }
}

export const toClassicRetryableParams = async (
  params: nitro.L1ToL2MessageReader['messageData']
): ReturnType<classic.L1ToL2MessageReader['getInputs']> => {
  if (params.data.length < 2 || params.data.length % 2 !== 0) {
    throw new ArbSdkError(`Unxpected params data: ${params.data}.`)
  }
  return {
    callDataLength: BigNumber.from(
      (params.data.startsWith('0x')
        ? params.data.length - 2
        : params.data.length) / 2
    ),
    callValueRefundAddress: params.callValueRefundAddress,
    destinationAddress: params.destAddress,
    excessFeeRefundAddress: params.excessFeeRefundAddress,
    gasPriceBid: params.maxFeePerGas,
    l2CallValue: params.l2CallValue,
    maxGas: params.gasLimit,
    maxSubmissionCost: params.maxSubmissionFee,
  }
}

/**
 * Temporary class for helping with x-chain message gas cost estimation.
 * Will be removed in nitro as this functionality will be available on the bridgers
 */
export class DepositWithdrawEstimator {
  public constructor(public readonly l2Network: L2Network) {}

  public async ethDepositL1Gas(params: EthDepositParams) {
    const ethBridger = new EthBridger(this.l2Network)

    return await ethBridger.depositEstimateGas(params)
  }

  public async ethDepositL2Gas(l2Provider: Provider) {
    if (await isNitroL2(l2Provider)) {
      return {
        maxGas: BigNumber.from(0),
        maxSubmissionCost: BigNumber.from(0),
        maxGasPrice: BigNumber.from(0),
      }
    } else {
      const estimator = new classic.L1ToL2MessageGasEstimator(l2Provider)
      return {
        maxGas: BigNumber.from(0),
        maxSubmissionCost: (await estimator.estimateSubmissionPrice(0))
          .submissionPrice,
        maxGasPrice: BigNumber.from(0),
      }
    }
  }

  public async erc20Deposit20L1Gas(params: TokenDepositParams) {
    const erc20Bridger = new Erc20Bridger(this.l2Network)

    return await erc20Bridger.depositEstimateGas(params)
  }

  /**
   * Does the provided address look like a weth gateway
   * @param potentialWethGatewayAddress
   * @param l1Provider
   * @returns
   */
  private async classiclooksLikeWethGateway(
    potentialWethGatewayAddress: string,
    l1Provider: Provider
  ) {
    try {
      const potentialWethGateway = ClassicL1WethGateway__factory.connect(
        potentialWethGatewayAddress,
        l1Provider
      )
      await potentialWethGateway.callStatic.l1Weth()
      return true
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as { code: ErrorCode }).code ===
          Logger.errors.CALL_EXCEPTION
      ) {
        return false
      } else {
        throw err
      }
    }
  }

  /**
   * Is this a known or unknown WETH gateway
   * @param gatewayAddress
   * @param l1Provider
   * @returns
   */
  private async classicIsWethGateway(
    gatewayAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    const wethAddress = this.l2Network.tokenBridge.l1WethGateway
    if (this.l2Network.isCustom) {
      // For custom network, we do an ad-hoc check to see if it's a WETH gateway
      if (await this.classiclooksLikeWethGateway(gatewayAddress, l1Provider)) {
        return true
      }
      // ...otherwise we directly check it against the config file
    } else if (wethAddress === gatewayAddress) {
      return true
    }
    return false
  }

  /**
   * Does the provided address look like a weth gateway
   * @param potentialWethGatewayAddress
   * @param l1Provider
   * @returns
   */
  private async nitroLooksLikeWethGateway(
    potentialWethGatewayAddress: string,
    l1Provider: Provider
  ) {
    try {
      const potentialWethGateway = NitroL1WethGateway__factory.connect(
        potentialWethGatewayAddress,
        l1Provider
      )
      await potentialWethGateway.callStatic.l1Weth()
      return true
    } catch (err) {
      if (
        err instanceof Error &&
        (err as unknown as { code: ErrorCode }).code ===
          Logger.errors.CALL_EXCEPTION
      ) {
        return false
      } else {
        throw err
      }
    }
  }

  /**
   * Is this a known or unknown WETH gateway
   * @param gatewayAddress
   * @param l1Provider
   * @returns
   */
  private async nitroIsWethGateway(
    gatewayAddress: string,
    l1Provider: Provider
  ): Promise<boolean> {
    const wethAddress = this.l2Network.tokenBridge.l1WethGateway
    if (this.l2Network.isCustom) {
      // For custom network, we do an ad-hoc check to see if it's a WETH gateway
      if (await this.nitroLooksLikeWethGateway(gatewayAddress, l1Provider)) {
        return true
      }
      // ...otherwise we directly check it against the config file
    } else if (wethAddress === gatewayAddress) {
      return true
    }
    return false
  }

  public async erc20DepositL2Gas(params: TokenDepositParams) {
    if (await isNitroL2(params.l2Provider)) {
      const {
        erc20L1Address,
        amount,
        l2Provider,
        l1Signer,
        destinationAddress,
      } = params
      const { retryableGasOverrides } = params
      const erc20Bridger = new Erc20Bridger(this.l2Network)

      if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
        throw new MissingProviderArbTsError('l1Signer')
      }

      // 1. get the params for a gas estimate
      const l1GatewayAddress = await erc20Bridger.getL1GatewayAddress(
        erc20L1Address,
        l1Signer.provider
      )
      const l1Gateway = NitroL1ERC20Gateway__factory.connect(
        l1GatewayAddress,
        l1Signer.provider
      )
      const sender = await l1Signer.getAddress()
      const to = destinationAddress ? destinationAddress : sender
      const depositCalldata = await l1Gateway.getOutboundCalldata(
        erc20L1Address,
        sender,
        to,
        amount,
        '0x'
      )

      // The WETH gateway is the only deposit that requires callvalue in the L2 user-tx (i.e., the recently un-wrapped ETH)
      // Here we check if this is a WETH deposit, and include the callvalue for the gas estimate query if so
      const isWeth = await this.nitroIsWethGateway(
        l1GatewayAddress,
        l1Signer.provider
      )
      const estimateGasCallValue = isWeth ? amount : Zero

      const l2Dest = await l1Gateway.counterpartGateway()
      const gasEstimator = new nitro.L1ToL2MessageGasEstimator(l2Provider)

      let tokenGasOverrides: GasOverrides | undefined = retryableGasOverrides

      // we also add a hardcoded minimum gas limit for custom gateway deposits
      if (l1GatewayAddress === this.l2Network.tokenBridge.l1CustomGateway) {
        if (!tokenGasOverrides) tokenGasOverrides = {}
        if (!tokenGasOverrides.gasLimit) tokenGasOverrides.gasLimit = {}
        if (!tokenGasOverrides.gasLimit.min) {
          tokenGasOverrides.gasLimit.min =
            Erc20Bridger.MIN_CUSTOM_DEPOSIT_GAS_LIMIT
        }
      }

      // 2. get the gas estimates
      const baseFee = (await l1Signer.provider.getBlock('latest')).baseFeePerGas
      if (!baseFee) {
        throw new ArbSdkError(
          'Latest block did not contain base fee, ensure provider is connected to a network that supports EIP 1559.'
        )
      }
      const excessFeeRefundAddress = sender
      const callValueRefundAddress = sender
      const estimates = await gasEstimator.estimateAll(
        l1GatewayAddress,
        l2Dest,
        depositCalldata,
        estimateGasCallValue,
        baseFee,
        excessFeeRefundAddress,
        callValueRefundAddress,
        l1Signer.provider,
        tokenGasOverrides
      )

      return {
        maxGas: estimates.gasLimit,
        maxSubmissionCost: estimates.maxSubmissionFee,
        maxGasPrice: estimates.maxFeePerGas,
      }
    } else {
      const {
        erc20L1Address,
        amount,
        l2Provider,
        l1Signer,
        destinationAddress,
      } = params
      const { retryableGasOverrides } = params
      const erc20Bridger = new Erc20Bridger(this.l2Network)

      if (!SignerProviderUtils.signerHasProvider(l1Signer)) {
        throw new MissingProviderArbTsError('l1Signer')
      }

      // 1. get the params for a gas estimate
      const l1GatewayAddress = await erc20Bridger.getL1GatewayAddress(
        erc20L1Address,
        l1Signer.provider
      )
      const l1Gateway = ClassicL1ERC20Gateway__factory.connect(
        l1GatewayAddress,
        l1Signer.provider
      )
      const sender = await l1Signer.getAddress()
      const to = destinationAddress ? destinationAddress : sender
      const depositCalldata = await l1Gateway.getOutboundCalldata(
        erc20L1Address,
        sender,
        to,
        amount,
        '0x'
      )
      // The WETH gateway is the only deposit that requires callvalue in the L2 user-tx (i.e., the recently un-wrapped ETH)
      // Here we check if this is a WETH deposit, and include the callvalue for the gas estimate query if so
      const estimateGasCallValue = (await this.classicIsWethGateway(
        l1GatewayAddress,
        l1Signer.provider
      ))
        ? amount
        : Zero

      const l2Dest = await l1Gateway.counterpartGateway()
      const gasEstimator = new classic.L1ToL2MessageGasEstimator(l2Provider)

      let tokenGasOverrides: ClassicGasOverrides | undefined =
        convertGasOverrides(retryableGasOverrides)
      if (!tokenGasOverrides) tokenGasOverrides = {}
      // we never send l2 call value from l1 for tokens
      // since we check in the router that the value is submission cost
      // + gas price * gas
      tokenGasOverrides.sendL2CallValueFromL1 = false

      // we also add a hardcoded minimum maxgas for custom gateway deposits
      if (l1GatewayAddress === this.l2Network.tokenBridge.l1CustomGateway) {
        if (!tokenGasOverrides.maxGas) tokenGasOverrides.maxGas = {}
        tokenGasOverrides.maxGas.min =
          classic.Erc20Bridger.MIN_CUSTOM_DEPOSIT_MAXGAS
      }

      // 2. get the gas estimates
      const estimates = await gasEstimator.estimateMessage(
        l1GatewayAddress,
        l2Dest,
        depositCalldata,
        estimateGasCallValue,
        tokenGasOverrides
      )

      return {
        maxGas: estimates.maxGasBid,
        maxSubmissionCost: estimates.maxSubmissionPriceBid,
        maxGasPrice: estimates.maxGasPriceBid,
      }
    }
  }

  public async ethWithdrawalL1Gas(l2Provider: Provider) {
    if (await isNitroL2(l2Provider)) {
      //  measured 126998 - add some padding
      return BigNumber.from(130000)
    } else {
      // measured 161743 - add some padding
      return BigNumber.from(165000)
    }
  }

  public async ethWithdrawalL2Gas(params: EthWithdrawParams) {
    const ethBridger = new EthBridger(this.l2Network)

    return await ethBridger.withdrawEstimateGas(params)
  }

  public async erc20WithdrawalL1Gas(l2Provider: Provider) {
    if (await isNitroL2(l2Provider)) {
      // measured 157421 - add some padding
      return BigNumber.from(160000)
    } else {
      // measured 218196 - added some padding
      return BigNumber.from(225000)
    }
  }

  public async erc20WithdrawalL2Gas(params: TokenWithdrawParams) {
    const ethBridger = new Erc20Bridger(this.l2Network)

    return await ethBridger.withdrawEstimateGas(params)
  }
}

/**
 * Get any InboxMessageDelivered events that were emitted during this transaction
 * @returns
 */
export const classicGetInboxMessageDeliveredEvents = (
  receipt: TransactionReceipt
): ClassicInboxMessageDeliveredEvent['args'][] => {
  const iFace = ClassicInbox__factory.createInterface()
  const inboxMessageDeliveredTopic = iFace.getEventTopic(
    iFace.events['InboxMessageDelivered(uint256,bytes)']
  )
  return receipt.logs
    .filter(log => log.topics[0] === inboxMessageDeliveredTopic)
    .map(
      l => iFace.parseLog(l).args as ClassicInboxMessageDeliveredEvent['args']
    )
}

// patch networks to be consistent
nitroL1Networks[1].partnerChainIDs.push(42170)
classicL1Networks[1].partnerChainIDs.push(42170)
classicL1Networks[5] = nitroL1Networks[5]
classicL2Networks[421613] = convertNetworkNitroToClassic(
  nitroL2Networks[421613]
)
classicL2Networks[42170] = convertNetworkNitroToClassic(nitroL2Networks[42170])
