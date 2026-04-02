/**
 * Pure functions for parsing events from child chain transaction receipts.
 *
 * Re-exports the relevant parsing functions from events/parsing.ts
 * for convenience when working with child chain receipts.
 */

// Re-export from events/parsing — these already exist from Phase 4
export { getChildToParentEvents, getRedeemScheduledEvents } from '../events/parsing'
