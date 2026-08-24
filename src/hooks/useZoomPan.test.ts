import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoomPan } from './useZoomPan';

// Make rAF fire synchronously with a timestamp far beyond any transition duration
// so animation callbacks always land at rawT = 1 (final frame) within the same act() pass.
beforeEach(() => {
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now() + 10_000);
    return 1;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const START = 0;
const END = 1_000_000; // 1 ms in nanoseconds

describe('useZoomPan', () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with domain equal to trace bounds', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    expect(result.current.domain).toEqual({ start: START, end: END });
  });

  it('starts in following mode', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.isZoomed).toBe(false);
  });

  it('uses initialDomain when provided and starts not following', () => {
    const initial = { start: 200_000, end: 800_000 };
    const { result } = renderHook(() => useZoomPan(START, END, initial));
    expect(result.current.domain).toEqual(initial);
    expect(result.current.isFollowing).toBe(false);
    expect(result.current.isZoomed).toBe(true);
  });

  // ── Following mode / live trace ────────────────────────────────────────────

  it('auto-extends domain end while following when trace grows', () => {
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(START, traceEnd));

    traceEnd = 2_000_000;
    rerender();

    expect(result.current.domain.end).toBe(2_000_000);
    expect(result.current.isFollowing).toBe(true);
  });

  it('does not update domain when user has explicitly zoomed and trace grows within overlap', () => {
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(START, traceEnd));

    // Simulate user zoom — this is the only interaction that should lock the viewport.
    act(() => result.current.onWheel(400, 800, -1));
    const lockedDomainEnd = result.current.domain.end;

    traceEnd = 2_000_000; // grows, but user is in explicit control
    rerender();

    expect(result.current.domain.end).toBe(lockedDomainEnd); // locked
    expect(result.current.isFollowing).toBe(false);
  });

  it('auto-resets when stopFollowing() is called programmatically (not by user) and trace grows', () => {
    // stopFollowing() is called by the controlled liveMode=false effect, not by the user.
    // In this case the viewport was never user-locked, so we should re-follow when the
    // trace grows — this is the core of the "empty-spans then real spans arrive" bug.
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(START, traceEnd));

    act(() => result.current.stopFollowing());
    expect(result.current.isFollowing).toBe(false);

    traceEnd = 2_000_000;
    rerender();

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain.end).toBe(2_000_000);
  });

  it('auto-resets to following when not following and trace moves entirely past the domain', () => {
    let traceStart = START;
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(traceStart, traceEnd));

    act(() => result.current.stopFollowing());

    // Trace jumps to a completely new range with no overlap
    traceStart = 10_000_000;
    traceEnd   = 20_000_000;
    rerender();

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain).toEqual({ start: 10_000_000, end: 20_000_000 });
  });

  it('auto-resets when trace shifts to the left of the current domain', () => {
    // Start fully zoomed in on the right side of the trace
    const initial = { start: 800_000, end: END };
    let traceStart = START;
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(traceStart, traceEnd, initial));
    // isFollowing is false due to initialDomain

    // Trace completely replaces itself with an earlier range that doesn't overlap
    traceStart = -5_000_000;
    traceEnd   = -1_000_000;
    rerender();

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain).toEqual({ start: -5_000_000, end: -1_000_000 });
  });

  it('resets to real trace bounds when first real spans arrive after empty-trace mount', () => {
    // Regression: component mounts with empty spans (traceStart=0, traceEnd=1 placeholder),
    // liveMode=false calls stopFollowing(), then real spans arrive with nanosecond timestamps.
    // The domain was stuck at {0,1} — markers for events at real timestamps rendered off-screen.
    let traceStart = 0;
    let traceEnd = 1;
    const { result, rerender } = renderHook(() => useZoomPan(traceStart, traceEnd));

    // liveMode=false calls stopFollowing() — no user interaction
    act(() => result.current.stopFollowing());
    expect(result.current.domain).toEqual({ start: 0, end: 1 });

    // First real spans arrive (nanosecond timestamps, much larger than the placeholder)
    const T = 1_000_000_000_000; // 10^12 — clearly larger than placeholder domain end of 1
    traceStart = T;
    traceEnd = T + 1_000_000; // 1 ms range
    rerender();

    // Domain must reset to cover the real trace, not stay stuck at {0, 1}
    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain).toEqual({ start: T, end: T + 1_000_000 });

    // Trace then expands when the full conversation arrives (assistant response)
    traceEnd = T + 5_000_000_000; // 5 seconds
    rerender();

    expect(result.current.domain.end).toBe(T + 5_000_000_000);
  });

  // ── Zoom ───────────────────────────────────────────────────────────────────

  it('zoom-in (negative deltaY) reduces the visible span', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    const before = result.current.domain.end - result.current.domain.start;

    act(() => result.current.onWheel(400, 800, -1));

    const after = result.current.domain.end - result.current.domain.start;
    expect(after).toBeLessThan(before);
  });

  it('zoom-out (positive deltaY) increases the visible span', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    const before = result.current.domain.end - result.current.domain.start;

    act(() => result.current.onWheel(400, 800, 1));

    const after = result.current.domain.end - result.current.domain.start;
    expect(after).toBeGreaterThan(before);
  });

  it('stops following when the user zooms', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    expect(result.current.isFollowing).toBe(true);

    act(() => result.current.onWheel(400, 800, -1));

    expect(result.current.isFollowing).toBe(false);
  });

  it('enforces a minimum visible window of 100 000 ns', () => {
    const { result } = renderHook(() => useZoomPan(START, END));

    // Zoom in aggressively — the window must never go below 100k ns
    for (let i = 0; i < 100; i++) {
      act(() => result.current.onWheel(0, 800, -1));
    }

    const span = result.current.domain.end - result.current.domain.start;
    expect(span).toBeGreaterThanOrEqual(100_000);
  });

  it('pivot stays under the cursor when zooming', () => {
    // Cursor at x=0 (left edge) → only the right side should shrink on zoom-in
    const { result } = renderHook(() => useZoomPan(START, END));

    act(() => result.current.onWheel(0, 800, -1));

    // Left edge should stay near START (pivot = start + 0 * span = start)
    expect(result.current.domain.start).toBeCloseTo(START, 0);
  });

  // ── follow / stopFollowing / reset ─────────────────────────────────────────

  it('follow() re-enables following and syncs domain to trace bounds', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    act(() => result.current.onWheel(400, 800, -1)); // zoom in → not following

    act(() => result.current.follow());

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain).toEqual({ start: START, end: END });
  });

  it('reset() is an alias for follow()', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    act(() => result.current.onWheel(400, 800, -1));

    act(() => result.current.reset());

    expect(result.current.isFollowing).toBe(true);
    expect(result.current.domain).toEqual({ start: START, end: END });
  });

  it('stopFollowing() locks the current domain without changing it', () => {
    const { result } = renderHook(() => useZoomPan(START, END));

    act(() => result.current.stopFollowing());

    expect(result.current.isFollowing).toBe(false);
    expect(result.current.domain).toEqual({ start: START, end: END });
  });

  // ── Drag / pan ─────────────────────────────────────────────────────────────

  it('stops following when the user starts a drag', () => {
    const { result } = renderHook(() => useZoomPan(START, END));

    act(() => result.current.startDrag(100));

    expect(result.current.isFollowing).toBe(false);
  });

  it('panning shifts the domain by the correct amount', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    // Domain is 0–1 000 000 ns across 800 px → 1 250 ns/px
    act(() => result.current.startDrag(0));
    act(() => result.current.moveDrag(800, 800)); // drag right 800px = shift left 1 000 000 ns
    act(() => result.current.endDrag());

    // Clamped: can't pan past trace start
    expect(result.current.domain.start).toBe(START);
    expect(result.current.domain.end).toBe(END);
  });

  // ── isZoomed ───────────────────────────────────────────────────────────────

  it('isZoomed is false when domain exactly matches trace bounds', () => {
    const { result } = renderHook(() => useZoomPan(START, END));
    expect(result.current.isZoomed).toBe(false);
  });

  it('isZoomed is true when domain differs from trace bounds', () => {
    const { result } = renderHook(() => useZoomPan(START, END, { start: 100_000, end: 900_000 }));
    expect(result.current.isZoomed).toBe(true);
  });
});
