export type SpanKind =
  | 'UNSPECIFIED'
  | 'INTERNAL'
  | 'SERVER'
  | 'CLIENT'
  | 'PRODUCER'
  | 'CONSUMER';

export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export type AttributeValue = string | number | boolean;

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** Nanoseconds since Unix epoch as a decimal string (OTel int64 convention). */
  startTimeUnixNano: string;
  /** Nanoseconds since Unix epoch as a decimal string. */
  endTimeUnixNano: string;
  attributes?: Record<string, AttributeValue>;
  status?: SpanStatus;
  kind?: SpanKind;
  /** Flattened resource attributes, e.g. `{ 'service.name': 'api-gateway' }`. */
  resource?: Record<string, AttributeValue>;
}

export interface SpanNode extends OtelSpan {
  children: SpanNode[];
  depth: number;
}

export interface FlatRow {
  span: SpanNode;
  hasChildren: boolean;
  isExpanded: boolean;
}
