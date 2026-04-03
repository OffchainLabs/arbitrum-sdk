/**
 * Ethers v6 integration tests — runs shared scenarios through the ethers6 harness.
 */
import { ethers6Harness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'
import { erc20Scenarios } from '../../../core/tests/integration/scenarios/erc20.scenarios'
import { customErc20Scenarios } from '../../../core/tests/integration/scenarios/customErc20.scenarios'
import { wethScenarios } from '../../../core/tests/integration/scenarios/weth.scenarios'

const config = loadTestConfig()
ethScenarios(ethers6Harness, config)
erc20Scenarios(ethers6Harness, config)
customErc20Scenarios(ethers6Harness, config)
wethScenarios(ethers6Harness, config)
