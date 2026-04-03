/**
 * Viem integration tests — runs shared scenarios through the viem harness.
 */
import { viemHarness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'
import { erc20Scenarios } from '../../../core/tests/integration/scenarios/erc20.scenarios'
import { customErc20Scenarios } from '../../../core/tests/integration/scenarios/customErc20.scenarios'
import { wethScenarios } from '../../../core/tests/integration/scenarios/weth.scenarios'

const config = loadTestConfig()
ethScenarios(viemHarness, config)
erc20Scenarios(viemHarness, config)
customErc20Scenarios(viemHarness, config)
wethScenarios(viemHarness, config)
