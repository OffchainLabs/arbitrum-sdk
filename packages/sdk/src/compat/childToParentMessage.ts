/**
 * ChildToParentMessage compat layer.
 *
 * Provides the old SDK's ChildToParentMessage, ChildToParentMessageReader,
 * and ChildToParentMessageWriter classes with BigNumber fields.
 *
 * Internally delegates to @arbitrum/core ChildToParentMessageReader and
 * getExecuteRequest.
 */
import { BigNumber, Overrides } from 'ethers'
import type { Provider } from '@ethersproject/abstract-provider'
import type { Signer } from '@ethersproject/abstract-signer'
import type { ContractTransaction } from '@ethersproject/contracts'
import {
  ChildToParentMessageReader as CoreChildToParentMessageReader,
  getExecuteRequest,
  getArbitrumNetwork,
  ArbSdkError,
  ChildToParentMessageStatus,
} from '@arbitrum/core'
import type { ChildToParentEventData } from '@arbitrum/core'
import { wrapProvider } from '@arbitrum/ethers5'
import type { Ethers5Provider } from '@arbitrum/ethers5'
import { SignerProviderUtils } from './types'
import type { SignerOrProvider } from './types'

// ---------------------------------------------------------------------------
// Event type with BigNumber fields (matching old SDK)
// ---------------------------------------------------------------------------

export interface ChildToParentTransactionEvent {
  caller: string
  destination: string
  hash: BigNumber
  position: BigNumber
  arbBlockNum: BigNumber
  ethBlockNum: BigNumber
  timestamp: BigNumber
  callvalue: BigNumber
  data: string
}

// ---------------------------------------------------------------------------
// Conditional type for Reader/Writer
// ---------------------------------------------------------------------------

export type ChildToParentMessageReaderOrWriter<T extends SignerOrProvider> =
  T extends Provider ? ChildToParentMessageReader : ChildToParentMessageWriter

// ---------------------------------------------------------------------------
// Convert compat event -> core event
// ---------------------------------------------------------------------------

function toCorEventData(event: ChildToParentTransactionEvent): ChildToParentEventData {
  return {
    caller: event.caller,
    destination: event.destination,
    hash: event.hash.toBigInt(),
    position: event.position.toBigInt(),
    arbBlockNum: event.arbBlockNum.toBigInt(),
    ethBlockNum: event.ethBlockNum.toBigInt(),
    timestamp: event.timestamp.toBigInt(),
    callvalue: event.callvalue.toBigInt(),
    data: event.data,
  }
}

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class ChildToParentMessage {
  /**
   * Instantiates a new Reader or Writer based on the signerOrProvider type.
   */
  public static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ): ChildToParentMessageReaderOrWriter<T>
  static fromEvent<T extends SignerOrProvider>(
    parentSignerOrProvider: T,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ): ChildToParentMessageReader | ChildToParentMessageWriter {
    return SignerProviderUtils.isSigner(parentSignerOrProvider)
      ? new ChildToParentMessageWriter(
          parentSignerOrProvider,
          event,
          parentProvider
        )
      : new ChildToParentMessageReader(parentSignerOrProvider, event)
  }
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export class ChildToParentMessageReader extends ChildToParentMessage {
  private readonly coreReader: CoreChildToParentMessageReader
  public readonly event: ChildToParentTransactionEvent

  constructor(
    protected readonly parentProvider: Provider,
    event: ChildToParentTransactionEvent
  ) {
    super()
    this.event = event
    const wrappedProvider = wrapProvider(parentProvider as unknown as Ethers5Provider)
    this.coreReader = new CoreChildToParentMessageReader(
      wrappedProvider,
      toCorEventData(event)
    )
  }

  /**
   * Get the outbox proof for executing this message.
   */
  public async getOutboxProof(
    childProvider: Provider
  ): Promise<string[] | null> {
    const wrappedChild = wrapProvider(childProvider as unknown as Ethers5Provider)
    const childChainId = await wrappedChild.getChainId()
    const network = await getArbitrumNetwork(childChainId)

    // Get send props to find sendRootSize
    const { getSendProps } = await import('@arbitrum/core')
    const wrappedParent = wrapProvider(this.parentProvider as unknown as Ethers5Provider)
    const sendProps = await getSendProps(
      wrappedParent,
      wrappedChild,
      toCorEventData(this.event),
      network
    )

    if (!sendProps.sendRootSize) return null
    return this.coreReader.getOutboxProof(wrappedChild, sendProps.sendRootSize)
  }

  /**
   * Get the status of this message.
   */
  public async status(
    childProvider: Provider
  ): Promise<ChildToParentMessageStatus> {
    const wrappedChild = wrapProvider(childProvider as unknown as Ethers5Provider)
    const childChainId = await wrappedChild.getChainId()
    const network = await getArbitrumNetwork(childChainId)
    return this.coreReader.status(network, wrappedChild)
  }

  /**
   * Waits until the outbox entry has been created and will not return until it has been.
   */
  public async waitUntilReadyToExecute(
    childProvider: Provider,
    retryDelay = 500
  ): Promise<
    ChildToParentMessageStatus.EXECUTED | ChildToParentMessageStatus.CONFIRMED
  > {
    const wrappedChild = wrapProvider(childProvider as unknown as Ethers5Provider)
    const childChainId = await wrappedChild.getChainId()
    const network = await getArbitrumNetwork(childChainId)
    return this.coreReader.waitUntilReadyToExecute(
      network,
      wrappedChild,
      retryDelay
    )
  }

  /**
   * Estimates the parent chain block number where this message will be executable.
   */
  public async getFirstExecutableBlock(
    childProvider: Provider
  ): Promise<BigNumber | null> {
    const wrappedChild = wrapProvider(childProvider as unknown as Ethers5Provider)
    const childChainId = await wrappedChild.getChainId()
    const network = await getArbitrumNetwork(childChainId)
    const result = await this.coreReader.getFirstExecutableBlock(
      network,
      wrappedChild
    )
    if (result === null) return null
    return BigNumber.from(result)
  }
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export class ChildToParentMessageWriter extends ChildToParentMessageReader {
  /**
   * Instantiates a new ChildToParentMessageWriter.
   */
  constructor(
    private readonly parentSigner: Signer,
    event: ChildToParentTransactionEvent,
    parentProvider?: Provider
  ) {
    super(parentProvider ?? parentSigner.provider!, event)
  }

  /**
   * Executes the ChildToParentMessage on Parent Chain.
   * Will throw if the outbox entry has not been created.
   */
  public async execute(
    childProvider: Provider,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    const wrappedChild = wrapProvider(childProvider as unknown as Ethers5Provider)
    const childChainId = await wrappedChild.getChainId()
    const network = await getArbitrumNetwork(childChainId)

    const currentStatus = await this.status(childProvider)
    if (currentStatus !== ChildToParentMessageStatus.CONFIRMED) {
      throw new ArbSdkError(
        `Cannot execute message. Status is: ${currentStatus} but must be ${ChildToParentMessageStatus.CONFIRMED}.`
      )
    }

    const proof = await this.getOutboxProof(childProvider)
    if (!proof) {
      throw new ArbSdkError('Could not get outbox proof for execution.')
    }

    const txRequest = getExecuteRequest(
      toCorEventData(this.event),
      proof,
      network
    )

    return (await this.parentSigner.sendTransaction({
      to: txRequest.to,
      data: txRequest.data,
      value: txRequest.value,
      ...overrides,
    })) as ContractTransaction
  }
}
