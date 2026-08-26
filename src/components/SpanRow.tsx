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

function spanBarColor(span: SpanNode, barErrorColor: string, barPalette: readonly string[]): string {
  if (span.status?.code === 'ERROR') return barErrorColor;
  return serviceColor(span.resource?.['service.name'] as string | undefined, barPalette);
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

/** Props passed to a custom span-name component. */
export interface SpanNameProps {
  row: FlatRow;
  span: SpanNode;
  isSelected: boolean;
}

/** Props passed to a custom span-bar component. */
export interface SpanBarProps {
  row: FlatRow;
  span: SpanNode;
  /** Left offset in px from the start of the time axis (the true bar position, not the hit area). */
  x: number;
  /** Bar width in px, already clamped to the minimum. */
  width: number;
  isSelected: boolean;
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
   * Replaces the default diamond marker for EVENT-kind spans (standalone rows and
   * folded inline markers on a parent row).
   * Rendered inside an absolutely-positioned, centred wrapper at the span's timestamp.
   * Receives `{ span, x, isSelected }`.
   */
  EventMarkerComponent?: React.ComponentType<EventComponentProps>;
  /**
   * Replaces the text rendered for the span's name in the label column.
   * The row's layout, truncation, and chevron are unaffected.
   * Receives `{ row, span, isSelected }`.
   *
   * Note: a component that renders an `inline-block` element is not truncated by the
   * parent's `text-overflow: ellipsis` — apply `max-width: 100%; overflow: hidden;
   * text-overflow: ellipsis` in the component itself.
   */
  SpanNameComponent?: React.ComponentType<SpanNameProps>;
  /**
   * Replaces the bar drawn in the timeline column.
   * Rendered inside a `barWidth × BAR_HEIGHT` container positioned at the bar's location;
   * the library owns click handling and `barHitPaddingPx` hit-area padding.
   * Receives `{ row, span, x, width, isSelected }` where `x` and `width` are the true
   * bar coordinates (not the surrounding hit area).
   */
  SpanBarComponent?: React.ComponentType<SpanBarProps>;
  onToggle: (spanId: string) => void;
  onSelect: (spanId: string) => void;
  onHover?: (spanId: string) => void;
  onHoverEnd?: () => void;
  /** Called with a folded event when the pointer enters its marker, null on leave. */
  onHoverEvent?: (event: SpanNode | null) => void;
}

function DefaultEventMarker({
  barColor,
  size,
  isSelected,
}: {
  barColor: string;
  size: number;
  isSelected: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: barColor,
        transform: 'rotate(45deg)',
        borderRadius: 2,
        opacity: isSelected ? 1 : 0.85,
        outline: isSelected ? `2px solid ${barColor}` : undefined,
        outlineOffset: 2,
      }}
    />
  );
}

