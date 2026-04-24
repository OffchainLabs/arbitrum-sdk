/**
 * Ethers v5 harness — implements TestHarness using ethers v5.
 */
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { ethers } from 'ethers'
import { wrapProvider, fromEthersReceipt } from '../../src/adapter'
import type { TransactionRequest } from '@ethersproject/abstract-provider'
import type { TestHarness } from '../../../core/tests/integration/harness'
import type {
  ArbitrumProvider,
  ArbitrumTransactionReceipt,
  TransactionRequestData,
} from '@arbitrum/core'

export const ethers5Harness: TestHarness = {
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
    return fromEthersReceipt(receipt as any)
  },

  async getBalance(rpcUrl: string, address: string): Promise<bigint> {
    const provider = new JsonRpcProvider(rpcUrl)
    const balance = await provider.getBalance(address)
    return balance.toBigInt()
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
    const chainId = (await provider.getNetwork()).chainId
    const nonce = await provider.getTransactionCount(wallet.address)

    const txToSign: TransactionRequest = {
      to: tx.to || undefined,
      data: tx.data,
      value: tx.value,
      chainId,
      nonce,
      type: 2,
    }

    // Use provided gas fields or estimate
    if (tx.gasLimit) {
      txToSign.gasLimit = tx.gasLimit
    } else {
      const estimateRequest: TransactionRequest = {
        to: tx.to || ethers.constants.AddressZero,
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
    const parsed = ethers.utils.parseTransaction(signedTx)
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
    return fromEthersReceipt(receipt as any)
  },
}
