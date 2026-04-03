/**
 * Ethers v6 harness — implements TestHarness using ethers v6.
 */
import { JsonRpcProvider, Wallet } from 'ethers'
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
}