export const SpanRow = forwardRef<HTMLDivElement, SpanRowProps>(function SpanRow(
  { row, scale, isSelected, isFocused, isNew = false, ExpandComponent, RowPrefixComponent, EventMarkerComponent, SpanNameComponent, SpanBarComponent, onToggle, onSelect, onHover, onHoverEnd, onHoverEvent },
  ref
) {
  const theme = useTheme();
  const { span, hasChildren, isExpanded } = row;
  const hitPad = theme.barHitPaddingPx;

  // Inject keyframes on first render (idempotent).
  ensureKeyframes();

  const isError = span.status?.code === 'ERROR';

  const startPx = scale(Number(span.startTimeUnixNano));
  const endPx = scale(Number(span.endTimeUnixNano));
  const barWidth = Math.max(MIN_BAR_WIDTH, endPx - startPx);
  const durationNs = Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano);

  const barColor = spanBarColor(span, theme.barErrorColor, theme.barPalette);

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
      onMouseEnter={onHover ? () => onHover(span.spanId) : undefined}
      onMouseLeave={onHoverEnd}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${theme.rowBorder}`,
        background: isSelected ? theme.rowSelectedBackground : undefined,
        outline: 'none',
        boxShadow: isFocused ? `inset 0 0 0 2px ${theme.rowFocusRing}` : undefined,
        ...newRowStyle,
      }}
    >
      {/* Optional prefix slot */}
      {RowPrefixComponent && (
        <RowPrefixComponent row={row} isSelected={isSelected} isNew={isNew} />
      )}

      {/* Label column — clicking here selects the span */}
      <div
        role="rowheader"
        onClick={() => onSelect(span.spanId)}
        style={{
          width: LABEL_WIDTH,
          flexShrink: 0,
          paddingLeft: span.depth * theme.rowIndentPx + theme.rowPaddingInline,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
          cursor: 'pointer',
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
            fontSize: theme.spanNameFontSize,
            fontWeight: isSelected ? 600 : undefined,
            color: isError ? theme.spanNameErrorColor : theme.spanNameColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {SpanNameComponent ? (
            <SpanNameComponent row={row} span={span} isSelected={isSelected} />
          ) : (
            span.name
          )}
        </span>
      </div>

      {/* Timeline column */}
      <div
        role="gridcell"
        style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}
      >
        {span.kind === 'EVENT' ? (
          // Event spans: fixed-size marker centred on the start timestamp; no bar.
          // Clicking the marker wrapper selects this event span.
          <div
            style={{
              position: 'absolute',
              left: startPx,
              top: 0,
              bottom: 0,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(span.spanId)}
          >
            {EventMarkerComponent ? (
              <EventMarkerComponent span={span} x={startPx} isSelected={isSelected} />
            ) : (
              <div title={span.name}>
                <DefaultEventMarker
                  barColor={theme.eventMarkerColor || barColor}
                  size={theme.eventMarkerSize}
                  isSelected={isSelected}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Start-time tick line */}
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
            {/*
             * Bar hit wrapper — extends the clickable area by `barHitPaddingPx` on every
             * side so narrow bars remain aimable. The visual bar (or SpanBarComponent) sits
             * inside an inner container positioned at the true bar coordinates.
             */}
            <div
              title={`${span.name}  ${(span.resource?.['service.name'] as string | undefined) ?? ''}  ${formatNanoDuration(durationNs)}`}
              onClick={() => onSelect(span.spanId)}
              style={{
                position: 'absolute',
                left: startPx - hitPad,
                top: `calc(50% - ${BAR_HEIGHT / 2 + hitPad}px)`,
                width: barWidth + hitPad * 2,
                height: BAR_HEIGHT + hitPad * 2,
                cursor: 'pointer',
              }}
            >
              {/* Inner container aligned to the true bar position */}
              <div
                style={{
                  position: 'absolute',
                  top: hitPad,
                  left: hitPad,
                  width: barWidth,
                  height: BAR_HEIGHT,
                }}
              >
                {SpanBarComponent ? (
                  <SpanBarComponent row={row} span={span} x={startPx} width={barWidth} isSelected={isSelected} />
                ) : (
                  <>
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
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
                          left: 4,
                          top: 0,
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
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
            {/* Folded inline event markers */}
            {(row.events ?? []).map((ev) => {
              const x = scale(Number(ev.startTimeUnixNano));
              const evColor = theme.eventMarkerColor || spanBarColor(ev, theme.barErrorColor, theme.barPalette);
              return (
                <div
                  key={ev.spanId}
                  title={ev.name}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onClick={(e) => { e.stopPropagation(); onSelect(ev.spanId); }}
                  onMouseEnter={() => onHoverEvent?.(ev)}
                  onMouseLeave={() => onHoverEvent?.(null)}
                >
                  {EventMarkerComponent ? (
                    <EventMarkerComponent span={ev} x={x} isSelected={false} />
                  ) : (
                    <DefaultEventMarker barColor={evColor} size={theme.eventMarkerSize} isSelected={false} />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
});
