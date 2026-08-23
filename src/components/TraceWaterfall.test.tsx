import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TraceWaterfall } from './TraceWaterfall';
import type { OtelSpan } from '../types';
import type { SpanInspectProps, SpanComponentProps, ExpandComponentProps } from './TraceWaterfall';

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

    // After first click the span name also appears in the info bar, so use the row element
    const row = screen.getByRole('row', { name: /root span/i });
    fireEvent.click(row);
    fireEvent.click(row);

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

  // ── disableKeyboardControls ────────────────────────────────────────────────

  it('does not respond to keyboard when disableKeyboardControls=true', () => {
    render(<TraceWaterfall spans={spans} initialState="expanded" disableKeyboardControls />);
    const grid = screen.getByRole('treegrid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    // No focused row → no selection change; just assert no crash and no visible focus ring
    expect(screen.queryByRole('row', { selected: true })).not.toBeInTheDocument();
  });
});
