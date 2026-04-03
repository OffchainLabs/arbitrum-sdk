/**
 * Shared test configuration for integration tests running against
 * a local arbitrum-testnode.
 *
 * Reads RPC URLs from env vars (matching .env), loads contract addresses
 * from localNetwork.json, and registers custom networks.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { registerCustomArbitrumNetwork, type ArbitrumNetwork } from '../../src'

// RPC endpoints (match .env defaults)
const l1RpcUrl = process.env.ETH_URL || 'http://127.0.0.1:8545'
const l2RpcUrl = process.env.ARB_URL || 'http://127.0.0.1:8547'
const l3RpcUrl = process.env.ORBIT_URL || 'http://127.0.0.1:3347'

// Pre-funded test account private key
const funnelKey =
  process.env.ETH_KEY ||
  'b6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659'

// Path to testnode-deployed contract addresses
const localNetworkPath =
  process.env.ARBITRUM_TESTNODE_LOCAL_NETWORK_PATH ||
  resolve(__dirname, '../../../../packages/sdk/localNetwork.json')

interface LocalNetworkData {
  l2Network: ArbitrumNetwork
  l3Network?: ArbitrumNetwork
}

/**
 * Read localNetwork.json and register both L2 and L3 networks.
 * Safe to call multiple times -- registerCustomArbitrumNetwork warns
 * instead of throwing for duplicates by default.
 */
function loadLocalNetwork(): LocalNetworkData {
  const raw: LocalNetworkData = JSON.parse(
    readFileSync(localNetworkPath, 'utf-8')
  )

  registerCustomArbitrumNetwork(raw.l2Network)
  if (raw.l3Network) {
    registerCustomArbitrumNetwork(raw.l3Network)
  }

  return raw
}

export { l1RpcUrl, l2RpcUrl, l3RpcUrl, funnelKey, loadLocalNetwork }
