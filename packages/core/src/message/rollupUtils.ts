/**
 * rollupUtils — Utility functions for querying rollup assertion state.
 *
 * Provides BOLD vs Classic rollup detection, and helpers to resolve
 * assertion state (sendRoot, sendCount) needed for child-to-parent
 * message status checks.
 */
import type { ArbitrumProvider } from '../interfaces/provider'
import type { ArbitrumNetwork } from '../networks'
import { ArbitrumContract } from '../contracts/Contract'
import { RollupUserLogicAbi } from '../abi/RollupUserLogic'
import { BoldRollupUserLogicAbi } from '../abi/BoldRollupUserLogic'
import { EventFetcher } from '../utils/eventFetcher'
import { ContractCallError, ArbSdkError } from '../errors'
import type { ChildToParentEventData } from './childToParentMessage'

/**
 * Detect whether a rollup contract uses the BOLD protocol.
 *
 * BOLD rollups do not have the `extraChallengeTimeBlocks()` function.
 * If calling it reverts with a call exception, the rollup is BOLD.
 *
 * @param parentProvider Provider connected to the parent chain
 * @param rollupAddress Address of the rollup contract
 * @returns true if BOLD, false if classic
 */
export async function isBold(
  parentProvider: ArbitrumProvider,
  rollupAddress: string
): Promise<boolean> {
  const rollup = new ArbitrumContract(
    RollupUserLogicAbi,
    rollupAddress,
    parentProvider
  )
  try {
    await rollup.read('extraChallengeTimeBlocks', [])
    return false
  } catch (err) {
    if (err instanceof ContractCallError) {
      // If the inner error is itself not a ContractCallError, it may be
      // a network-level failure rather than a contract revert. Propagate it.
      if (err.inner && !(err.inner instanceof ContractCallError)) {
        // Check if the inner error is a generic (non-contract) error
        // by looking at whether the original provider.call threw
        // something that isn't a call exception pattern.
        // In practice, contract reverts produce empty/error responses
        // while network errors produce connection failures.
        // We rethrow if the inner error message doesn't look like
        // a call exception.
        const innerMsg = err.inner.message.toLowerCase()
        if (
          innerMsg.includes('network') ||
          innerMsg.includes('timeout') ||
          innerMsg.includes('econnrefused') ||
          innerMsg.includes('fetch')
        ) {
          throw err.inner
        }
      }
      return true
    }
    throw err
  }
}

/**
 * Result from querying rollup assertion state.
 */
export interface SendProps {
  sendRootSize: bigint | undefined
  sendRootHash: string | undefined
  sendRootConfirmed: boolean
}

/**
 * Get the sendRoot properties for a child-to-parent message by querying
 * the rollup contract for the latest confirmed assertion.
 *
 * This determines whether the assertion containing the message's position
 * has been confirmed on the parent chain.
 *
 * @param parentProvider Provider for the parent chain (where rollup lives)
 * @param childProvider Provider for the child chain (Arbitrum)
 * @param event The child-to-parent event data
 * @param network The ArbitrumNetwork configuration
 */
export async function getSendProps(
  parentProvider: ArbitrumProvider,
  childProvider: ArbitrumProvider,
  event: ChildToParentEventData,
  network: ArbitrumNetwork
): Promise<SendProps> {
  const bold = await isBold(parentProvider, network.ethBridge.rollup)

  if (bold) {
    return getSendPropsBold(parentProvider, childProvider, event, network)
  }
  return getSendPropsClassic(parentProvider, childProvider, event, network)
}

/**
 * Classic (non-BOLD) rollup: get send props by querying nodes.
 */
