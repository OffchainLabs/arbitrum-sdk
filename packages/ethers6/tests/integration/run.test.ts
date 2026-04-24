/**
 * Ethers v6 integration tests — runs shared scenarios through the ethers6 harness.
 */
import { ethers6Harness } from './harness'
import { loadTestConfig } from '../../../core/tests/integration/testConfig'
import { ethScenarios } from '../../../core/tests/integration/scenarios/eth.scenarios'
import { erc20Scenarios } from '../../../core/tests/integration/scenarios/erc20.scenarios'
import { customErc20Scenarios } from '../../../core/tests/integration/scenarios/customErc20.scenarios'
import { wethScenarios } from '../../../core/tests/integration/scenarios/weth.scenarios'
import { gasEstimationScenarios } from '../../../core/tests/integration/scenarios/gasEstimation.scenarios'
import { sanityScenarios } from '../../../core/tests/integration/scenarios/sanity.scenarios'
import { batchInfoScenarios } from '../../../core/tests/integration/scenarios/batchInfo.scenarios'
import { customFeeTokenScenarios } from '../../../core/tests/integration/scenarios/customFeeToken.scenarios'
import { retryableDataScenarios } from '../../../core/tests/integration/scenarios/retryableData.scenarios'
import { sendChildMsgScenarios } from '../../../core/tests/integration/scenarios/sendChildMsg.scenarios'
import { l1l3Scenarios } from '../../../core/tests/integration/scenarios/l1l3.scenarios'

const config = loadTestConfig()
ethScenarios(ethers6Harness, config)
erc20Scenarios(ethers6Harness, config)
customErc20Scenarios(ethers6Harness, config)
wethScenarios(ethers6Harness, config)
gasEstimationScenarios(ethers6Harness, config)
sanityScenarios(ethers6Harness, config)
batchInfoScenarios(ethers6Harness, config)
customFeeTokenScenarios(ethers6Harness, config)
retryableDataScenarios(ethers6Harness, config)
sendChildMsgScenarios(ethers6Harness, config)
l1l3Scenarios(ethers6Harness, config)
