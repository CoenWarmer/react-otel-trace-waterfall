import { useEffect, useRef, useState } from 'react';

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

/**
 * @param traceStart - Trace start time in nanoseconds.
 * @param traceEnd   - Trace end time in nanoseconds.
 * @param initialDomain - Optional domain to use as the initial view instead of the full trace.
 *                        When provided, `isFollowing` starts as false.
 */
export function useZoomPan(
  traceStart: number,
  traceEnd: number,
  initialDomain?: ZoomDomain,
): UseZoomPanResult {
  const [domain, setDomain] = useState<ZoomDomain>(
    initialDomain ?? { start: traceStart, end: traceEnd }
  );
  // Start in following mode only when no explicit initial domain was supplied.
  const [isFollowing, setIsFollowing] = useState(!initialDomain);

  // Mirror current domain into a ref so the effect below can read it without
  // needing it as a dependency (avoids firing on every zoom/pan interaction).
  const domainRef = useRef(domain);
  domainRef.current = domain;

  // While following, keep domain in sync as trace bounds grow (live traces).
  // When not following, auto-reset if the trace has shifted so far that the
  // current domain no longer overlaps at all (e.g. a completely new trace loaded).
  useEffect(() => {
    if (isFollowing) {
      setDomain({ start: traceStart, end: traceEnd });
    } else {
      const d = domainRef.current;
      if (d.end < traceStart || d.start > traceEnd) {
        setIsFollowing(true);
        setDomain({ start: traceStart, end: traceEnd });
      }
    }
  }, [traceStart, traceEnd, isFollowing]);

  const dragRef = useRef<{ clientX: number; domainSnapshot: ZoomDomain } | null>(null);

  function onWheel(cursorX: number, widthPx: number, deltaY: number) {
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
