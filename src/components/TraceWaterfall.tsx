import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { OtelSpan, SpanNode } from '../types';
import type { FlatRow } from '../types';
import type { TimeScale } from '../utils/timeScale';
import { buildSpanTree } from '../utils/buildSpanTree';
import { flattenTree } from '../utils/flattenTree';
import { getTraceDomain, buildTimeScale } from '../utils/timeScale';
import { useContainerWidth } from '../hooks/useContainerWidth';
import type { ZoomDomain } from '../hooks/useZoomPan';
import { useZoomPan } from '../hooks/useZoomPan';
import { SpanRow, LABEL_WIDTH, ROW_HEIGHT, BAR_HEIGHT } from './SpanRow';
import type { ExpandComponentProps } from './SpanRow';
import { TimeAxis } from './TimeAxis';
import { SpanDetail } from './SpanDetail';
import { ThemeContext, useTheme } from '../ThemeContext';
import { defaultTheme, type ThemeTokens } from '../theme';

// ── Public prop-interface types ──────────────────────────────────────────────

/** Props received by a custom zoom-reset control. */
export interface ZoomResetProps {
  onClick: () => void;
}

/** Props received by a custom span detail/inspect panel. */
export interface SpanInspectProps {
  span: SpanNode;
  onClose: () => void;
}

/** Props received by a custom span row component. */
export interface SpanComponentProps {
  row: FlatRow;
  scale: TimeScale;
  isSelected: boolean;
  isFocused: boolean;
  isNew: boolean;
  onToggle: (spanId: string) => void;
  onSelect: (spanId: string) => void;
}

export type { ExpandComponentProps };

export interface TraceWaterfallProps {
  spans: OtelSpan[];
  /** Height of the scrollable row area. Defaults to '400px'. */
  height?: number | string;
  /** Renders a skeleton loader instead of span rows. */
  loading?: boolean;
  /** Override individual design tokens. Merged on top of defaultTheme. */
  theme?: Partial<ThemeTokens>;

  // ── Zoom & pan ─────────────────────────────────────────────────────────────
  /** Enable wheel-to-zoom and drag-to-pan on the time axis. Default true. */
  allowZoom?: boolean;
  /**
   * Initial zoom factor. 1 = full trace view (default). 2 = 2× zoom in from the trace centre.
   * Acts as an initial value only — the user can zoom freely after mount.
   */
  zoomLevel?: number;
  /**
   * Replaces the built-in "Reset zoom" button shown when the user has zoomed/panned.
   * Receives `{ onClick }` which resets the zoom and re-enables following mode.
   */
  ZoomResetComponent?: React.ComponentType<ZoomResetProps>;
  /** Called whenever the zoom/pan is reset (by built-in button or ZoomResetComponent). */
  onZoomReset?: () => void;

  // ── Selection ──────────────────────────────────────────────────────────────
  /** Called whenever the selected span changes. Receives null when the selection is cleared. */
  onSelectSpan?: (span: SpanNode | null) => void;

  // ── Custom components ──────────────────────────────────────────────────────
  /**
   * Replaces the built-in SpanDetail side panel.
   * Receives `{ span, onClose }`.
   */
  SpanInspectComponent?: React.ComponentType<SpanInspectProps>;
  /**
   * Replaces SpanRow for every row in the list.
   * Rendered inside a focus-managing wrapper so a11y/keyboard nav keeps working.
   * Receives `{ row, scale, isSelected, isFocused, isNew, onToggle, onSelect }`.
   */
  SpanComponent?: React.ComponentType<SpanComponentProps>;
  /** Called when the span detail panel is closed. */
  onCloseSpan?: () => void;
  /** Replaces the built-in loading skeleton. */
  SkeletonComponent?: React.ComponentType;

  // ── Live mode ──────────────────────────────────────────────────────────────
  /**
   * When provided, controls whether the view auto-tracks the growing trace bounds ("live mode").
   * true  → domain follows trace end as new spans arrive.
   * false → domain is locked; user (or parent) controls it.
   * Omit to let the component manage this internally (default: true until first zoom/pan).
   */
  liveMode?: boolean;
  /** Called when live mode changes — use this to keep external state in sync. */
  onLiveModeChange?: (isLive: boolean) => void;

  // ── Keyboard ───────────────────────────────────────────────────────────────
  /** Disable arrow-key / Home / End keyboard navigation. Default false. */
  disableKeyboardControls?: boolean;

