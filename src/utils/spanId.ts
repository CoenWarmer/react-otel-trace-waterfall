/**
 * Deterministic 16-char hex span ID derived from a stable string key.
 * The same key always produces the same ID, so React keys and waterfall
 * selection survive re-renders. Intended for callers that synthesise spans
 * from application state rather than receiving real OTel data.
 */
export function makeSpanId(key: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = (Math.imul(h1, 33) ^ c) >>> 0;
    h2 = (Math.imul(h2, 31) ^ c) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

/**
 * Deterministic 32-char hex trace ID derived from a stable string key.
 * See makeSpanId for usage notes.
 */
export function makeTraceId(key: string): string {
  return makeSpanId(key) + makeSpanId('\x00' + key);
}
