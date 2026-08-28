import { scaleLinear } from 'd3-scale';
import type { TimeScale } from '../utils/timeScale';
import { useTheme } from '../ThemeContext';

type AxisUnit = 'ns' | 'µs' | 'ms' | 's' | 'min';

function pickUnit(spanNs: number): AxisUnit {
  if (spanNs < 1_000) return 'ns';
  if (spanNs < 1_000_000) return 'µs';
  if (spanNs < 1_000_000_000) return 'ms';
  if (spanNs < 60_000_000_000) return 's';
  return 'min';
}

function formatInUnit(ns: number, unit: AxisUnit): string {
  if (ns === 0) return '0';
  switch (unit) {
    case 'ns':  return `${Math.round(ns)}ns`;
    case 'µs':  return `${+(ns / 1_000).toPrecision(3)}µs`;
    case 'ms':  return `${+(ns / 1_000_000).toPrecision(3)}ms`;
    case 's':   return `${+(ns / 1_000_000_000).toPrecision(3)}s`;
    case 'min': return `${+(ns / 60_000_000_000).toPrecision(3)}min`;
  }
}

interface TimeAxisProps {
  scale: TimeScale;
  /** Absolute nanosecond timestamp of the trace start (used to anchor the "0" label). */
  traceStart: number;
}

export function TimeAxis({ scale, traceStart }: TimeAxisProps) {
  const theme = useTheme();
  const [domainStart, domainEnd] = scale.domain();
  const spanNs = domainEnd - domainStart;
  const unit = pickUnit(spanNs);

  // Position of the trace-start tick in pixels. Only render when it's inside the visible range.
  const x0 = scale(traceStart);
  const [, rangeEnd] = scale.range();
  const showZero = x0 >= 0 && x0 <= rangeEnd;

  // Generate ticks in elapsed-ns space relative to traceStart — not [0, spanNs].
  // This anchors ticks to absolute timestamps, so they scroll with the domain in
  // follow-end mode instead of staying fixed when the viewport width is constant.
  // Using (t - traceStart) keeps values well within MAX_SAFE_INTEGER while
  // still avoiding precision issues with raw Unix nanosecond timestamps.
  const relDomainStart = domainStart - traceStart;
  const relDomainEnd = domainEnd - traceStart;
  const relDomainScale = scaleLinear().domain([relDomainStart, relDomainEnd]).range([0, rangeEnd]);
  const ticks = relDomainScale.ticks(6).filter(
    (dt) => !showZero || Math.abs(relDomainScale(dt) - x0) > 30
  );

  return (
    <div
      style={{
        position: 'relative',
        height: 24,
        borderBottom: `1px solid ${theme.borderColor}`,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* "0" anchored at the trace start — hidden when panned out of view */}
      {showZero && (
        <div style={{ position: 'absolute', left: x0, top: 0 }}>
          <div style={{ width: 1, height: 5, backgroundColor: theme.axisTickColor, margin: '0 auto' }} />
          <div style={{ fontSize: 10, color: theme.axisLabelColor, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
            0
          </div>
        </div>
      )}

      {ticks.map((dt) => {
        const x = relDomainScale(dt);
        const label = formatInUnit(dt, unit);
        return (
          <div
            key={dt}
            style={{ position: 'absolute', left: x, top: 0, transform: 'translateX(-50%)' }}
          >
            <div style={{ width: 1, height: 5, backgroundColor: theme.axisTickColor, margin: '0 auto' }} />
            <div style={{ fontSize: 10, color: theme.axisLabelColor, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
              {label}
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', right: 0, top: 0, transform: 'translateX(50%)' }}>
        <div style={{ width: 1, height: 5, backgroundColor: theme.axisTickColor, margin: '0 auto' }} />
        <div style={{ fontSize: 10, color: theme.axisLabelColor, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
          {formatInUnit(relDomainEnd, unit)}
        </div>
      </div>
    </div>
  );
}