  // ── Tree expansion ─────────────────────────────────────────────────────────
  /**
   * Initial expansion state for all spans.
   * 'collapsed' (default) — only root spans are visible.
   * 'expanded' — all spans with children are expanded from the start.
   */
  initialState?: 'collapsed' | 'expanded';
  /**
   * Replaces the built-in ▸/▾ chevron inside each span row.
   * Only applied when SpanComponent is NOT provided (custom span rows own their own expand UI).
   * Receives `{ isExpanded, hasChildren, onToggle }`.
   */
  ExpandComponent?: React.ComponentType<ExpandComponentProps>;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildSpanMap(roots: SpanNode[]): Map<string, SpanNode> {
  const map = new Map<string, SpanNode>();
  function visit(nodes: SpanNode[]) {
    for (const node of nodes) { map.set(node.spanId, node); visit(node.children); }
  }
  visit(roots);
  return map;
}

function allParentIds(spans: OtelSpan[]): Set<string> {
  const ids = new Set<string>();
  for (const s of spans) {
    if (s.parentSpanId) ids.add(s.parentSpanId);
  }
  return ids;
}

function SkeletonRow({ i }: { i: number }) {
  const labelW = 30 + (i * 37 % 42);
  const barW = 12 + (i * 23 % 48);
  const barL = (i * 19 % 32);
  return (
    <div style={{ display: 'flex', height: ROW_HEIGHT, alignItems: 'center', borderBottom: '1px solid #f7fafc' }}>
      <div style={{ width: LABEL_WIDTH, flexShrink: 0, paddingLeft: 18 }}>
        <div style={{ width: `${labelW}%`, height: 9, background: '#edf2f7', borderRadius: 4 }} />
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: '100%' }}>
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          left: `${barL}%`, width: `${barW}%`,
          height: BAR_HEIGHT, background: '#edf2f7', borderRadius: 3,
        }} />
      </div>
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} i={i} />)}
    </>
  );
}

// ── Inner component (reads theme from context) ────────────────────────────────

