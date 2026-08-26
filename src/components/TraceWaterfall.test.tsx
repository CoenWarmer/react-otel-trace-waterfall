import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TraceWaterfall } from './TraceWaterfall';
import type { OtelSpan } from '../types';
import type { SpanInspectProps, SpanComponentProps, ExpandComponentProps, RowPrefixProps, SpanTooltipProps } from './TraceWaterfall';

// ── Virtualizer mock ──────────────────────────────────────────────────────────
// Renders all rows regardless of container height so tests don't need a live DOM layout.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        start: i * opts.estimateSize(),
        size: opts.estimateSize(),
        key: String(i),
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    range: { startIndex: 0, endIndex: Math.max(0, opts.count - 1) },
    scrollToIndex: vi.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NS = (ms: number) => String(1_700_000_000_000_000_000 + ms * 1_000_000);

function mkSpan(overrides: Partial<OtelSpan> & Pick<OtelSpan, 'spanId' | 'name'>): OtelSpan {
  return {
    traceId: 'test-trace',
    startTimeUnixNano: NS(0),
    endTimeUnixNano: NS(100),
    resource: { 'service.name': 'svc' },
    ...overrides,
  };
}

// root → childA → grandchild
//      → childB
const rootSpan = mkSpan({ spanId: 'root', name: 'root span', startTimeUnixNano: NS(0), endTimeUnixNano: NS(200) });
const childA = mkSpan({ spanId: 'cA', parentSpanId: 'root', name: 'child A', startTimeUnixNano: NS(10), endTimeUnixNano: NS(90) });
const grandchild = mkSpan({ spanId: 'gc', parentSpanId: 'cA', name: 'grandchild', startTimeUnixNano: NS(20), endTimeUnixNano: NS(80) });
const childB = mkSpan({ spanId: 'cB', parentSpanId: 'root', name: 'child B', startTimeUnixNano: NS(95), endTimeUnixNano: NS(190) });
const spans = [rootSpan, childA, childB, grandchild];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TraceWaterfall', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Basic rendering ────────────────────────────────────────────────────────

  it('renders empty state when spans is empty', () => {
    render(<TraceWaterfall spans={[]} />);
    expect(screen.getByText('No spans to display.')).toBeInTheDocument();
  });

  it('renders span count in info bar', () => {
    render(<TraceWaterfall spans={spans} />);
    expect(screen.getByText(`${spans.length} spans`)).toBeInTheDocument();
  });

  it('renders built-in loading skeleton when loading=true', () => {
    render(<TraceWaterfall spans={[]} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  // ── SkeletonComponent ──────────────────────────────────────────────────────

  it('renders custom SkeletonComponent when loading=true', () => {
    const Custom = () => <div data-testid="my-skeleton">loading...</div>;
    render(<TraceWaterfall spans={[]} loading SkeletonComponent={Custom} />);
    expect(screen.getByTestId('my-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeInTheDocument(); // header still shows
  });

  // ── initialState ───────────────────────────────────────────────────────────

  it('shows only root span by default (initialState=collapsed)', () => {
    render(<TraceWaterfall spans={spans} />);
    expect(screen.getByText('root span')).toBeInTheDocument();
    expect(screen.queryByText('child A')).not.toBeInTheDocument();
    expect(screen.queryByText('child B')).not.toBeInTheDocument();
    expect(screen.getByText('1 visible')).toBeInTheDocument();
  });

  it('pre-expands all parents with initialState=expanded', () => {
    render(<TraceWaterfall spans={spans} initialState="expanded" />);
    // root + childA + childB visible (grandchild only visible if childA also expanded)
    // childA is a parent, so it should be expanded too → all 4 visible
    expect(screen.getByText('root span')).toBeInTheDocument();
    expect(screen.getByText('child A')).toBeInTheDocument();
    expect(screen.getByText('child B')).toBeInTheDocument();
    expect(screen.getByText('grandchild')).toBeInTheDocument();
    expect(screen.getByText(`${spans.length} visible`)).toBeInTheDocument();
  });

  // ── Expand / collapse ──────────────────────────────────────────────────────

  it('expands children when the expand button is clicked', () => {
    render(<TraceWaterfall spans={spans} />);
    expect(screen.queryByText('child A')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('child A')).toBeInTheDocument();
    expect(screen.getByText('child B')).toBeInTheDocument();
  });

  // ── ExpandComponent ────────────────────────────────────────────────────────

  it('renders ExpandComponent instead of the built-in chevron', () => {
    const Expand = ({ onToggle, isExpanded }: ExpandComponentProps) => (
      <button data-testid="custom-expand" onClick={onToggle}>
        {isExpanded ? 'collapse' : 'expand'}
      </button>
    );
    render(<TraceWaterfall spans={spans} ExpandComponent={Expand} />);
    expect(screen.getByTestId('custom-expand')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument();
  });

  it('ExpandComponent onToggle expands children', () => {
    const Expand = ({ onToggle }: ExpandComponentProps) => (
      <button data-testid="custom-expand" onClick={onToggle}>open</button>
    );
    render(<TraceWaterfall spans={spans} ExpandComponent={Expand} />);
    fireEvent.click(screen.getByTestId('custom-expand'));
    expect(screen.getByText('child A')).toBeInTheDocument();
  });

  // ── RowPrefixComponent ─────────────────────────────────────────────────────

  it('renders RowPrefixComponent before each visible row', () => {
    const Prefix = ({ row }: RowPrefixProps) => (
      <span data-testid="prefix">{row.span.name}</span>
    );
    render(<TraceWaterfall spans={spans} RowPrefixComponent={Prefix} />);
    // Only root is visible by default
    const prefixes = screen.getAllByTestId('prefix');
    expect(prefixes).toHaveLength(1);
    expect(prefixes[0]).toHaveTextContent('root span');
  });

  it('RowPrefixComponent receives isSelected=true when span is selected', () => {
    const Prefix = ({ isSelected }: RowPrefixProps) => (
      <span data-testid="prefix" data-selected={String(isSelected)} />
    );
    render(<TraceWaterfall spans={spans} RowPrefixComponent={Prefix} />);

    expect(screen.getByTestId('prefix')).toHaveAttribute('data-selected', 'false');
    fireEvent.click(screen.getByText('root span'));
    expect(screen.getByTestId('prefix')).toHaveAttribute('data-selected', 'true');
  });

  // ── onSelectSpan ───────────────────────────────────────────────────────────

  it('calls onSelectSpan with the span when a row is clicked', async () => {
    const onSelectSpan = vi.fn();
    render(<TraceWaterfall spans={spans} onSelectSpan={onSelectSpan} />);

    fireEvent.click(screen.getByText('root span'));

    await waitFor(() => {
      expect(onSelectSpan).toHaveBeenCalledWith(
        expect.objectContaining({ spanId: 'root', name: 'root span' })
      );
    });
  });

  it('calls onSelectSpan(null) when the same span is clicked again (deselect)', async () => {
    const onSelectSpan = vi.fn();
    render(<TraceWaterfall spans={spans} onSelectSpan={onSelectSpan} />);

    // After first click the span name also appears in the info bar, so target the rowheader
    // rather than getByText which would match multiple elements.
    const rowheader = screen.getByRole('rowheader');
    fireEvent.click(rowheader);
    fireEvent.click(rowheader);

    await waitFor(() => {
      expect(onSelectSpan).toHaveBeenLastCalledWith(null);
    });
  });

  // ── SpanInspectComponent ───────────────────────────────────────────────────

  it('renders SpanInspectComponent instead of built-in SpanDetail when span selected', () => {
    const Panel = ({ span }: SpanInspectProps) => (
      <div data-testid="custom-panel">Inspecting: {span.name}</div>
    );
    render(<TraceWaterfall spans={spans} SpanInspectComponent={Panel} />);

    fireEvent.click(screen.getByText('root span'));

    expect(screen.getByTestId('custom-panel')).toBeInTheDocument();
    expect(screen.getByText('Inspecting: root span')).toBeInTheDocument();
  });

  // ── onCloseSpan ────────────────────────────────────────────────────────────

  it('calls onCloseSpan when the detail panel is closed', () => {
    const onCloseSpan = vi.fn();
    const Panel = ({ onClose }: SpanInspectProps) => (
      <button data-testid="close-btn" onClick={onClose}>close</button>
    );
    render(
      <TraceWaterfall spans={spans} SpanInspectComponent={Panel} onCloseSpan={onCloseSpan} />
    );

    fireEvent.click(screen.getByText('root span'));
    fireEvent.click(screen.getByTestId('close-btn'));

    expect(onCloseSpan).toHaveBeenCalledTimes(1);
  });

  // ── SpanComponent ──────────────────────────────────────────────────────────

  it('renders SpanComponent for each visible row', () => {
    const Row = ({ row }: SpanComponentProps) => (
      <div data-testid="custom-row">{row.span.name}</div>
    );
    render(<TraceWaterfall spans={spans} SpanComponent={Row} />);
    // 1 root visible by default
    expect(screen.getAllByTestId('custom-row')).toHaveLength(1);
    expect(screen.getByText('root span')).toBeInTheDocument();
  });

  it('SpanComponent receives correct isSelected state', () => {
    const Row = ({ row, isSelected }: SpanComponentProps) => (
      <div data-selected={String(isSelected)}>{row.span.name}</div>
    );
    render(<TraceWaterfall spans={spans} SpanComponent={Row} />);

    expect(document.querySelector('[data-selected="false"]')).toBeInTheDocument();
    expect(document.querySelector('[data-selected="true"]')).not.toBeInTheDocument();

    // Click the wrapper row div (it has the onClick that triggers selection)
    fireEvent.click(screen.getByRole('row', { name: /root span/i }));

    expect(document.querySelector('[data-selected="true"]')).toBeInTheDocument();
  });

  // ── disableInspectPanel ────────────────────────────────────────────────────

  it('does not show the inspect panel when disableInspectPanel=true', () => {
    render(<TraceWaterfall spans={spans} disableInspectPanel />);
    fireEvent.click(screen.getByText('root span'));
    // SpanDetail renders the span name as a heading — should not appear
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('still fires onSelectSpan when disableInspectPanel=true', async () => {
    const onSelectSpan = vi.fn();
    render(<TraceWaterfall spans={spans} disableInspectPanel onSelectSpan={onSelectSpan} />);
    fireEvent.click(screen.getByText('root span'));
    await waitFor(() =>
      expect(onSelectSpan).toHaveBeenCalledWith(expect.objectContaining({ spanId: 'root' }))
    );
  });

  // ── TooltipComponent ───────────────────────────────────────────────────────

  it('renders TooltipComponent when a row is hovered', () => {
    const Tip = ({ span }: SpanTooltipProps) => (
      <div data-testid="tooltip">{span.name}</div>
    );
    render(<TraceWaterfall spans={spans} TooltipComponent={Tip} />);

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('row', { name: /root span/i }));

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toHaveTextContent('root span');
  });

  it('hides TooltipComponent when pointer leaves the row', () => {
    const Tip = ({ span }: SpanTooltipProps) => (
      <div data-testid="tooltip">{span.name}</div>
    );
    render(<TraceWaterfall spans={spans} TooltipComponent={Tip} />);

    const row = screen.getByRole('row', { name: /root span/i });
    fireEvent.mouseEnter(row);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(row);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  // ── onSpanHover ────────────────────────────────────────────────────────────

  it('calls onSpanHover with the span when a row is hovered', () => {
    const onSpanHover = vi.fn();
    render(<TraceWaterfall spans={spans} onSpanHover={onSpanHover} />);

    fireEvent.mouseEnter(screen.getByRole('row', { name: /root span/i }));

    expect(onSpanHover).toHaveBeenCalledWith(
      expect.objectContaining({ spanId: 'root', name: 'root span' })
    );
  });

  it('calls onSpanHover(null) when the pointer leaves a row', () => {
    const onSpanHover = vi.fn();
    render(<TraceWaterfall spans={spans} onSpanHover={onSpanHover} />);

    const row = screen.getByRole('row', { name: /root span/i });
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);

    expect(onSpanHover).toHaveBeenLastCalledWith(null);
  });

  // ── allowZoom ──────────────────────────────────────────────────────────────

  it('hides Fit button when allowZoom=false', () => {
    render(<TraceWaterfall spans={spans} allowZoom={false} />);
    expect(screen.queryByText('Fit')).not.toBeInTheDocument();
  });

  it('shows Fit button when allowZoom=true (default)', () => {
    render(<TraceWaterfall spans={spans} />);
    expect(screen.getByText('Fit')).toBeInTheDocument();
  });

  // ── FitButtonComponent ─────────────────────────────────────────────────────

  it('renders FitButtonComponent instead of built-in Fit button', () => {
    const FitBtn = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="custom-fit" onClick={onClick}>My fit</button>
    );
    render(<TraceWaterfall spans={spans} FitButtonComponent={FitBtn} />);
    expect(screen.getByTestId('custom-fit')).toBeInTheDocument();
    expect(screen.queryByText('Fit')).not.toBeInTheDocument();
  });

  it('FitButtonComponent onClick resets zoom', async () => {
    const onZoomReset = vi.fn();
    const FitBtn = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="custom-fit" onClick={onClick}>fit</button>
    );
    render(<TraceWaterfall spans={spans} FitButtonComponent={FitBtn} onZoomReset={onZoomReset} />);
    fireEvent.click(screen.getByTestId('custom-fit'));
    await waitFor(() => expect(onZoomReset).toHaveBeenCalledTimes(1));
  });

  // ── ZoomResetComponent (backward compat) ────────────────────────────────────

  it('renders ZoomResetComponent instead of built-in Fit button', () => {
    const Reset = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="custom-reset" onClick={onClick}>My reset</button>
    );
    render(<TraceWaterfall spans={spans} ZoomResetComponent={Reset} />);
    expect(screen.getByTestId('custom-reset')).toBeInTheDocument();
    expect(screen.queryByText('Fit')).not.toBeInTheDocument();
  });

  it('FitButtonComponent takes priority over ZoomResetComponent', () => {
    const FitBtn = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="fit-btn" onClick={onClick}>fit</button>
    );
    const Reset = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="reset-btn" onClick={onClick}>reset</button>
    );
    render(<TraceWaterfall spans={spans} FitButtonComponent={FitBtn} ZoomResetComponent={Reset} />);
    expect(screen.getByTestId('fit-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-btn')).not.toBeInTheDocument();
  });

  it('onZoomReset is called when the Fit button is clicked', async () => {
    const onZoomReset = vi.fn();
    render(<TraceWaterfall spans={spans} onZoomReset={onZoomReset} />);

    fireEvent.click(screen.getByText('Fit'));

    await waitFor(() => expect(onZoomReset).toHaveBeenCalledTimes(1));
  });

  // ── liveMode ───────────────────────────────────────────────────────────────

  it('Fit button is always visible regardless of liveMode', () => {
    const { rerender } = render(<TraceWaterfall spans={spans} liveMode={false} />);
    expect(screen.getByText('Fit')).toBeInTheDocument();

    rerender(<TraceWaterfall spans={spans} liveMode={true} />);
    expect(screen.getByText('Fit')).toBeInTheDocument();
  });

  it('onLiveModeChange is called when Fit button is clicked', async () => {
    const onLiveModeChange = vi.fn();
    render(
      <TraceWaterfall spans={spans} liveMode={false} onLiveModeChange={onLiveModeChange} />
    );

    fireEvent.click(screen.getByText('Fit'));

    await waitFor(() =>
      expect(onLiveModeChange).toHaveBeenCalledWith(true)
    );
  });

  // ── EVENT spans ───────────────────────────────────────────────────────────

  it('renders an event span row with no bar', () => {
    const eventSpan = mkSpan({ spanId: 'ev', name: 'my event', kind: 'EVENT' });
    render(<TraceWaterfall spans={[eventSpan]} />);
    expect(screen.getByText('my event')).toBeInTheDocument();
  });

  it('renders EventMarkerComponent for EVENT spans', () => {
    const eventSpan = mkSpan({ spanId: 'ev', name: 'my event', kind: 'EVENT' });
    const Marker = ({ x }: { x: number; span: unknown; isSelected: boolean }) => (
      <div data-testid="custom-marker" data-x={x} />
    );
    render(<TraceWaterfall spans={[eventSpan]} EventMarkerComponent={Marker} />);
    expect(screen.getByTestId('custom-marker')).toBeInTheDocument();
  });

  it('does not render EventMarkerComponent for non-EVENT spans', () => {
    const Marker = () => <div data-testid="custom-marker" />;
    render(<TraceWaterfall spans={spans} EventMarkerComponent={Marker} />);
    expect(screen.queryByTestId('custom-marker')).not.toBeInTheDocument();
  });

  // ── disableKeyboardControls ────────────────────────────────────────────────

  it('does not respond to keyboard when disableKeyboardControls=true', () => {
    render(<TraceWaterfall spans={spans} initialState="expanded" disableKeyboardControls />);
    const grid = screen.getByRole('treegrid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    // No focused row → no selection change; just assert no crash and no visible focus ring
    expect(screen.queryByRole('row', { selected: true })).not.toBeInTheDocument();
  });

  // ── foldEventsIntoParent ──────────────────────────────────────────────────

  const eventSpanA = mkSpan({
    spanId: 'evA', parentSpanId: 'root', name: 'event A',
    kind: 'EVENT', startTimeUnixNano: NS(50), endTimeUnixNano: NS(50),
  });
  const eventSpanB = mkSpan({
    spanId: 'evB', parentSpanId: 'root', name: 'event B',
    kind: 'EVENT', startTimeUnixNano: NS(80), endTimeUnixNano: NS(80),
  });
  const spansWithEvents = [rootSpan, eventSpanA, eventSpanB];

  it('foldEventsIntoParent renders fewer rows than without (events disappear from row list)', () => {
    // With root expanded, without folding: root + evA + evB = 3 rows.
    // With folding: root only = 1 row (events rendered inline).
    const { rerender } = render(
      <TraceWaterfall spans={spansWithEvents} initialState="expanded" />
    );
    const rowsBefore = screen.getAllByRole('row').length;

    rerender(<TraceWaterfall spans={spansWithEvents} initialState="expanded" foldEventsIntoParent />);
    const rowsAfter = screen.getAllByRole('row').length;

    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  it('clicking a folded event marker fires onSelectSpan with the event span', () => {
    const onSelectSpan = vi.fn();
    render(
      <TraceWaterfall
        spans={spansWithEvents}
        foldEventsIntoParent
        onSelectSpan={onSelectSpan}
        disableInspectPanel
      />
    );
    fireEvent.click(screen.getByTitle('event A'));
    expect(onSelectSpan).toHaveBeenCalledWith(expect.objectContaining({ spanId: 'evA' }));
  });

  it('EventMarkerComponent receives each folded event', () => {
    const Marker = vi.fn(({ span }: { span: { spanId: string }; x: number; isSelected: boolean }) => (
      <div data-testid={`marker-${span.spanId}`} />
    ));
    render(
      <TraceWaterfall
        spans={spansWithEvents}
        foldEventsIntoParent
        EventMarkerComponent={Marker as React.ComponentType<{ span: { spanId: string }; x: number; isSelected: boolean }>}
      />
    );
    expect(screen.getByTestId('marker-evA')).toBeInTheDocument();
    expect(screen.getByTestId('marker-evB')).toBeInTheDocument();
  });

  it('hovering a folded marker passes event to TooltipComponent; leaving the row clears it', () => {
    const Tooltip = vi.fn(({ span, event }: SpanTooltipProps) => (
      <div data-testid="tooltip">{event ? `event:${event.name}` : `span:${span.name}`}</div>
    ));
    render(
      <TraceWaterfall
        spans={spansWithEvents}
        foldEventsIntoParent
        TooltipComponent={Tooltip}
      />
    );

    // Hover the root row — tooltip shows the row's span
    fireEvent.mouseEnter(screen.getAllByRole('row')[0]);
    expect(screen.getByTestId('tooltip')).toHaveTextContent('span:root span');

    // Hover the folded event marker — tooltip now shows the event
    fireEvent.mouseEnter(screen.getByTitle('event A'));
    expect(screen.getByTestId('tooltip')).toHaveTextContent('event:event A');

    // Leave the row entirely — tooltip disappears
    fireEvent.mouseLeave(screen.getAllByRole('row')[0]);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });
});
