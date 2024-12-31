import {
  ChildToParentMessage,
  ChildToParentMessageStatus,
  ChildTransactionReceipt,
} from '@arbitrum/sdk'
import { config } from '@arbitrum/sdk/tests/testSetup'
import {
  publicClientToProvider,
  viemTransactionReceiptToEthersTransactionReceipt,
} from '@offchainlabs/ethers-viem-compat'
import { Wallet } from 'ethers'
import { Hash, PublicClient, TransactionReceipt } from 'viem'

/**
 * Test utility to execute a withdrawal after it's been confirmed.
 */
export async function executeConfirmedWithdrawal(
  viemReceipt: TransactionReceipt,
  childClient: PublicClient,
  parentClient: PublicClient,
  confirmations = 1
): Promise<{ status: boolean; hash: Hash }> {
  const childProvider = publicClientToProvider(childClient)
  const parentProvider = publicClientToProvider(parentClient)

  const ethersReceipt =
    viemTransactionReceiptToEthersTransactionReceipt(viemReceipt)

  const childReceipt = new ChildTransactionReceipt(ethersReceipt)

  const messages = await childReceipt.getChildToParentMessages(parentProvider)
  if (messages.length === 0) {
    throw new Error('No messages found in receipt')
  }

  const message = messages[0]

  // Wait for message to be ready to execute
  await message.waitUntilReadyToExecute(childProvider)

  // Check if message has been confirmed
  const status = await message.status(childProvider)
  if (status !== ChildToParentMessageStatus.CONFIRMED) {
    throw new Error('Message not confirmed after waiting')
  }

  // Create a writer to execute the message
  const parentSigner = new Wallet(`0x${config.ethKey}`, parentProvider)
  const events = childReceipt.getChildToParentEvents()
  const messageWriter = ChildToParentMessage.fromEvent(parentSigner, events[0])

  // Execute the message
  const execTx = await messageWriter.execute(childProvider)
  const execHash = execTx.hash

  const execReceipt = await parentClient.waitForTransactionReceipt({
    hash: execHash as `0x${string}`,
    confirmations,
  })

  return {
    status: Boolean(execReceipt.status),
    hash: execHash as Hash,
  }
}
