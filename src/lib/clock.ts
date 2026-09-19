/**
 * One timestamp per request.
 *
 * Staleness ("this record is over a year old") is derived from the current time
 * in several places. Reading the clock separately in each component would let
 * two parts of the same page disagree, and reading it during render is exactly
 * the impurity React's rules warn about. So the clock is read once, here, and
 * the instant is passed down as data.
 */
export function requestNow(): number {
  return Date.now();
}

/** Whole months between an ISO date and the given instant. */
export function monthsSince(isoDate: string, now: number): number {
  return (now - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

/** Registry records older than this are flagged; recruiting status may have moved on. */
export const STALE_RECORD_MONTHS = 12;
