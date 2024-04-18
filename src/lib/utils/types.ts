/**
 * Omit doesnt enforce that the seconds generic is a keyof the first
 * OmitTyped guards against the underlying type prop names
 * being refactored, and not being updated in the usage of OmitTyped
 */
export type OmitTyped<T, K extends keyof T> = Omit<T, K>

/**
 * Make the specified properties optional
 */
export type PartialPick<T, K extends keyof T> = OmitTyped<T, K> & Partial<T>

/**
 * Make the specified properties required
 */
export type RequiredPick<T, K extends keyof T> = Required<Pick<T, K>> & T

// https://twitter.com/mattpocockuk/status/1622730173446557697
export type Prettify<T> = {
  [K in keyof T]: T[K]
  // eslint-disable-next-line @typescript-eslint/ban-types
} & {}
