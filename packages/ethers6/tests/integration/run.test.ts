/**
 * Ethers v6 integration tests — runs shared ETH scenarios through the ethers6 harness.
 */
import { ethers6Harness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'

const config = loadTestConfig()
ethScenarios(ethers6Harness, config)
