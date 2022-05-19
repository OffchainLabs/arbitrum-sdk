import { TypedEvent } from '../abi/common'

/**
 * The type of the event arguments.
 */
export type EventArgs<T> = T extends TypedEvent<infer _, infer TObj>
  ? TObj
  : never
