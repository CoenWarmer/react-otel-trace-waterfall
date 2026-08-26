export type SpanKind =
  | 'UNSPECIFIED'
  | 'INTERNAL'
  | 'SERVER'
  | 'CLIENT'
  | 'PRODUCER'
  | 'CONSUMER'
  | 'EVENT';

export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export type AttributeValue = string | number | boolean;

// Internal base shared by both OtelSpan variants and SpanNode.
// Not exported — consumers use OtelSpan or SpanNode.
interface OtelSpanCommon {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  attributes?: Record<string, AttributeValue>;
  status?: SpanStatus;
  kind?: SpanKind;
  /** Flattened resource attributes, e.g. `{ 'service.name': 'api-gateway' }`. */
  resource?: Record<string, AttributeValue>;
}

/**
 * An OpenTelemetry span as accepted by the library.
 * Timing can be supplied as nanosecond strings (OTel wire format) or as plain
 * millisecond numbers (convenience for synthesised / app-state spans).
 * When both are present the nano fields win.
 *
 * Note: millisecond precision is lossy for real sub-millisecond traces.
 * Use the ms fields only for spans you synthesise yourself.
 */
export type OtelSpan =
  | (OtelSpanCommon & {
      /** Nanoseconds since Unix epoch as a decimal string (OTel int64 convention). */
      startTimeUnixNano: string;
      /** Nanoseconds since Unix epoch as a decimal string. */
      endTimeUnixNano: string;
    })
  | (OtelSpanCommon & {
      /**
       * Milliseconds since Unix epoch. Convenience alternative to the *UnixNano
       * fields for synthesised spans. Stored at millisecond precision — do not use
       * for real traces that may contain sub-millisecond spans.
       */
      startTimeMs: number;
      /** Milliseconds since Unix epoch (see startTimeMs). */
      endTimeMs: number;
    });

/**
 * A span after ingestion: timing is always in nanosecond string form,
 * parent/child relationships are resolved, and depth is computed.
 */
export interface SpanNode extends OtelSpanCommon {
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  children: SpanNode[];
  depth: number;
}

export interface FlatRow {
  span: SpanNode;
  hasChildren: boolean;
  isExpanded: boolean;
  /**
   * EVENT-kind children folded onto this row, sorted by start time.
   * Populated only when the waterfall uses `foldEventsIntoParent`; otherwise an empty array.
   */
  events?: SpanNode[];
}
