/**
 * The components of a submit retryable message. Can be parsed from the
 * events emitted from the Inbox.
 */
export interface RetryableMessageParams {
  /** Destination address for L2 message */
  destAddress: string
  /** Call value in L2 message */
  l2CallValue: bigint
  /** Value sent at L1 */
  l1Value: bigint
  /** Max gas deducted from L2 balance to cover base submission fee */
  maxSubmissionFee: bigint
  /** L2 address to credit (gaslimit x gasprice - execution cost) */
  excessFeeRefundAddress: string
  /** Address to credit l2CallValue on L2 if retryable txn times out or gets cancelled */
  callValueRefundAddress: string
  /** Max gas deducted from user's L2 balance to cover L2 execution */
  gasLimit: bigint
  /** Gas price for L2 execution */
  maxFeePerGas: bigint
  /** Calldata for the L2 message */
  data: string
}

/**
 * The inbox message kind as defined in:
 * https://github.com/OffchainLabs/nitro/blob/c7f3429e2456bf5ca296a49cec3bb437420bc2bb/contracts/src/libraries/MessageTypes.sol
 */
export enum InboxMessageKind {
  L1MessageType_submitRetryableTx = 9,
  L1MessageType_ethDeposit = 12,
  L2MessageType_signedTx = 4,
}

export enum ChildToParentMessageStatus {
  /** ArbSys.sendTxToL1 called, but assertion not yet confirmed */
  UNCONFIRMED = 0,
  /** Assertion for outgoing message confirmed, but message not yet executed */
  CONFIRMED = 1,
  /** Outgoing message executed (terminal state) */
  EXECUTED = 2,
}

/**
 * Status of a parent-to-child message (retryable ticket).
 * Values match those from the existing SDK.
 */
export enum ParentToChildMessageStatus {
  /** Retryable ticket has not yet been created on the child chain */
  NOT_YET_CREATED = 1,
  /** Retryable ticket creation failed */
  CREATION_FAILED = 2,
  /** Retryable ticket has been created but not yet redeemed; funds deposited on child */
  FUNDS_DEPOSITED_ON_CHILD = 3,
  /** Retryable ticket has been successfully redeemed (terminal state) */
  REDEEMED = 4,
  /** Retryable ticket has expired without being redeemed */
  EXPIRED = 5,
}

/**
 * Status of an ETH deposit message.
 */
export enum EthDepositMessageStatus {
  /** Deposit has been initiated but not yet credited on the child chain */
  PENDING = 1,
  /** Deposit has been credited on the child chain (terminal state) */
  DEPOSITED = 2,
}
