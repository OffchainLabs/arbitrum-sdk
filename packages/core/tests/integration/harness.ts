/**
 * TestHarness — provider-agnostic interface for integration tests.
 *
 * Test scenarios are defined ONCE in core using this interface.
 * Each adapter package (ethers5, ethers6, viem) provides an implementation.
 */
import type {
  ArbitrumProvider,
  ArbitrumTransactionReceipt,
  TransactionRequestData,
  ArbitrumNetwork,
} from '../../src'

export interface TestHarness {
  /** Create a core ArbitrumProvider from an RPC URL */
  createProvider(rpcUrl: string): ArbitrumProvider

  /** Sign + send a TransactionRequestData, return core receipt */
  sendTransaction(
    privateKey: string,
    rpcUrl: string,
    tx: TransactionRequestData
  ): Promise<ArbitrumTransactionReceipt>

  /** Get native balance */
  getBalance(rpcUrl: string, address: string): Promise<bigint>

  /** Get address from private key */
  getAddress(privateKey: string): string

  /** Send raw ETH transfer (for funding wallets, mining blocks) */
  sendEth(
    privateKey: string,
    rpcUrl: string,
    to: string,
    value: bigint
  ): Promise<ArbitrumTransactionReceipt>

  /** Deploy contract bytecode, return deployed address */
  deployContract(
    privateKey: string,
    rpcUrl: string,
    bytecode: string
  ): Promise<{ address: string; receipt: ArbitrumTransactionReceipt }>

  /** Sign a transaction without sending it, return serialized hex */
  signTransaction(
    privateKey: string,
    rpcUrl: string,
    tx: TransactionRequestData
  ): Promise<string>

  /** Parse a signed transaction to get its hash */
  getTransactionHash(signedTx: string): string

  /** Wait for a transaction by hash to be mined, return receipt */
  waitForTransaction(
    rpcUrl: string,
    txHash: string,
    timeout?: number
  ): Promise<ArbitrumTransactionReceipt>
}

export interface TestConfig {
  l1RpcUrl: string
  l2RpcUrl: string
  l3RpcUrl: string
  /** Pre-funded key for both L1 and L2 */
  funnelKey: string
  l2Network: ArbitrumNetwork
  l3Network?: ArbitrumNetwork
  /** True when the child chain uses native ETH (not a custom gas token) */
  isEthNative: boolean
  /** True when ORBIT_TEST=1 (testing L3) */
  isOrbitTest: boolean
}
