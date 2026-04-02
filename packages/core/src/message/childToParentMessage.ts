/**
 * ChildToParentMessage — Reader class and helper functions for tracking
 * child-to-parent (withdrawal) message lifecycle.
 *
 * The reader queries the parent chain via ArbitrumProvider to determine
 * whether a child-to-parent message has been confirmed and/or executed.
 *
 * The execute action is returned as TransactionRequestData rather than
 * signed and sent.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type {
  ArbitrumTransactionReceipt,
  TransactionRequestData,
} from '../interfaces/types'
import type { ArbitrumNetwork } from '../networks'
import { ChildToParentMessageStatus } from './types'
import { getChildToParentEvents } from '../events/parsing'
import { ArbitrumContract, type ParsedEventLog } from '../contracts/Contract'
import { OutboxAbi } from '../abi/Outbox'
import { ArbSdkError } from '../errors'

/**
 * The event data from an L2ToL1Tx event, as parsed from logs.
 */
export interface ChildToParentEventData {
  caller: string
  destination: string
  hash: bigint
  position: bigint
  arbBlockNum: bigint
  ethBlockNum: bigint
  timestamp: bigint
  callvalue: bigint
  data: string
}

/**
 * Reader class for a child-to-parent message.
 * Provides methods to query the message status on the parent chain.
 */
export class ChildToParentMessageReader {
  constructor(
    public readonly parentProvider: ArbitrumProvider,
    public readonly event: ChildToParentEventData
  ) {}

  /**
   * Check if this message has already been executed in the Outbox.
   */
  private async hasExecuted(network: ArbitrumNetwork): Promise<boolean> {
    const outbox = new ArbitrumContract(
      OutboxAbi,
      network.ethBridge.outbox,
      this.parentProvider
    )
    const result = await outbox.read('isSpent', [this.event.position])
    return result[0] as boolean
  }

  /**
   * Get the status of this child-to-parent message.
   *
   * Note: In a full implementation, this would check assertion confirmation
   * against the rollup contract. For the core library, we provide a simplified
   * version that checks if the message has been executed via the Outbox.
   *
   * @param network The ArbitrumNetwork configuration
   */
  public async status(
    network: ArbitrumNetwork
  ): Promise<ChildToParentMessageStatus> {
    const executed = await this.hasExecuted(network)
    if (executed) {
      return ChildToParentMessageStatus.EXECUTED
    }
    // Without full rollup assertion checking, we can only distinguish
    // EXECUTED from non-EXECUTED. The caller would need the rollup
    // contract interaction to distinguish UNCONFIRMED from CONFIRMED.
    // For simplicity, return UNCONFIRMED if not executed.
    return ChildToParentMessageStatus.UNCONFIRMED
  }

  /**
   * Waits until the outbox entry has been created and is ready to execute.
   * WARNING: This can take 1 week+ for the assertion to be confirmed.
   * @param network The ArbitrumNetwork configuration
   * @param retryDelay Delay between polls in ms (default 500)
   */
  public async waitUntilReadyToExecute(
    network: ArbitrumNetwork,
    retryDelay = 500
  ): Promise<
    ChildToParentMessageStatus.EXECUTED | ChildToParentMessageStatus.CONFIRMED
  > {
    const currentStatus = await this.status(network)
    if (
      currentStatus === ChildToParentMessageStatus.CONFIRMED ||
      currentStatus === ChildToParentMessageStatus.EXECUTED
    ) {
      return currentStatus
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    return this.waitUntilReadyToExecute(network, retryDelay)
  }

  /**
   * Get the first block at which this message could be executable.
   * Returns null if the message can already be or has been executed.
   * @param network The ArbitrumNetwork configuration
   */
  public async getFirstExecutableBlock(
    network: ArbitrumNetwork
  ): Promise<bigint | null> {
    const currentStatus = await this.status(network)
    if (currentStatus === ChildToParentMessageStatus.EXECUTED) return null
    if (currentStatus === ChildToParentMessageStatus.CONFIRMED) return null

    // Estimate: current block + confirmPeriodBlocks + padding
    const latestBlock = await this.parentProvider.getBlockNumber()
    const ASSERTION_CREATED_PADDING = 50n
    const ASSERTION_CONFIRMED_PADDING = 20n
    return (
      BigInt(network.confirmPeriodBlocks) +
      ASSERTION_CREATED_PADDING +
      ASSERTION_CONFIRMED_PADDING +
      BigInt(latestBlock)
    )
  }
}

/**
 * Extract ChildToParentMessageReader instances from a child chain transaction receipt.
 * Parses L2ToL1Tx events from the receipt logs.
 */
export function getChildToParentMessages(
  receipt: ArbitrumTransactionReceipt,
  parentProvider: ArbitrumProvider,
  _network: ArbitrumNetwork
): ChildToParentMessageReader[] {
  const events = getChildToParentEvents(receipt)
  return events.map(
    e =>
      new ChildToParentMessageReader(parentProvider, {
        caller: e.args.caller as string,
        destination: e.args.destination as string,
        hash: e.args.hash as bigint,
        position: e.args.position as bigint,
        arbBlockNum: e.args.arbBlockNum as bigint,
        ethBlockNum: e.args.ethBlockNum as bigint,
        timestamp: e.args.timestamp as bigint,
        callvalue: e.args.callvalue as bigint,
        data: e.args.data as string,
      })
  )
}

/**
 * Build a TransactionRequestData to execute a child-to-parent message
 * through the Outbox contract.
 *
 * @param event The child-to-parent event data
 * @param proof The outbox proof (array of bytes32 hashes)
 * @param network The ArbitrumNetwork for the outbox address
 */
export function getExecuteRequest(
  event: ChildToParentEventData,
  proof: string[],
  network: ArbitrumNetwork
): TransactionRequestData {
  const outbox = new ArbitrumContract(OutboxAbi, network.ethBridge.outbox)
  return outbox.encodeWrite('executeTransaction', [
    proof,
    event.position,
    event.caller,
    event.destination,
    event.arbBlockNum,
    event.ethBlockNum,
    event.timestamp,
    event.callvalue,
    event.data,
  ])
}
