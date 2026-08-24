import { useEffect, useRef, useState } from 'react';

/** Cubic ease-out — fast start, smooth deceleration. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export interface ZoomDomain {
  start: number;
  end: number;
}

export interface UseZoomPanResult {
  domain: ZoomDomain;
  isZoomed: boolean;
  /**
   * True while the domain auto-tracks the trace bounds (initial state, or after follow()/reset()).
   * Becomes false the moment the user zooms or pans.
   */
  isFollowing: boolean;
  /** Re-enable auto-tracking and reset to full trace bounds. */
  follow: () => void;
  /** Disable auto-tracking without changing the current domain. */
  stopFollowing: () => void;
  /** Alias for follow() — resets domain and re-enables auto-tracking. */
  reset: () => void;
  /** Call from a non-passive wheel handler on the timeline element. */
  onWheel: (cursorX: number, widthPx: number, deltaY: number) => void;
  startDrag: (clientX: number) => void;
  moveDrag: (clientX: number, widthPx: number) => void;
  endDrag: () => void;
}

export interface UseZoomPanOptions {
  initialDomain?: ZoomDomain;
  /**
   * Duration in ms for the animated zoom when following mode receives new trace bounds.
   * Set to 0 to snap immediately. Default: 300.
   */
  transitionDuration?: number;
  /**
   * Easing function for the live-update animation. Receives and returns t ∈ [0, 1].
   * Default: easeOutCubic.
   */
  transitionEasing?: (t: number) => number;
}

/**
 * @param traceStart - Trace start time in nanoseconds.
 * @param traceEnd   - Trace end time in nanoseconds.
 * @param initialDomain - Optional domain to use as the initial view instead of the full trace.
 *                        When provided, `isFollowing` starts as false.
 * @deprecated Pass options as the third argument object instead.
 */
export function useZoomPan(traceStart: number, traceEnd: number, initialDomain?: ZoomDomain): UseZoomPanResult;
export function useZoomPan(traceStart: number, traceEnd: number, options?: UseZoomPanOptions): UseZoomPanResult;
export function useZoomPan(
  traceStart: number,
  traceEnd: number,
  thirdArg?: ZoomDomain | UseZoomPanOptions,
): UseZoomPanResult {
  // Accept either the legacy (initialDomain) positional form or the new options object.
  const options: UseZoomPanOptions = thirdArg && 'start' in thirdArg
    ? { initialDomain: thirdArg as ZoomDomain }
    : (thirdArg as UseZoomPanOptions | undefined) ?? {};
  const { initialDomain, transitionDuration = 300, transitionEasing = easeOutCubic } = options;
  const [domain, setDomain] = useState<ZoomDomain>(
    initialDomain ?? { start: traceStart, end: traceEnd }
  );
  // Start in following mode only when no explicit initial domain was supplied.
  const [isFollowing, setIsFollowing] = useState(!initialDomain);

  // Mirror current domain into a ref so the effect below can read it without
  // needing it as a dependency (avoids firing on every zoom/pan interaction).
  const domainRef = useRef(domain);
  domainRef.current = domain;

  // True when the user has explicitly set the viewport (wheel zoom or drag pan)
  // since the last follow() call. When false, we auto-follow if the trace grows
  // beyond the current domain — this handles the case where the domain was set
  // by an animation during an earlier empty-trace phase and the full trace then
  // arrives after the component switched to non-following mode.
  const userLockedRef = useRef(!!initialDomain);

  // rAF animation handle — cancelled on user interaction or when a new animation starts.
  const animFrameRef = useRef<number | null>(null);

  function cancelAnimation() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }

  function animateTo(from: ZoomDomain, to: ZoomDomain) {
    cancelAnimation();
    if (transitionDuration <= 0) {
      setDomain(to);
      return;
    }
    const startTime = performance.now();
    function step(now: number) {
      const rawT = Math.min((now - startTime) / transitionDuration, 1);
      const t = transitionEasing(rawT);
      setDomain({
        start: from.start + (to.start - from.start) * t,
        end:   from.end   + (to.end   - from.end)   * t,
      });
      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    }
    animFrameRef.current = requestAnimationFrame(step);
  }

  // While following, keep domain in sync as trace bounds grow (live traces).
  // When not following, auto-reset if:
  //   • the trace has shifted so the current domain no longer overlaps at all, OR
  //   • the user has never explicitly zoomed/panned and the trace has grown beyond
  //     the current domain end (handles the case where domain was set by an animation
  //     during an empty-trace phase and the real trace arrives later).
  useEffect(() => {
    if (isFollowing) {
      const target = { start: traceStart, end: traceEnd };
      const cur = domainRef.current;
      if (cur.start === target.start && cur.end === target.end) return;
      animateTo(cur, target);
    } else {
      const d = domainRef.current;
      if (
        d.end < traceStart ||
        d.start > traceEnd ||
        (!userLockedRef.current && traceEnd > d.end)
      ) {
        userLockedRef.current = false;
        setIsFollowing(true);
        setDomain({ start: traceStart, end: traceEnd });
      }
    }
  }, [traceStart, traceEnd, isFollowing]); // eslint-disable-line react-hooks/exhaustive-deps

  const dragRef = useRef<{ clientX: number; domainSnapshot: ZoomDomain } | null>(null);

  function onWheel(cursorX: number, widthPx: number, deltaY: number) {
    cancelAnimation();
    userLockedRef.current = true;
    setIsFollowing(false);
    const factor = deltaY > 0 ? 1.15 : 0.85;
    setDomain((prev) => {
      const span = prev.end - prev.start;
      const fraction = Math.max(0, Math.min(1, cursorX / widthPx));
      const pivot = prev.start + fraction * span;

      const newStart = pivot - (pivot - prev.start) * factor;
      const newEnd = pivot + (prev.end - pivot) * factor;

      // Enforce a minimum visible window of 100µs (100 000 ns) — prevent over-zoom
      if (newEnd - newStart < 100_000) return prev;

      return { start: newStart, end: newEnd };
    });
  }

  function startDrag(clientX: number) {
    cancelAnimation();
    userLockedRef.current = true;
    setIsFollowing(false);
    dragRef.current = { clientX, domainSnapshot: domain };
  }

  function moveDrag(clientX: number, widthPx: number) {
    if (!dragRef.current || widthPx === 0) return;
    const { clientX: startX, domainSnapshot } = dragRef.current;
    const deltaX = clientX - startX;
    const timePerPx = (domainSnapshot.end - domainSnapshot.start) / widthPx;
    const deltaTime = -deltaX * timePerPx;

    let newStart = domainSnapshot.start + deltaTime;
    let newEnd = domainSnapshot.end + deltaTime;

    // Clamp so we don't pan past the trace edges
    if (newStart < traceStart) { newEnd -= newStart - traceStart; newStart = traceStart; }
    if (newEnd > traceEnd) { newStart -= newEnd - traceEnd; newEnd = traceEnd; }

    setDomain({ start: newStart, end: newEnd });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function follow() {
    userLockedRef.current = false;
    setIsFollowing(true);
    // The useEffect above will sync domain to current traceStart/traceEnd once isFollowing is true
  }

  function stopFollowing() {
    setIsFollowing(false);
  }

  function reset() {
    follow();
  }

  const isZoomed = domain.start !== traceStart || domain.end !== traceEnd;

  return { domain, isZoomed, isFollowing, follow, stopFollowing, reset, onWheel, startDrag, moveDrag, endDrag };
}
