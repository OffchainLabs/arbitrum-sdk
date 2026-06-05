import { ReverseTracingReplayFixture } from './fixtureHarness'
import { loadReverseTracingFixture } from './fixtureHarness'

export const cloneFixture = <T>(fixture: T): T =>
  JSON.parse(JSON.stringify(fixture)) as T

export const loadFixture = (fileName: string) =>
  cloneFixture(loadReverseTracingFixture(fileName))

export const getExpectedHash = (
  fixture: ReverseTracingReplayFixture,
  key: string
) => {
  const hash = fixture.expected[key]
  if (!hash || typeof hash !== 'string') {
    throw new Error(`Fixture ${fixture.id} is missing expected.${key}`)
  }
  return hash
}

export const getChildTx = (
  fixture: ReverseTracingReplayFixture,
  txHash: string
) => {
  const tx = fixture.childTxByHash?.[txHash.toLowerCase()]
  if (!tx) throw new Error(`Missing child tx fixture for ${txHash}`)
  return tx
}

export const getParentTx = (
  fixture: ReverseTracingReplayFixture,
  txHash: string
) => {
  const tx = fixture.parentTxByHash?.[txHash.toLowerCase()]
  if (!tx) throw new Error(`Missing parent tx fixture for ${txHash}`)
  return tx
}
