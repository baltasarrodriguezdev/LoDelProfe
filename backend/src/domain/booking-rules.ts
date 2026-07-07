export type TimeRange = { start: Date; end: Date };

export const SUPPORTED_DURATIONS = [60, 90, 120] as const;

export function rangesOverlap(a: TimeRange, b: TimeRange) {
  return a.start < b.end && a.end > b.start;
}

export function hasBookingOverlap(candidate: TimeRange, bookings: TimeRange[]) {
  return bookings.some(booking => rangesOverlap(candidate, booking));
}

export function isSupportedDuration(minutes: number) {
  return SUPPORTED_DURATIONS.includes(minutes as (typeof SUPPORTED_DURATIONS)[number]);
}