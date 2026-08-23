import '@testing-library/jest-dom';

// ResizeObserver is not available in jsdom. Provide a minimal implementation that
// immediately fires with a fixed width of 800px so useContainerWidth returns a
// non-zero value and the time-scale is computed in component tests.
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.callback = cb; }
  observe(_el: Element) {
    this.callback(
      [{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