function TraceWaterfallInner({
  spans,
  height = '400px',
  loading = false,
  allowZoom = true,
  zoomLevel,
  ZoomResetComponent,
  onZoomReset,
  onSelectSpan,
  SpanInspectComponent,
  SpanComponent,
  onCloseSpan,
  SkeletonComponent,
  liveMode,
  onLiveModeChange,
  disableKeyboardControls = false,
  initialState = 'collapsed',
  ExpandComponent,
}: TraceWaterfallProps) {
  const theme = useTheme();

  // ── Tree state ─────────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    initialState === 'expanded' ? allParentIds(spans) : new Set()
  );

  // When initialState="expanded", merge any newly-arriving parent span IDs into
  // expandedIds so that spans added after mount (e.g. live workflow phases) are
  // also auto-expanded. Only runs when initialState is "expanded".
  useEffect(() => {
    if (initialState !== 'expanded') return;
    setExpandedIds(prev => {
      const parentIds = allParentIds(spans);
      let changed = false;
      const next = new Set(prev);
      for (const id of parentIds) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [spans, initialState]);

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // FIX 3: Track focused row by spanId so focus survives mid-list insertions.
  const [focusedSpanId, setFocusedSpanId] = useState<string | null>(null);

  // Span IDs that arrived since the last rows update; cleared after the animation completes.
  const [newSpanIds, setNewSpanIds] = useState<ReadonlySet<string>>(new Set());
  const newSpanClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived data ───────────────────────────────────────────────────────────
  const roots = useMemo(() => buildSpanTree(spans), [spans]);
  const rows = useMemo(() => flattenTree(roots, expandedIds), [roots, expandedIds]);
  const spanMap = useMemo(() => buildSpanMap(roots), [roots]);
  const selectedSpan = selectedSpanId ? (spanMap.get(selectedSpanId) ?? null) : null;
  const traceDomain = useMemo(() => getTraceDomain(spans), [spans]);

  const focusedIndex = focusedSpanId !== null
    ? rows.findIndex(r => r.span.spanId === focusedSpanId)
    : -1;

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  // Compute an initial domain from zoomLevel once — only on the first render where
  // traceDomain is available. useZoomPan's useState reads it exactly once.
  const zoomInitialDomainRef = useRef<ZoomDomain | undefined>(undefined);
  if (
    zoomInitialDomainRef.current === undefined &&
    traceDomain &&
    zoomLevel !== undefined &&
    zoomLevel > 1
  ) {
    const [s, e] = traceDomain;
    const center = (s + e) / 2;
    const half = (e - s) / (2 * zoomLevel);
    zoomInitialDomainRef.current = { start: center - half, end: center + half };
  }

  const [timelineRef, timelineWidth] = useContainerWidth();

  // FIX 1: isFollowing mode — domain auto-extends while user hasn't interacted.
  const { domain, isFollowing, follow, stopFollowing, onWheel, startDrag, moveDrag, endDrag } = useZoomPan(
    traceDomain?.[0] ?? 0,
    traceDomain?.[1] ?? 1,
    zoomInitialDomainRef.current,
  );

  // Controlled liveMode: when the prop is provided, sync internal following state to it.
  useEffect(() => {
    if (liveMode === undefined) return;
    if (liveMode) follow();
    else stopFollowing();
  }, [liveMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent whenever following state changes (user zoom locks it; reset re-enables it).
  const prevIsFollowingRef = useRef(isFollowing);
  useEffect(() => {
    if (prevIsFollowingRef.current === isFollowing) return;
    prevIsFollowingRef.current = isFollowing;
    onLiveModeChange?.(isFollowing);
  }, [isFollowing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective live mode — prop wins when provided, otherwise internal state.
  const effectiveLiveMode = liveMode !== undefined ? liveMode : isFollowing;

  const scale = useMemo(
    () => traceDomain && timelineWidth > 0 ? buildTimeScale([domain.start, domain.end], timelineWidth) : null,
    [domain, timelineWidth, traceDomain]
  );

  // Attach non-passive wheel listener so preventDefault() suppresses page scroll.
  // Re-attached when allowZoom changes so we only register when zoom is enabled.
  const onWheelRef = useRef(onWheel);
  onWheelRef.current = onWheel;
  const allowZoomRef = useRef(allowZoom);
  allowZoomRef.current = allowZoom;
  useEffect(() => {
    const el = timelineRef.current;
    if (!el || !allowZoom) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      onWheelRef.current(e.clientX - rect.left, rect.width, e.deltaY);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [allowZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ prevCount: number; toggleIndex: number; startIndex: number } | null>(null);
  const pendingFocusRef = useRef<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLElement>());

  // FIX 2: Track the previous rows snapshot for external-insertion scroll compensation.
  const prevRowsRef = useRef<typeof rows>([]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Restore scroll position + detect new spans for animation.
  useLayoutEffect(() => {
    const prevRows = prevRowsRef.current;
    prevRowsRef.current = rows;

    // ── Scroll compensation ────────────────────────────────────────────────
    if (scrollRef.current) {
      if (anchorRef.current) {
        const { prevCount, toggleIndex, startIndex } = anchorRef.current;
        anchorRef.current = null;
        const delta = rows.length - prevCount;
        if (delta !== 0 && toggleIndex < startIndex) {
          scrollRef.current.scrollTop += delta * ROW_HEIGHT;
        }
      } else if (rows.length !== prevRows.length) {
        const startIndex = virtualizer.range?.startIndex ?? 0;
        if (startIndex > 0 && prevRows.length > 0) {
          const anchorSpanId = prevRows[startIndex]?.span.spanId;
          if (anchorSpanId) {
            const newIndex = rows.findIndex(r => r.span.spanId === anchorSpanId);
            if (newIndex >= 0 && newIndex !== startIndex) {
              scrollRef.current.scrollTop += (newIndex - startIndex) * ROW_HEIGHT;
            }
          }
        }
      }
    }

    // ── New-row animation ──────────────────────────────────────────────────
    if (prevRows.length > 0 && rows.length !== prevRows.length) {
      const prevIds = new Set(prevRows.map(r => r.span.spanId));
      const added = rows.filter(r => !prevIds.has(r.span.spanId)).map(r => r.span.spanId);
      if (added.length > 0) {
        setNewSpanIds(prev => {
          const next = new Set(prev);
          added.forEach(id => next.add(id));
          return next;
        });
        if (newSpanClearRef.current) clearTimeout(newSpanClearRef.current);
        newSpanClearRef.current = setTimeout(() => {
          setNewSpanIds(new Set());
          newSpanClearRef.current = null;
        }, 1000);
      }
    }
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus management: no-ops when nothing is pending; retries each render until the
  // virtualizer has mounted the target row into the DOM.
  useLayoutEffect(() => {
    if (pendingFocusRef.current === null) return;
    const el = rowRefs.current.get(pendingFocusRef.current);
    if (el) { el.focus({ preventScroll: true }); pendingFocusRef.current = null; }
  });

  // Notify parent when selection changes.
  useEffect(() => {
    onSelectSpan?.(selectedSpanId ? (spanMap.get(selectedSpanId) ?? null) : null);
  }, [selectedSpanId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggle(spanId: string) {
    anchorRef.current = {
      prevCount: rows.length,
      toggleIndex: rows.findIndex((r) => r.span.spanId === spanId),
      startIndex: virtualizer.range?.startIndex ?? 0,
    };
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(spanId) ? next.delete(spanId) : next.add(spanId);
      return next;
    });
  }

  function select(spanId: string) {
    setFocusedSpanId(spanId);
    setSelectedSpanId((prev) => (prev === spanId ? null : spanId));
  }

  function focusRow(index: number) {
    const spanId = rows[index]?.span.spanId ?? null;
    setFocusedSpanId(spanId);
    pendingFocusRef.current = index;
    virtualizer.scrollToIndex(index, { align: 'auto' });
  }

  function handleCloseSpan() {
    setSelectedSpanId(null);
    onCloseSpan?.();
  }

  function handleZoomReset() {
    follow();
    onZoomReset?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disableKeyboardControls || rows.length === 0) return;
    const idx = focusedIndex;
    const row = idx >= 0 ? rows[idx] : null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(Math.min(rows.length - 1, idx < 0 ? 0 : idx + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(Math.max(0, idx < 0 ? rows.length - 1 : idx - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!row) break;
        if (row.hasChildren && !row.isExpanded) toggle(row.span.spanId);
        else if (row.hasChildren && row.isExpanded) focusRow(idx + 1);
        break;
      case 'ArrowLeft': {
        e.preventDefault();
        if (!row) break;
        if (row.hasChildren && row.isExpanded) { toggle(row.span.spanId); break; }
        if (row.span.depth > 0) {
          let parentIdx = -1;
          for (let i = idx - 1; i >= 0; i--) {
            if (rows[i].span.depth === row.span.depth - 1) { parentIdx = i; break; }
          }
          if (parentIdx >= 0) focusRow(parentIdx);
        }
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (row) select(row.span.spanId);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(0);
        break;
      case 'End':
        e.preventDefault();
        focusRow(rows.length - 1);
        break;
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const containerStyle = {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    border: `1px solid ${theme.borderColor}`,
    borderRadius: theme.borderRadius,
    overflow: 'hidden',
  } as const;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    const Skeleton = SkeletonComponent ?? DefaultSkeleton;
    return (
      <div style={{ ...containerStyle, display: 'block' }}>
        <div style={{ padding: '4px 10px', background: theme.headerBackground, borderBottom: `1px solid ${theme.borderColor}`, fontSize: 11, color: theme.headerText }}>
          Loading…
        </div>
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderColor}` }}>
          <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
          <div style={{ flex: 1, height: 24 }} />
        </div>
        <Skeleton />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (spans.length === 0) {
    return (
      <div style={{ ...containerStyle, padding: 16, color: theme.headerText }}>
        No spans to display.
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  const InspectPanel = SpanInspectComponent ?? SpanDetail;

  return (
    <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column' }}>
      {/* Info bar */}
      <div
        style={{
          padding: '4px 10px',
          fontSize: 11,
          color: theme.headerText,
          borderBottom: `1px solid ${theme.borderColor}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: theme.headerBackground,
        }}
      >
        <span>{spans.length} spans</span>
        <span>·</span>
        <span>{rows.length} visible</span>
        {selectedSpan && (<><span>·</span><span style={{ color: theme.rowFocusRing }}>{selectedSpan.name}</span></>)}
        {allowZoom && (
          ZoomResetComponent
            ? <ZoomResetComponent onClick={handleZoomReset} />
            : (
              <button
                onClick={handleZoomReset}
                title="Fit the full trace into the timeline"
                style={{
                  marginLeft: 'auto',
                  background: effectiveLiveMode ? 'none' : theme.rowFocusRing,
                  border: `1px solid ${effectiveLiveMode ? theme.borderColor : theme.rowFocusRing}`,
                  borderRadius: 4,
                  padding: '1px 7px',
                  fontSize: 11,
                  color: effectiveLiveMode ? theme.spanNameColor : '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                Fit
              </button>
            )
        )}
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Waterfall column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Time axis header — wheel + drag to zoom/pan */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderColor}`, flexShrink: 0 }}>
            <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
            <div
              ref={timelineRef}
              style={{
                flex: 1,
                overflow: 'hidden',
                cursor: allowZoom ? (isDragging ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
              }}
              onPointerDown={(e) => {
                if (!allowZoom || e.button !== 0) return;
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                setIsDragging(true);
                startDrag(e.clientX);
              }}
              onPointerMove={(e) => { if (allowZoom && isDragging) moveDrag(e.clientX, timelineWidth); }}
              onPointerUp={() => { setIsDragging(false); endDrag(); }}
              onPointerCancel={() => { setIsDragging(false); endDrag(); }}
            >
              {scale && <TimeAxis scale={scale} />}
            </div>
          </div>

          {/* Virtualized rows — treegrid */}
          <div
            ref={scrollRef}
            role="treegrid"
            aria-label="Trace spans"
            aria-rowcount={rows.length}
            tabIndex={disableKeyboardControls ? -1 : (focusedSpanId === null ? 0 : -1)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              if (!disableKeyboardControls && e.target === e.currentTarget && focusedSpanId === null && rows.length > 0) {
                focusRow(0);
              }
            }}
            style={{ height, overflow: 'auto', position: 'relative', outline: 'none' }}
          >
            <div role="presentation" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = rows[virtualItem.index];
                const isSelected = row.span.spanId === selectedSpanId;
                const isFocused = virtualItem.index === focusedIndex;
                const isNew = newSpanIds.has(row.span.spanId);

                const refCallback = (el: HTMLElement | null) => {
                  if (el) rowRefs.current.set(virtualItem.index, el);
                  else rowRefs.current.delete(virtualItem.index);
                };

                return (
                  <div
                    key={row.span.spanId}
                    role="presentation"
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      height: virtualItem.size,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {scale ? (
                      SpanComponent ? (
                        // Custom span row — wrapped so focus/a11y stays under our control.
                        // onClick on the wrapper ensures selection works even if the custom
                        // component doesn't call onSelect itself.
                        <div
                          ref={refCallback}
                          role="row"
                          aria-level={row.span.depth + 1}
                          aria-expanded={row.hasChildren ? row.isExpanded : undefined}
                          aria-selected={isSelected}
                          tabIndex={isFocused ? 0 : -1}
                          onClick={() => select(row.span.spanId)}
                          style={{ height: '100%', outline: 'none' }}
                        >
                          <SpanComponent
                            row={row}
                            scale={scale}
                            isSelected={isSelected}
                            isFocused={isFocused}
                            isNew={isNew}
                            onToggle={toggle}
                            onSelect={select}
                          />
                        </div>
                      ) : (
                        <SpanRow
                          ref={refCallback}
                          row={row}
                          scale={scale}
                          isSelected={isSelected}
                          isFocused={isFocused}
                          isNew={isNew}
                          ExpandComponent={ExpandComponent}
                          onToggle={toggle}
                          onSelect={select}
                        />
                      )
                    ) : (
                      // No scale yet (container measuring) — bare accessible row
                      <div
                        role="row"
                        aria-level={row.span.depth + 1}
                        aria-selected={isSelected}
                        tabIndex={isFocused ? 0 : -1}
                        ref={refCallback}
                        onClick={() => select(row.span.spanId)}
                        style={{
                          display: 'flex', alignItems: 'center', height: '100%',
                          paddingLeft: row.span.depth * theme.rowIndentPx + theme.rowPaddingInline,
                          fontSize: 12,
                          borderBottom: `1px solid ${theme.rowBorder}`,
                          cursor: 'pointer', outline: 'none',
                          boxShadow: isFocused ? `inset 0 0 0 2px ${theme.rowFocusRing}` : undefined,
                        }}
                      >
                        {row.span.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Inspect / detail panel */}
        {selectedSpan && (
          <InspectPanel span={selectedSpan} onClose={handleCloseSpan} />
        )}
      </div>
    </div>
  );
}

// ── Public wrapper (provides theme context) ───────────────────────────────────

export function TraceWaterfall({ theme: themeProp, ...rest }: TraceWaterfallProps) {
  const mergedTheme = useMemo(
    () => (themeProp ? { ...defaultTheme, ...themeProp } : defaultTheme),
    [themeProp]
  );
  return (
    <ThemeContext.Provider value={mergedTheme}>
      <TraceWaterfallInner {...rest} />
    </ThemeContext.Provider>
  );
}
