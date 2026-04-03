/**
 * Ethers v5 integration tests — runs shared scenarios through the ethers5 harness.
 */
import { ethers5Harness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'
import { erc20Scenarios } from '../../../core/tests/integration/scenarios/erc20.scenarios'
import { customErc20Scenarios } from '../../../core/tests/integration/scenarios/customErc20.scenarios'
import { wethScenarios } from '../../../core/tests/integration/scenarios/weth.scenarios'

const config = loadTestConfig()
ethScenarios(ethers5Harness, config)
erc20Scenarios(ethers5Harness, config)
customErc20Scenarios(ethers5Harness, config)
wethScenarios(ethers5Harness, config)
