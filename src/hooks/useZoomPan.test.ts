import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoomPan } from './useZoomPan';

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

  it('does not update domain when not following and trace grows', () => {
    let traceEnd = END;
    const { result, rerender } = renderHook(() => useZoomPan(START, traceEnd));

    act(() => result.current.stopFollowing());
    traceEnd = 2_000_000;
    rerender();

    expect(result.current.domain.end).toBe(END); // locked
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
