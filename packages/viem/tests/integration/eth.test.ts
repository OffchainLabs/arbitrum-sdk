/**
 * Integration tests for ETH deposit via viem adapter.
 *
 * Runs against a local arbitrum-testnode. The test:
 * 1. Gets deposit calldata from the SDK
 * 2. Signs and sends the transaction with viem
 * 3. Tracks the cross-chain message
 * 4. Verifies the deposit lands on the child chain
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getDepositRequest,
  registerCustomArbitrumNetwork,
  getEthDeposits,
  fromViemReceipt,
  EthDepositMessageStatus,
  type ArbitrumNetwork,
} from '../../src'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const l1RpcUrl = process.env.ETH_URL || 'http://127.0.0.1:8545'
const l2RpcUrl = process.env.ARB_URL || 'http://127.0.0.1:8547'
const funnelKey = (
  '0x' +
  (process.env.ETH_KEY ||
    'b6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659')
) as `0x${string}`

const localNetworkPath =
  process.env.ARBITRUM_TESTNODE_LOCAL_NETWORK_PATH ||
  resolve(__dirname, '../../../../packages/sdk/localNetwork.json')

// Minimal chain definitions for viem (testnode has no pre-registered chains)
const l1Chain: Chain = {
  id: 1337,
  name: 'L1 Local',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [l1RpcUrl] } },
}

const l2Chain: Chain = {
  id: 412346,
  name: 'L2 Local',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [l2RpcUrl] } },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ETH deposit (viem integration)', () => {
  let l1PublicClient: PublicClient
  let l2PublicClient: PublicClient
  let l1WalletClient: WalletClient
  let l2Network: ArbitrumNetwork
  let account: ReturnType<typeof privateKeyToAccount>

  beforeAll(() => {
    const raw = JSON.parse(readFileSync(localNetworkPath, 'utf-8'))
    l2Network = registerCustomArbitrumNetwork(raw.l2Network)

    account = privateKeyToAccount(funnelKey)

    l1PublicClient = createPublicClient({
      chain: l1Chain,
      transport: http(l1RpcUrl),
    })

    l2PublicClient = createPublicClient({
      chain: l2Chain,
      transport: http(l2RpcUrl),
    })

    l1WalletClient = createWalletClient({
      account,
      chain: l1Chain,
      transport: http(l1RpcUrl),
    })
  })

  it('deposits ETH from L1 to L2 and waits for completion', {
    timeout: 180_000,
  }, async () => {
    const amount = 100000000000000n // 0.0001 ETH

    // 1. Get deposit calldata from SDK (no signing, no provider needed)
    const depositReq = getDepositRequest({
      network: l2Network,
      amount,
      from: account.address,
    })

    expect(depositReq.to).toBe(l2Network.ethBridge.inbox)
    expect(depositReq.value).toBe(amount)

    // 2. Sign and send with viem
    const hash = await l1WalletClient.sendTransaction({
      to: depositReq.to as `0x${string}`,
      data: depositReq.data as `0x${string}`,
      value: depositReq.value,
      chain: l1Chain,
      account,
    })

    const receipt = await l1PublicClient.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')

    // 3. Track the ETH deposit message.
    //    Convert viem receipt to ArbitrumTransactionReceipt, then use
    //    getEthDeposits which accepts core receipt + viem PublicClient.
    const coreReceipt = fromViemReceipt(receipt as any)
    const ethDeposits = getEthDeposits(
      coreReceipt,
      l2PublicClient as any,
      l2Network
    )

    expect(ethDeposits.length).toBeGreaterThan(0)

    // 4. Wait for the deposit to be credited on L2
    const childReceipt = await ethDeposits[0].wait(120_000)
    expect(childReceipt).not.toBeNull()

    const status = await ethDeposits[0].status()
    expect(status).toBe(EthDepositMessageStatus.DEPOSITED)
  })
})
