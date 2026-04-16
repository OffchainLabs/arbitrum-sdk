/**
 * Ethers v5 integration tests — runs shared scenarios through the ethers5 harness.
 */
import { ethers5Harness } from './harness'
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
ethScenarios(ethers5Harness, config)
erc20Scenarios(ethers5Harness, config)
customErc20Scenarios(ethers5Harness, config)
wethScenarios(ethers5Harness, config)
gasEstimationScenarios(ethers5Harness, config)
sanityScenarios(ethers5Harness, config)
batchInfoScenarios(ethers5Harness, config)
customFeeTokenScenarios(ethers5Harness, config)
retryableDataScenarios(ethers5Harness, config)
sendChildMsgScenarios(ethers5Harness, config)
l1l3Scenarios(ethers5Harness, config)
