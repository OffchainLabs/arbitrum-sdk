/**
 * Viem integration tests — runs shared ETH scenarios through the viem harness.
 */
import { viemHarness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'

const config = loadTestConfig()
ethScenarios(viemHarness, config)
