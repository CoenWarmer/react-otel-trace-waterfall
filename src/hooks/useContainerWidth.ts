import { useRef, useState } from 'react';

/**
 * Returns a ref-compatible object and the observed element's content width.
 *
 * Uses a getter/setter on `current` so the ResizeObserver is attached the
 * moment React assigns the DOM element — including cases where the component
 * rendered an early return (spans=[]) on mount and the timeline div only
 * appears on a subsequent render.
 *
 * The width is also measured synchronously at ref-attach time. Ref assignment
 * happens in the commit phase, so the resulting state update is flushed before
 * the browser paints — without it the first frame paints at width 0 (no axis,
 * no bars) and everything width-derived pops in one frame later, because
 * ResizeObserver notifications land in a separate, post-paint React task.
 */
export function useContainerWidth(): [React.RefObject<HTMLDivElement>, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  // Create the ref-like object once (stored in a ref so it survives re-renders).
  const refRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  if (!refRef.current) {
    const obj = {
      get current(): HTMLDivElement | null {
        return elRef.current;
      },
      set current(el: HTMLDivElement | null) {
        elRef.current = el;
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!el) return;
        // Measure now so the first painted frame already has a usable width.
        // Guarded on > 0 so environments without layout (jsdom) keep whatever
        // the ResizeObserver reports below.
        const measured = el.getBoundingClientRect().width;
        if (measured > 0) setWidth(measured);
        const ro = new ResizeObserver(([entry]) => {
          setWidth(entry.contentRect.width);
        });
        ro.observe(el);
        observerRef.current = ro;
      },
    };
    refRef.current = obj as unknown as React.RefObject<HTMLDivElement>;
  }

  return [refRef.current, width];
}
