/**
 * Send signed child-chain transactions via the parent chain inbox.
 *
 * Ported from packages/sdk/tests/integration/sendChildmsg.test.ts.
 * Tests that signed child-chain transactions can be sent through the
 * delayed inbox on the parent chain and executed on the child chain.
 */
import { describe, it, expect } from 'vitest'
import type { TestHarness, TestConfig } from '../harness'
import {
  ArbitrumContract,
  IInboxAbi,
  InboxMessageKind,
  keccak256,
  rlpEncode,
  type ArbitrumNetwork,
  type TransactionRequestData,
} from '../../../src'
import { concat } from '../../../src/encoding/hex'

/** Greeter contract ABI and bytecode (from the legacy test helper). */
const greeterAbi = [
  {
    inputs: [],
    name: 'greet',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const greeterBytecode =
  '0x608060405234801561001057600080fd5b506040518060400160405280600b81526020017f68656c6c6f20776f726c640000000000000000000000000000000000000000008152506000908051906020019061005c9291906100a3565b5033600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506101a7565b8280546100af90610146565b90600052602060002090601f0160209004810192826100d15760008555610118565b82601f106100ea57805160ff1916838001178555610118565b82800160010185558215610118579182015b828111156101175782518255916020019190600101906100fc565b5b5090506101259190610129565b5090565b5b8082111561014257600081600090555060010161012a565b5090565b6000600282049050600182168061015e57607f821691505b6020821081141561017257610171610178565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b61064f806101b66000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c8063a413686214610046578063cfae321714610062578063d5f3948814610080575b600080fd5b610060600480360381019061005b9190610313565b61009e565b005b61006a610148565b60405161007791906103e2565b60405180910390f35b6100886101da565b60405161009591906103c7565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461012e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161012590610404565b60405180910390fd5b8060009080519060200190610144929190610200565b5050565b6060600080546101579061050a565b80601f01602080910402602001604051908101604052809291908181526020018280546101839061050a565b80156101d05780601f106101a5576101008083540402835291602001916101d0565b820191906000526020600020905b8154815290600101906020018083116101b357829003601f168201915b5050505050905090565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b82805461020c9061050a565b90600052602060002090601f01602090048101928261022e5760008555610275565b82601f1061024757805160ff1916838001178555610275565b82800160010185558215610275579182015b82811115610274578251825591602001919060010190610259565b5b5090506102829190610286565b5090565b5b8082111561029f576000816000905550600101610287565b5090565b60006102b66102b184610449565b610424565b9050828152602081018484840111156102d2576102d16105d0565b5b6102dd8482856104c8565b509392505050565b600082601f8301126102fa576102f96105cb565b5b813561030a8482602086016102a3565b91505092915050565b600060208284031215610329576103286105da565b5b600082013567ffffffffffffffff811115610347576103466105d5565b5b610353848285016102e5565b91505092915050565b61036581610496565b82525050565b60006103768261047a565b6103808185610485565b93506103908185602086016104d7565b610399816105df565b840191505092915050565b60006103b1601983610485565b91506103bc826105f0565b602082019050919050565b60006020820190506103dc600083018461035c565b92915050565b600060208201905081810360008301526103fc818461036b565b905092915050565b6000602082019050818103600083015261041d816103a4565b9050919050565b600061042e61043f565b905061043a828261053c565b919050565b6000604051905090565b600067ffffffffffffffff8211156104645761046361059c565b5b61046d826105df565b9050602081019050919050565b600081519050919050565b600082825260208201905092915050565b60006104a1826104a8565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b82818337600083830152505050565b60005b838110156104f55780820151818401526020810190506104da565b83811115610504576000848401525b50505050565b6000600282049050600182168061052257607f821691505b602082108114156105365761053561056d565b5b50919050565b610545826105df565b810181811067ffffffffffffffff821117156105645761056361059c565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4f6e6c79206465706c6f7965722063616e20646f20746869730000000000000060008201525056fea264697066735822122006dc1f58e4dba2ce67f456ac9e8845fad95aaab9cf5682f1e35279ffd90ff2e164736f6c63430008070033'

/**
 * Get the parent and child RPC URLs and the active network
 * based on whether this is an orbit test.
 */
function getNetworkContext(config: TestConfig): {
  parentRpcUrl: string
  childRpcUrl: string
  network: ArbitrumNetwork
} {
  if (config.isOrbitTest && config.l3Network) {
    return {
      parentRpcUrl: config.l2RpcUrl,
      childRpcUrl: config.l3RpcUrl,
      network: config.l3Network,
    }
  }
  return {
    parentRpcUrl: config.l1RpcUrl,
    childRpcUrl: config.l2RpcUrl,
    network: config.l2Network,
  }
}

/**
 * Build the sendL2Message calldata for the parent chain inbox.
 * The message data is: 0x04 (L2MessageType_signedTx) + signed tx bytes.
 */
function buildSendL2MessageTx(
  signedTx: string,
  network: ArbitrumNetwork
): TransactionRequestData {
  // Build the message: uint8(4) ++ signedTx bytes
  const messageTypeHex = '0x' + InboxMessageKind.L2MessageType_signedTx.toString(16).padStart(2, '0')
  const messageData = concat([messageTypeHex, signedTx])

  const inbox = new ArbitrumContract(IInboxAbi, network.ethBridge.inbox)
  return inbox.encodeWrite('sendL2Message', [messageData])
}

/**
 * Compute the contract address deployed by a given sender at a given nonce.
 * Uses the standard CREATE address formula: keccak256(rlpEncode([sender, nonce]))[12:]
 */
function computeContractAddress(sender: string, nonce: number): string {
  const senderHex = sender.toLowerCase()
  // RLP encode nonce: 0 -> '0x' (empty string), otherwise hex
  let nonceHex: string
  if (nonce === 0) {
    nonceHex = '0x'
  } else {
    const h = nonce.toString(16)
    nonceHex = '0x' + (h.length % 2 === 0 ? h : '0' + h)
  }

  const encoded = rlpEncode([senderHex, nonceHex])
  const hash = keccak256(encoded)
  // Take the last 20 bytes (40 hex chars)
  return '0x' + hash.slice(-40)
}

/**
 * Register all sendChildMsg scenarios.
 */
export function sendChildMsgScenarios(
  harness: TestHarness,
  config: TestConfig
): void {
  const { parentRpcUrl, childRpcUrl, network } = getNetworkContext(config)
  const funnelKey = config.funnelKey

  describe('Send signed child-chain tx via inbox', () => {
    // -----------------------------------------------------------------
    // Test 1: can deploy contract via inbox
    // -----------------------------------------------------------------
    it(
      'can deploy contract via inbox',
      async () => {
        const senderAddress = harness.getAddress(funnelKey)

        // Get the current nonce on child chain for contract address computation
        const childProvider = harness.createProvider(childRpcUrl)
        const childNonce = await childProvider.getTransactionCount(
          senderAddress
        )

        // 1. Sign a contract deployment TX for the child chain (no `to` field)
        const signedTx = await harness.signTransaction(funnelKey, childRpcUrl, {
          data: greeterBytecode,
          value: 0n,
          to: '',
        } as TransactionRequestData)

        // 2. Send via inbox on parent chain
        const inboxTx = buildSendL2MessageTx(signedTx, network)
        const parentReceipt = await harness.sendTransaction(
          funnelKey,
          parentRpcUrl,
          inboxTx
        )
        expect(parentReceipt.status).toBe(1)

        // 3. Wait for child chain receipt
        const childTxHash = harness.getTransactionHash(signedTx)
        const childReceipt = await harness.waitForTransaction(
          childRpcUrl,
          childTxHash,
          120_000
        )
        expect(childReceipt.status).toBe(1)

        // 4. Compute the deployed contract address
        const contractAddress = computeContractAddress(
          senderAddress,
          childNonce
        )

        // 5. Call greet() on the deployed contract
        const greeterContract = new ArbitrumContract(
          greeterAbi,
          contractAddress
        ).connect(childProvider)
        const [greetResult] = await greeterContract.read('greet', [])
        expect(greetResult).toBe('hello world')
      },
      120_000
    )

    // -----------------------------------------------------------------
    // Test 2: should confirm the same tx on child chain
    // -----------------------------------------------------------------
    it(
      'should confirm the same tx on child chain',
      async () => {
        const senderAddress = harness.getAddress(funnelKey)

        // 1. Sign a simple data TX for child chain
        const signedTx = await harness.signTransaction(funnelKey, childRpcUrl, {
          data: '0x12',
          to: senderAddress,
          value: 0n,
        } as TransactionRequestData)

        // 2. Send via inbox on parent chain
        const inboxTx = buildSendL2MessageTx(signedTx, network)
        const parentReceipt = await harness.sendTransaction(
          funnelKey,
          parentRpcUrl,
          inboxTx
        )
        expect(parentReceipt.status).toBe(1)

        // 3. Wait for child chain receipt
        const childTxHash = harness.getTransactionHash(signedTx)
        const childReceipt = await harness.waitForTransaction(
          childRpcUrl,
          childTxHash,
          60_000
        )
        expect(childReceipt.status).toBe(1)
      },
      60_000
    )

    // -----------------------------------------------------------------
    // Test 3: send two tx with same nonce but different gas price
    // -----------------------------------------------------------------
    it(
      'send two tx share the same nonce but with different gas price, should confirm the one which gas price higher than child base price',
      async () => {
        const senderAddress = harness.getAddress(funnelKey)

        // 1. Get current nonce on child chain
        const childProvider = harness.createProvider(childRpcUrl)
        const currentNonce = await childProvider.getTransactionCount(
          senderAddress
        )

        // 2. Sign TX with low gas price using that nonce
        const lowFeeTx = {
          data: '0x12',
          to: senderAddress,
          value: 0n,
          nonce: currentNonce,
          maxFeePerGas: 10_000_000n, // 0.01 gwei
          maxPriorityFeePerGas: 1_000_000n, // 0.001 gwei
        } as unknown as TransactionRequestData
        const lowFeeSignedTx = await harness.signTransaction(
          funnelKey,
          childRpcUrl,
          lowFeeTx
        )

        // 3. Send low-gas TX via inbox
        const lowFeeInboxTx = buildSendL2MessageTx(lowFeeSignedTx, network)
        const lowFeeParentReceipt = await harness.sendTransaction(
          funnelKey,
          parentRpcUrl,
          lowFeeInboxTx
        )
        expect(lowFeeParentReceipt.status).toBe(1)

        // 4. Sign TX with normal gas price using the same nonce
        const normalFeeTx = {
          data: '0x12',
          to: senderAddress,
          value: 0n,
          nonce: currentNonce,
        } as unknown as TransactionRequestData
        const normalFeeSignedTx = await harness.signTransaction(
          funnelKey,
          childRpcUrl,
          normalFeeTx
        )

        // 5. Send normal-gas TX via inbox
        const normalFeeInboxTx = buildSendL2MessageTx(
          normalFeeSignedTx,
          network
        )
        const normalFeeParentReceipt = await harness.sendTransaction(
          funnelKey,
          parentRpcUrl,
          normalFeeInboxTx
        )
        expect(normalFeeParentReceipt.status).toBe(1)

        // 6. Wait for the normal-gas TX on child chain
        const normalFeeTxHash =
          harness.getTransactionHash(normalFeeSignedTx)
        const normalFeeReceipt = await harness.waitForTransaction(
          childRpcUrl,
          normalFeeTxHash,
          60_000
        )
        expect(normalFeeReceipt.status).toBe(1)

        // 7. Check receipt of low-gas TX on child chain -- should be null
        const lowFeeTxHash = harness.getTransactionHash(lowFeeSignedTx)
        const lowFeeReceipt =
          await childProvider.getTransactionReceipt(lowFeeTxHash)
        expect(lowFeeReceipt).toBeNull()
      },
      60_000
    )
  })
}
