/**
 * Ethers v6 harness — implements TestHarness using ethers v6.
 */
import { JsonRpcProvider, Wallet, Transaction } from 'ethers'
import { wrapProvider, fromEthersReceipt } from '../../src/adapter'
import type { TestHarness } from '../../../core/tests/integration/harness'
import type {
  ArbitrumProvider,
  ArbitrumTransactionReceipt,
  TransactionRequestData,
} from '@arbitrum/core'

export const ethers6Harness: TestHarness = {
  createProvider(rpcUrl: string): ArbitrumProvider {
    return wrapProvider(new JsonRpcProvider(rpcUrl) as any)
  },

  async sendTransaction(
    privateKey: string,
    rpcUrl: string,
    tx: TransactionRequestData
  ): Promise<ArbitrumTransactionReceipt> {
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(privateKey, provider)
    const response = await wallet.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      ...(tx.gasLimit !== undefined && { gasLimit: tx.gasLimit }),
    })
    const receipt = await response.wait()
    if (!receipt) throw new Error('Transaction receipt is null')
    return fromEthersReceipt(receipt as any)
  },

  async getBalance(rpcUrl: string, address: string): Promise<bigint> {
    const provider = new JsonRpcProvider(rpcUrl)
    return provider.getBalance(address)
  },

  getAddress(privateKey: string): string {
    return new Wallet(privateKey).address
  },

  async sendEth(
    privateKey: string,
    rpcUrl: string,
    to: string,
    value: bigint
  ): Promise<ArbitrumTransactionReceipt> {
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(privateKey, provider)
    const response = await wallet.sendTransaction({ to, value })
    const receipt = await response.wait()
    if (!receipt) throw new Error('Transaction receipt is null')
    return fromEthersReceipt(receipt as any)
  },

  async deployContract(
    privateKey: string,
    rpcUrl: string,
    bytecode: string
  ): Promise<{ address: string; receipt: ArbitrumTransactionReceipt }> {
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(privateKey, provider)
    const response = await wallet.sendTransaction({ data: bytecode })
    const receipt = await response.wait()
    if (!receipt) throw new Error('Transaction receipt is null')
    const coreReceipt = fromEthersReceipt(receipt as any)
    if (!coreReceipt.contractAddress) {
      throw new Error('Contract deployment failed: no contract address')
    }
    return { address: coreReceipt.contractAddress, receipt: coreReceipt }
  },

  async signTransaction(
    privateKey: string,
    rpcUrl: string,
    tx: TransactionRequestData
  ): Promise<string> {
    const provider = new JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(privateKey, provider)
    const network = await provider.getNetwork()
    const nonce = await provider.getTransactionCount(wallet.address)

    const txToSign: Record<string, unknown> = {
      to: tx.to || undefined,
      data: tx.data,
      value: tx.value,
      chainId: network.chainId,
      nonce,
      type: 2,
    }

    // Use provided gas fields or estimate
    if (tx.gasLimit) {
      txToSign.gasLimit = tx.gasLimit
    } else {
      const estimateRequest = {
        to: tx.to || '0x0000000000000000000000000000000000000000',
        data: tx.data,
        value: tx.value,
        from: wallet.address,
      }
      txToSign.gasLimit = await provider.estimateGas(estimateRequest)
    }

    const feeData = await provider.getFeeData()
    if ((tx as any).maxFeePerGas !== undefined) {
      txToSign.maxFeePerGas = (tx as any).maxFeePerGas
      txToSign.maxPriorityFeePerGas = (tx as any).maxPriorityFeePerGas
    } else {
      txToSign.maxFeePerGas = feeData.maxFeePerGas!
      txToSign.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas!
    }

    if ((tx as any).nonce !== undefined) {
      txToSign.nonce = (tx as any).nonce
    }

    return wallet.signTransaction(txToSign)
  },

  getTransactionHash(signedTx: string): string {
    const parsed = Transaction.from(signedTx)
    if (!parsed.hash) {
      throw new Error('Could not parse transaction hash from signed tx')
    }
    return parsed.hash
  },

  async waitForTransaction(
    rpcUrl: string,
    txHash: string,
    timeout?: number
  ): Promise<ArbitrumTransactionReceipt> {
    const provider = new JsonRpcProvider(rpcUrl)
    const receipt = await provider.waitForTransaction(
      txHash,
      1,
      timeout ?? 60_000
    )
    if (!receipt) throw new Error('Transaction receipt is null')
    return fromEthersReceipt(receipt as any)
  },
}
