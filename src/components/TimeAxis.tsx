import type { TimeScale } from '../utils/timeScale';
import { formatNanoDuration } from '../utils/timeScale';
import { useTheme } from '../ThemeContext';

interface TimeAxisProps {
  scale: TimeScale;
}

export function TimeAxis({ scale }: TimeAxisProps) {
  const theme = useTheme();
  const [domainStart, domainEnd] = scale.domain();
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
        const label = tick === domainStart ? '0' : formatNanoDuration(tick - domainStart);
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
          {formatNanoDuration(domainEnd - domainStart)}
        </div>
      </div>
    </div>
  );
}
