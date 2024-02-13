import { isL2NetworkWithCustomFeeToken } from './custom-fee-token/customFeeTokenTestHelpers'
import {
  fundL1 as fundL1Ether,
  mineUntilStop,
  skipIfMainnet,
  wait,
} from '../testHelpers'
import { L2ToL1Message, L2ToL1MessageStatus } from '../../../src'

dotenv.config()

// only run when using a custom gas token chain
const describeWithCustomGasTokenPatch = isL2NetworkWithCustomFeeToken()
  ? describe
  : describe.skip
