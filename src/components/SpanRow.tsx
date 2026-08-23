import { forwardRef } from 'react';
import type { FlatRow, SpanNode } from '../types';
import type { TimeScale } from '../utils/timeScale';
import { formatNanoDuration } from '../utils/timeScale';
import { useTheme } from '../ThemeContext';

// Injected once per document; the animation reads its highlight color from a CSS variable
// so each row can supply a different color without re-injecting the keyframes.
let _keyframesInjected = false;
function ensureKeyframes() {
  if (_keyframesInjected || typeof document === 'undefined') return;
  _keyframesInjected = true;
  const style = document.createElement('style');
  style.textContent =
    `@keyframes _otel-row-new{from{background-color:var(--_otel-nr,transparent)}to{background-color:transparent}}`;
  document.head.appendChild(style);
}

function serviceColor(serviceName: string | undefined, palette: readonly string[]): string {
  if (!serviceName) return palette[0];
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = (hash * 31 + serviceName.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export const ROW_HEIGHT = 32;
export const LABEL_WIDTH = 280;
export const INDENT_PX = 14;
export const BAR_HEIGHT = 14;
const MIN_BAR_WIDTH = 2;

/** Props passed to a custom expand/collapse control. */
export interface ExpandComponentProps {
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

/** Props passed to a component rendered at the leading edge of every row. */
export interface RowPrefixProps {
  row: FlatRow;
  isSelected: boolean;
  isNew: boolean;
}

/** Props passed to a custom event marker component rendered in the timeline column. */
export interface EventComponentProps {
  span: SpanNode;
  /** Left offset in pixels from the start of the time axis (centre of the marker). */
  x: number;
  isSelected: boolean;
}

export interface SpanRowProps {
  row: FlatRow;
  scale: TimeScale;
  isSelected: boolean;
  isFocused: boolean;
  /** When true, plays a brief background-highlight animation. */
  isNew?: boolean;
  /**
   * Replaces the built-in ▸/▾ chevron button with a custom component.
   * Receives `{ isExpanded, hasChildren, onToggle }`.
   */
  ExpandComponent?: React.ComponentType<ExpandComponentProps>;
  /**
   * Rendered at the leading edge of every row, before the label column.
   * Useful for status icons, action buttons, or per-row badges.
   * Receives `{ row, isSelected, isNew }`.
   */
  RowPrefixComponent?: React.ComponentType<RowPrefixProps>;
  /**
   * Replaces the default diamond marker for EVENT-kind spans.
   * Rendered inside an absolutely-positioned, centred wrapper at the span's timestamp.
   * Receives `{ span, x, isSelected }`.
   */
  EventMarkerComponent?: React.ComponentType<EventComponentProps>;
  onToggle: (spanId: string) => void;
  onSelect: (spanId: string) => void;
  onHover?: (spanId: string) => void;
  onHoverEnd?: () => void;
}

export const SpanRow = forwardRef<HTMLDivElement, SpanRowProps>(function SpanRow(
  { row, scale, isSelected, isFocused, isNew = false, ExpandComponent, RowPrefixComponent, EventMarkerComponent, onToggle, onSelect, onHover, onHoverEnd },
  ref
) {
  const theme = useTheme();
  const { span, hasChildren, isExpanded } = row;

  // Inject keyframes on first render (idempotent).
  ensureKeyframes();

  const isError = span.status?.code === 'ERROR';

  const startPx = scale(Number(span.startTimeUnixNano));
  const endPx = scale(Number(span.endTimeUnixNano));
  const barWidth = Math.max(MIN_BAR_WIDTH, endPx - startPx);
  const durationNs = Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano);

  const serviceName = span.resource?.['service.name'] as string | undefined;
  const barColor = isError ? theme.barErrorColor : serviceColor(serviceName, theme.barPalette);

  const newRowStyle =
    isNew && theme.newRowHighlightColor && theme.newRowHighlightColor !== 'transparent'
      ? ({
          animation: `_otel-row-new 0.9s ease-out forwards`,
          '--_otel-nr': theme.newRowHighlightColor,
        } as React.CSSProperties)
      : undefined;

  return (
    <div
      ref={ref}
      role="row"
      aria-level={span.depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onClick={() => onSelect(span.spanId)}
      onMouseEnter={onHover ? () => onHover(span.spanId) : undefined}
      onMouseLeave={onHoverEnd}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${theme.rowBorder}`,
        background: isSelected ? theme.rowSelectedBackground : undefined,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: isFocused ? `inset 0 0 0 2px ${theme.rowFocusRing}` : undefined,
        ...newRowStyle,
      }}
    >
      {/* Optional prefix slot */}
      {RowPrefixComponent && (
        <RowPrefixComponent row={row} isSelected={isSelected} isNew={isNew} />
      )}

      {/* Label column */}
      <div
        role="rowheader"
        style={{
          width: LABEL_WIDTH,
          flexShrink: 0,
          paddingLeft: span.depth * theme.rowIndentPx + theme.rowPaddingInline,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        {hasChildren ? (
          ExpandComponent ? (
            <ExpandComponent
              isExpanded={isExpanded}
              hasChildren={hasChildren}
              onToggle={() => onToggle(span.spanId)}
            />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(span.spanId); }}
              tabIndex={-1}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                width: 14,
                flexShrink: 0,
                color: theme.chevronColor,
                fontSize: 10,
              }}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span
          title={span.name}
          style={{
            fontSize: 12,
            fontWeight: isSelected ? 600 : undefined,
            color: isError ? theme.spanNameErrorColor : theme.spanNameColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {span.name}
        </span>
      </div>

      {/* Timeline column */}
      <div
        role="gridcell"
        style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}
      >
        {span.kind === 'EVENT' ? (
          // Event spans: fixed-size marker centred on the start timestamp; no bar.
          <div
            style={{
              position: 'absolute',
              left: startPx,
              top: 0,
              bottom: 0,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {EventMarkerComponent ? (
              <EventMarkerComponent span={span} x={startPx} isSelected={isSelected} />
            ) : (
              <div
                title={span.name}
                style={{
                  width: theme.eventMarkerSize,
                  height: theme.eventMarkerSize,
                  backgroundColor: theme.eventMarkerColor || barColor,
                  transform: 'rotate(45deg)',
                  borderRadius: 2,
                  opacity: isSelected ? 1 : 0.85,
                  outline: isSelected ? `2px solid ${theme.eventMarkerColor || barColor}` : undefined,
                  outlineOffset: 2,
                }}
              />
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                left: startPx,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: theme.rowBorder,
              }}
            />
            <div
              title={`${span.name}  ${serviceName ?? ''}  ${formatNanoDuration(durationNs)}`}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: startPx,
                width: barWidth,
                height: BAR_HEIGHT,
                backgroundColor: barColor,
                borderRadius: 3,
                opacity: isSelected ? 1 : isError ? 0.9 : 0.8,
                outline: isSelected ? `2px solid ${barColor}` : undefined,
                outlineOffset: 1,
              }}
            />
            {barWidth > 30 && (
              <div
                style={{
                  position: 'absolute',
                  left: startPx + 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {formatNanoDuration(durationNs)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
