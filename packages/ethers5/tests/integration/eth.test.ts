/**
 * Integration tests for ETH deposit via ethers v5 adapter.
 *
 * Runs against a local arbitrum-testnode. The test:
 * 1. Gets deposit calldata from the SDK
 * 2. Signs and sends the transaction with ethers v5
 * 3. Tracks the cross-chain message
 * 4. Verifies the deposit lands on the child chain
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import {
  getDepositRequest,
  registerCustomArbitrumNetwork,
  getEthDeposits,
  EthDepositMessageStatus,
  type ArbitrumNetwork,
} from '../../src'
import { wrapProvider, fromEthersReceipt } from '../../src/adapter'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const l1RpcUrl = process.env.ETH_URL || 'http://127.0.0.1:8545'
const l2RpcUrl = process.env.ARB_URL || 'http://127.0.0.1:8547'
const funnelKey =
  '0x' +
  (process.env.ETH_KEY ||
    'b6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659')

const localNetworkPath =
  process.env.ARBITRUM_TESTNODE_LOCAL_NETWORK_PATH ||
  resolve(__dirname, '../../../../packages/sdk/localNetwork.json')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ETH deposit (ethers5 integration)', () => {
  let l1Provider: JsonRpcProvider
  let l2Provider: JsonRpcProvider
  let signer: Wallet
  let l2Network: ArbitrumNetwork

  beforeAll(() => {
    const raw = JSON.parse(readFileSync(localNetworkPath, 'utf-8'))
    l2Network = registerCustomArbitrumNetwork(raw.l2Network)

    l1Provider = new JsonRpcProvider(l1RpcUrl)
    l2Provider = new JsonRpcProvider(l2RpcUrl)
    signer = new Wallet(funnelKey, l1Provider)
  })

  it('deposits ETH from L1 to L2 and waits for completion', {
    timeout: 180_000,
  }, async () => {
    const amount = 100000000000000n // 0.0001 ETH

    // 1. Get deposit calldata from SDK (no signing, no provider needed)
    const depositReq = getDepositRequest({
      network: l2Network,
      amount,
      from: signer.address,
    })

    expect(depositReq.to).toBe(l2Network.ethBridge.inbox)
    expect(depositReq.value).toBe(amount)

    // 2. Sign and send with ethers v5
    const tx = await signer.sendTransaction({
      to: depositReq.to,
      data: depositReq.data,
      value: depositReq.value,
    })
    const receipt = await tx.wait()
    expect(receipt.status).toBe(1)

    // 3. Track the ETH deposit message
    //    getEthDeposits is re-exported from core and expects core types,
    //    so we convert the ethers5 receipt and provider.
    const coreReceipt = fromEthersReceipt(receipt as any)
    const coreProvider = wrapProvider(l2Provider as any)
    const ethDeposits = getEthDeposits(coreReceipt, coreProvider, l2Network)

    expect(ethDeposits.length).toBeGreaterThan(0)

    // 4. Wait for the deposit to be credited on L2
    const childReceipt = await ethDeposits[0].wait(120_000)
    expect(childReceipt).not.toBeNull()

    const status = await ethDeposits[0].status()
    expect(status).toBe(EthDepositMessageStatus.DEPOSITED)
  })
})