async function getSendPropsClassic(
  parentProvider: ArbitrumProvider,
  childProvider: ArbitrumProvider,
  event: ChildToParentEventData,
  network: ArbitrumNetwork
): Promise<SendProps> {
  const rollup = new ArbitrumContract(
    RollupUserLogicAbi,
    network.ethBridge.rollup,
    parentProvider
  )

  // Get the latest confirmed node number
  const latestConfirmedResult = await rollup.read('latestConfirmed', [])
  const latestConfirmedNodeNum = latestConfirmedResult[0] as bigint

  // Get the confirmed node to find createdAtBlock
  const nodeResult = await rollup.read('getNode', [latestConfirmedNodeNum])
  // nodeResult[0] is the Node struct tuple
  const nodeTuple = nodeResult[0] as unknown[]
  const createdAtBlock = nodeTuple[10] as bigint // createdAtBlock is index 10

  // Fetch NodeCreated event at the creation block to get assertion data
  const eventFetcher = new EventFetcher(parentProvider)
  const logs = await eventFetcher.getEvents(
    RollupUserLogicAbi,
    'NodeCreated',
    {
      fromBlock: Number(createdAtBlock),
      toBlock: Number(createdAtBlock),
      address: network.ethBridge.rollup,
    }
  )

  if (logs.length === 0) {
    return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
  }

  // Find the log matching our node number
  const matchingLog = logs.find(
    l => (l.args.nodeNum as bigint) === latestConfirmedNodeNum
  ) || logs[0]

  // Parse the assertion data from the event
  // NodeCreated event has assertion tuple with afterState.globalState.bytes32Vals
  const assertion = matchingLog.args.assertion as {
    afterState: {
      globalState: {
        bytes32Vals: [string, string]
      }
    }
  }

  const blockHash = assertion.afterState.globalState.bytes32Vals[0]
  const sendRoot = assertion.afterState.globalState.bytes32Vals[1]

  // Get the child block by its hash to find sendCount
  const childBlock = await childProvider.getBlock(blockHash as unknown as number)
  if (!childBlock) {
    // If block hash is zero (genesis), treat as no data
    if (
      blockHash ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
    }
    throw new ArbSdkError(`Block not found for hash ${blockHash}`)
  }

  // The child block has sendCount as a property (Arbitrum-specific)
  const sendCount = BigInt(
    (childBlock as unknown as { sendCount: string }).sendCount
  )

  if (sendCount > event.position) {
    return {
      sendRootSize: sendCount,
      sendRootHash: sendRoot,
      sendRootConfirmed: true,
    }
  }

  return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
}

/**
 * BOLD rollup: get send props by querying assertions.
 */
async function getSendPropsBold(
  parentProvider: ArbitrumProvider,
  childProvider: ArbitrumProvider,
  event: ChildToParentEventData,
  network: ArbitrumNetwork
): Promise<SendProps> {
  const rollup = new ArbitrumContract(
    BoldRollupUserLogicAbi,
    network.ethBridge.rollup,
    parentProvider
  )

  // Get the latest confirmed assertion hash
  const latestConfirmedResult = await rollup.read('latestConfirmed', [])
  const latestConfirmedHash = latestConfirmedResult[0] as string

  // Get the assertion to find createdAtBlock
  const assertionResult = await rollup.read('getAssertion', [latestConfirmedHash])
  const assertionTuple = assertionResult[0] as unknown[]
  const createdAtBlock = assertionTuple[2] as bigint // createdAtBlock is index 2

  // Fetch AssertionCreated event at the creation block
  const eventFetcher = new EventFetcher(parentProvider)
  const logs = await eventFetcher.getEvents(
    BoldRollupUserLogicAbi,
    'AssertionCreated',
    {
      fromBlock: Number(createdAtBlock),
      toBlock: Number(createdAtBlock),
      address: network.ethBridge.rollup,
    }
  )

  if (logs.length === 0) {
    return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
  }

  // Find the matching assertion
  const matchingLog = logs.find(
    l => (l.args.assertionHash as string) === latestConfirmedHash
  ) || logs[0]

  // Parse afterState from the assertion event
  const assertion = matchingLog.args.assertion as {
    afterState: {
      globalState: {
        bytes32Vals: [string, string]
      }
    }
  }

  const blockHash = assertion.afterState.globalState.bytes32Vals[0]
  const sendRoot = assertion.afterState.globalState.bytes32Vals[1]

  // Get the child block
  const childBlock = await childProvider.getBlock(blockHash as unknown as number)
  if (!childBlock) {
    if (
      blockHash ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
    }
    throw new ArbSdkError(`Block not found for hash ${blockHash}`)
  }

  const sendCount = BigInt(
    (childBlock as unknown as { sendCount: string }).sendCount
  )

  if (sendCount > event.position) {
    return {
      sendRootSize: sendCount,
      sendRootHash: sendRoot,
      sendRootConfirmed: true,
    }
  }

  return { sendRootSize: undefined, sendRootHash: undefined, sendRootConfirmed: false }
}
