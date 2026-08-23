import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TraceWaterfall } from './TraceWaterfall';
import type { OtelSpan } from '../types';
import { simpleTrace, errorTrace, deepTrace, wideTrace, largeTrace } from '../fixtures/traces';
import { darkTheme } from '../theme';

const meta: Meta<typeof TraceWaterfall> = {
  title: 'Components/TraceWaterfall',
  component: TraceWaterfall,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    height: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof TraceWaterfall>;

export const Simple: Story = {
  args: { spans: simpleTrace, height: '200px' },
};

export const WithErrors: Story = {
  args: { spans: errorTrace, height: '200px' },
};

export const DeepNesting: Story = {
  args: { spans: deepTrace, height: '300px' },
};

export const WideFanOut: Story = {
  args: { spans: wideTrace, height: '400px' },
};

/** 1 000-span trace — use this story to verify smooth virtualized scrolling. */
export const LargeTrace: Story = {
  args: { spans: largeTrace, height: '600px' },
};

export const Empty: Story = {
  args: { spans: [] },
};

export const Dark: Story = {
  args: { spans: errorTrace, height: '300px', theme: darkTheme },
  parameters: { backgrounds: { default: 'dark' } },
};

// ── Live / streaming trace ────────────────────────────────────────────────────
// Simulates spans arriving over time: first the root, then children one by one.
// Verifies that zoom stays stable (following mode), the viewport doesn't jump
// as rows are inserted, and keyboard focus stays on the correct span.

const LIVE_TRACE_ID = 'live-trace-001';
const ROOT_START = 1_700_000_000_000_000_000;
const MS = 1_000_000; // 1 ms in nanoseconds

function buildLiveSpans(count: number): OtelSpan[] {
  const root: OtelSpan = {
    traceId: LIVE_TRACE_ID,
    spanId: 'root',
    name: 'POST /checkout',
    startTimeUnixNano: String(ROOT_START),
    endTimeUnixNano: String(ROOT_START + count * 80 * MS),
    kind: 'SERVER',
    status: { code: count >= 10 ? 'OK' : 'UNSET' },
    resource: { 'service.name': 'checkout-service' },
  };

  const children: OtelSpan[] = Array.from({ length: count - 1 }, (_, i) => ({
    traceId: LIVE_TRACE_ID,
    spanId: `child-${i}`,
    parentSpanId: 'root',
    name: ['validate cart', 'reserve stock', 'charge payment', 'send receipt', 'update loyalty',
      'notify warehouse', 'log audit', 'update search', 'invalidate cache', 'enqueue email'][i % 10],
    startTimeUnixNano: String(ROOT_START + (i + 1) * 80 * MS),
    endTimeUnixNano: String(ROOT_START + (i + 1) * 80 * MS + 60 * MS),
    kind: 'CLIENT',
    status: { code: 'OK' },
    resource: { 'service.name': ['payment-svc', 'stock-svc', 'notification-svc', 'audit-svc'][i % 4] },
  }));

  return [root, ...children];
}

function LiveTraceStory() {
  const [spans, setSpans] = useState<OtelSpan[]>(() => buildLiveSpans(1));
  const countRef = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      countRef.current = Math.min(countRef.current + 1, 11);
      setSpans(buildLiveSpans(countRef.current));
      if (countRef.current >= 11) clearInterval(id);
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <p style={{ fontFamily: 'system-ui', fontSize: 13, marginBottom: 8, color: '#718096' }}>
        Spans arrive every 800 ms. The axis should extend automatically while you have not
        interacted with zoom/pan. Once you zoom, a "Reset zoom" button appears to resume following.
      </p>
      <TraceWaterfall spans={spans} height="300px" />
    </div>
  );
}

export const LiveStreaming: Story = {
  render: () => <LiveTraceStory />,
};
