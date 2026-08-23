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
}

export function TimeAxis({ scale }: TimeAxisProps) {
  const theme = useTheme();
  const [domainStart, domainEnd] = scale.domain();
  const spanNs = domainEnd - domainStart;
  const unit = pickUnit(spanNs);
  const ticks = scale.ticks(6);

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
      {ticks.map((tick) => {
        const x = scale(tick);
        const label = formatInUnit(tick - domainStart, unit);
        return (
          <div
            key={tick}
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
          {formatInUnit(spanNs, unit)}
        </div>
      </div>
    </div>
  );
}
