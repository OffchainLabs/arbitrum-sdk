/**
 * Viem integration tests — runs shared scenarios through the viem harness.
 */
import { viemHarness } from './harness'
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
ethScenarios(viemHarness, config)
erc20Scenarios(viemHarness, config)
customErc20Scenarios(viemHarness, config)
wethScenarios(viemHarness, config)
gasEstimationScenarios(viemHarness, config)
sanityScenarios(viemHarness, config)
batchInfoScenarios(viemHarness, config)
customFeeTokenScenarios(viemHarness, config)
retryableDataScenarios(viemHarness, config)
sendChildMsgScenarios(viemHarness, config)
l1l3Scenarios(viemHarness, config)
