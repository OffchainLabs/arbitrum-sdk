/**
 * Ethers v5 integration tests — runs shared ETH scenarios through the ethers5 harness.
 */
import { ethers5Harness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'

const config = loadTestConfig()
ethScenarios(ethers5Harness, config)
