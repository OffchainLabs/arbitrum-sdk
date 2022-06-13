export const wait = (ms: number): Promise<void> =>
  new Promise(res => setTimeout(res, ms))

export const isDefined = (val: unknown): boolean =>
  typeof val !== 'undefined' && val !== null
