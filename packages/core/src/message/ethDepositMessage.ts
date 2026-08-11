/**
 * EthDepositMessage — tracks ETH deposits from parent to child chain.
 *
 * ETH deposits are simpler than retryable tickets: they create a deterministic
 * child chain transaction hash. Status is either PENDING or DEPOSITED.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumTransactionReceipt } from '../interfaces/types'
import type { ArbitrumNetwork } from '../networks'
import { EthDepositMessageStatus, InboxMessageKind } from './types'
import { calculateDepositTxId } from './retryableId'
import { getMessageEvents } from './parentTransaction'
import { getAddress } from '../encoding/address'
import { isDefined } from '../utils/lib'

const DEFAULT_DEPOSIT_TIMEOUT = 30 * 60 * 1000

/**
 * Parse the data field in the InboxMessageDelivered event for ETH deposits.
 * The data is packed: 20-byte address followed by the value as a uint256.
 */
function parseEthDepositData(eventData: string): {
  to: string
  value: bigint
} {
  const hex = eventData.startsWith('0x') ? eventData.slice(2) : eventData
  // First 20 bytes = 40 hex chars = destination address
  const addressEnd = 40
  const to = getAddress('0x' + hex.substring(0, addressEnd))
  const value = BigInt('0x' + hex.substring(addressEnd))
  return { to, value }
}

/**
 * Represents an ETH deposit message from parent to child chain.
 */
export class EthDepositMessage {
  public readonly childTxHash: string
  private childTxReceipt: ArbitrumTransactionReceipt | null | undefined

  constructor(
    private readonly childProvider: ArbitrumProvider,
    public readonly childChainId: number,
    public readonly messageNumber: bigint,
    public readonly from: string,
    public readonly to: string,
    public readonly value: bigint
  ) {
    this.childTxHash = calculateDepositTxId({
      chainId: childChainId,
      messageNumber,
      fromAddress: from,
      toAddress: to,
      value,
    })
  }

  /**
   * Create an EthDepositMessage from event data.
   */
  public static fromEventComponents(
    childProvider: ArbitrumProvider,
    childChainId: number,
    messageNumber: bigint,
    senderAddr: string,
    inboxMessageEventData: string
  ): EthDepositMessage {
    const { to, value } = parseEthDepositData(inboxMessageEventData)
    return new EthDepositMessage(
      childProvider,
      childChainId,
      messageNumber,
      senderAddr,
      to,
      value
    )
  }

  /**
   * Get the status of this ETH deposit.
   */
  public async status(): Promise<EthDepositMessageStatus> {
    const receipt = await this.childProvider.getTransactionReceipt(
      this.childTxHash
    )
    if (receipt === null) return EthDepositMessageStatus.PENDING
    return EthDepositMessageStatus.DEPOSITED
  }

  /**
   * Wait for the deposit to be credited on the child chain.
   * @param timeout Timeout in milliseconds. Defaults to 30 minutes.
   */
  public async wait(
    timeout?: number
  ): Promise<ArbitrumTransactionReceipt | null> {
    const chosenTimeout = isDefined(timeout) ? timeout : DEFAULT_DEPOSIT_TIMEOUT

    if (this.childTxReceipt !== undefined) {
      return this.childTxReceipt ?? null
    }

    const startTime = Date.now()
    while (Date.now() - startTime < chosenTimeout) {
      const receipt = await this.childProvider.getTransactionReceipt(
        this.childTxHash
      )
      if (receipt) {
        this.childTxReceipt = receipt
        return receipt
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    this.childTxReceipt = null
    return null
  }
}

/**
 * Extract EthDepositMessage instances from a parent chain transaction receipt.
 * Filters for ETH deposit message kind and constructs deposit messages.
 */
export function getEthDeposits(
  receipt: ArbitrumTransactionReceipt,
  childProvider: ArbitrumProvider,
  network: ArbitrumNetwork
): EthDepositMessage[] {
  return getMessageEvents(receipt)
    .filter(
      e =>
        (e.bridgeMessageEvent.args.kind as bigint) ===
        BigInt(InboxMessageKind.L1MessageType_ethDeposit)
    )
    .map(m =>
      EthDepositMessage.fromEventComponents(
        childProvider,
        network.chainId,
        m.inboxMessageEvent.args.messageNum as bigint,
        m.bridgeMessageEvent.args.sender as string,
        m.inboxMessageEvent.args.data as string
      )
    )
}
