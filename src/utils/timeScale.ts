import { scaleLinear } from 'd3-scale';
import type { ScaleLinear } from 'd3-scale';
import type { OtelSpan } from '../types';

export type TimeScale = ScaleLinear<number, number>;

/** Compute the [start, end] nanosecond bounds of a set of spans. */
export function getTraceDomain(spans: OtelSpan[]): [number, number] | null {
  if (spans.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const s of spans) {
    const s0 = Number(s.startTimeUnixNano);
    const e0 = Number(s.endTimeUnixNano);
    if (s0 < start) start = s0;
    if (e0 > end) end = e0;
  }
  return isFinite(start) && start < end ? [start, end] : null;
}

/** Build a d3 linear scale mapping [domainStart, domainEnd] → [0, widthPx]. */
export function buildTimeScale(
  domain: [number, number],
  widthPx: number
): TimeScale | null {
  if (widthPx === 0 || domain[0] === domain[1]) return null;
  return scaleLinear().domain(domain).range([0, widthPx]);
}

/** Format a nanosecond delta as a human-readable duration string. */
export function formatNanoDuration(nanos: number): string {
  const ms = nanos / 1_000_000;
  if (ms < 1) return `${Math.round(nanos / 1_000)}µs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Convert a nanosecond Unix timestamp string to a Date. Millisecond precision. */
export function nanoToDate(nano: string): Date {
  return new Date(Number(nano) / 1_000_000);
}
