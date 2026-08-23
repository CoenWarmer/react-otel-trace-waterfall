import type { SpanKind, SpanNode, SpanStatusCode } from '../types';
import { formatNanoDuration, nanoToDate } from '../utils/timeScale';
import { useTheme } from '../ThemeContext';

interface SpanDetailProps {
  span: SpanNode;
  onClose: () => void;
}

const KIND_COLORS: Record<SpanKind, { bg: string; text: string }> = {
  SERVER:      { bg: '#ebf8ff', text: '#2b6cb0' },
  CLIENT:      { bg: '#f0fff4', text: '#276749' },
  INTERNAL:    { bg: '#f7fafc', text: '#4a5568' },
  PRODUCER:    { bg: '#fffaf0', text: '#c05621' },
  CONSUMER:    { bg: '#faf5ff', text: '#6b46c1' },
  UNSPECIFIED: { bg: '#f7fafc', text: '#718096' },
  EVENT:       { bg: '#fffff0', text: '#975a16' },
};

const STATUS_COLORS: Record<SpanStatusCode, { bg: string; text: string; dot: string }> = {
  OK:    { bg: '#f0fff4', text: '#276749', dot: '#48bb78' },
  ERROR: { bg: '#fff5f5', text: '#c53030', dot: '#fc8181' },
  UNSET: { bg: '#f7fafc', text: '#718096', dot: '#cbd5e0' },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ background: bg, color: text, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.03em' }}>
      {label}
    </span>
  );
}

export function SpanDetail({ span, onClose }: SpanDetailProps) {
  const theme = useTheme();
  const status = span.status ?? { code: 'UNSET' as SpanStatusCode };
  const kind = span.kind ?? 'UNSPECIFIED';
  const serviceName = span.resource?.['service.name'] as string | undefined;

  const startDate = nanoToDate(span.startTimeUnixNano);
  const endDate = nanoToDate(span.endTimeUnixNano);
  const durationNs = Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano);

  const kindStyle = KIND_COLORS[kind];
  const statusStyle = STATUS_COLORS[status.code];
  const attributes = span.attributes ? Object.entries(span.attributes) : [];
  const resource = span.resource ? Object.entries(span.resource) : [];

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ borderTop: `1px solid ${theme.borderColor}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: theme.detailSectionHeadingColor, marginBottom: 8, textTransform: 'uppercase' }}>
          {title}
        </div>
        {children}
      </div>
    );
  }

  function KV({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0, width: 130, fontSize: 11, color: theme.detailKeyColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: theme.detailValueColor, wordBreak: 'break-all', fontFamily: 'monospace' }}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${theme.borderColor}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: theme.detailBackground }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.borderColor}`, display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.detailTitleColor, lineHeight: 1.4, wordBreak: 'break-all' }}>
          {span.name}
        </span>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: theme.detailKeyColor, fontSize: 16, lineHeight: 1, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflow: 'auto', padding: 12, flex: 1 }}>
        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyle.dot, flexShrink: 0 }} />
            <Badge label={status.code} bg={statusStyle.bg} text={statusStyle.text} />
          </div>
          <Badge label={kind} bg={kindStyle.bg} text={kindStyle.text} />
          {serviceName && <Badge label={serviceName} bg={theme.headerBackground} text={theme.headerText} />}
        </div>

        <KV label="Duration" value={formatNanoDuration(durationNs)} />
        <KV label="Start" value={startDate.toISOString().replace('T', ' ').replace('Z', ' UTC')} />
        <KV label="End" value={endDate.toISOString().replace('T', ' ').replace('Z', ' UTC')} />
        {status.message && <KV label="Status message" value={<span style={{ color: statusStyle.text }}>{status.message}</span>} />}

        <Section title="IDs">
          <KV label="Span ID" value={span.spanId} />
          <KV label="Trace ID" value={span.traceId} />
          {span.parentSpanId && <KV label="Parent span ID" value={span.parentSpanId} />}
        </Section>

        {attributes.length > 0 && (
          <Section title="Attributes">
            {attributes.map(([k, v]) => <KV key={k} label={k} value={String(v)} />)}
          </Section>
        )}

        {resource.length > 0 && (
          <Section title="Resource">
            {resource.map(([k, v]) => <KV key={k} label={k} value={String(v)} />)}
          </Section>
        )}
      </div>
    </div>
  );
}
