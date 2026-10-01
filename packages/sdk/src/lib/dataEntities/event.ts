import { TypedEvent, TypedEventFilter } from '../abi/common'
import { Contract } from 'ethers'
import { Provider, Log } from '@ethersproject/abstract-provider'
import { Interface } from 'ethers/lib/utils'

/**
 * The type of the event arguments.
 * Gets the second generic arg
 */
export type EventArgs<T> = T extends TypedEvent<infer _, infer TObj>
  ? TObj
  : never

/**
 * The event type of a filter
 * Gets the first generic arg
 */
export type EventFromFilter<TFilter> = TFilter extends TypedEventFilter<
  infer TEvent
>
  ? TEvent
  : never

/**
 * All filter keys for the provided contract
 */
type FilterName<TContract extends Contract> = keyof TContract['filters'] &
  string

/**
 * The event type of a given filter
 */
type EventType<
  TContract extends Contract,
  TFilterName extends keyof TContract['filters']
> = EventArgs<EventFromFilter<ReturnType<TContract['filters'][TFilterName]>>>

/**
 * Typechain contract factories have additional properties
 */
export type TypeChainContractFactory<TContract extends Contract> = {
  connect(address: string, provider: Provider): TContract
  createInterface(): Interface
}

/**
 * Parse a log that matches a given filter name.
 * @param contractFactory
 * @param log The log to parse
 * @param filterName
 * @param expectedAddress When provided, a log emitted by any other address is
 * treated as a non-match (returns null) even if its topic matches. Logs
 * pulled from a transaction receipt (as opposed to an address-scoped
 * `eth_getLogs` query) can include events emitted by *any* contract the
 * transaction touched, so a topic-only check lets any contract - malicious
 * or otherwise - forge a log that matches a well-known event signature.
 * @returns Null if filter name topic does not match log topic, or if
 * `expectedAddress` is given and does not match the log's address
 */
export const parseTypedLog = <
  TContract extends Contract,
  TFilterName extends FilterName<TContract>
>(
  contractFactory: TypeChainContractFactory<TContract>,
  log: Log,
  filterName: TFilterName,
  expectedAddress?: string
): EventType<TContract, TFilterName> | null => {
  const iFace = contractFactory.createInterface()
  const event = iFace.getEvent(filterName)
  const topic = iFace.getEventTopic(event)

  if (
    log.topics[0] === topic &&
    // Only skip the address check when the caller genuinely omitted the
    // argument. A falsy-but-provided value (e.g. an empty string from a
    // misconfigured network) must fail closed - rejecting every log - not
    // silently fall back to accepting logs from any address.
    (expectedAddress === undefined ||
      log.address.toLowerCase() === expectedAddress.toLowerCase())
  ) {
    return iFace.parseLog(log).args as EventType<TContract, TFilterName>
  } else return null
}

/**
 * Parses an array of logs.
 * Filters out any logs whose topic does not match provided the filter name topic.
 * @param contractFactory
 * @param logs The logs to parse
 * @param filterName
 * @param expectedAddress When provided, only logs emitted by this address are
 * parsed - see {@link parseTypedLog}
 * @returns
 */
export const parseTypedLogs = <
  TContract extends Contract,
  TFilterName extends FilterName<TContract>
>(
  contractFactory: TypeChainContractFactory<TContract>,
  logs: Log[],
  filterName: TFilterName,
  expectedAddress?: string
): EventType<TContract, TFilterName>[] => {
  return logs
    .map(l => parseTypedLog(contractFactory, l, filterName, expectedAddress))
    .filter((i): i is NonNullable<typeof i> => i !== null)
}
