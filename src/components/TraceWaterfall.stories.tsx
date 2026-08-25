import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TraceWaterfall } from "./TraceWaterfall";
import type { OtelSpan, SpanNode } from "../types";
import {
  simpleTrace,
  errorTrace,
  deepTrace,
  wideTrace,
  largeTrace,
} from "../fixtures/traces";
import { darkTheme } from "../theme";

const meta: Meta<typeof TraceWaterfall> = {
  title: "Components/TraceWaterfall",
  component: TraceWaterfall,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    height: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof TraceWaterfall>;

export const Simple: Story = {
  args: { spans: simpleTrace, height: "200px" },
};

export const WithErrors: Story = {
  args: { spans: errorTrace, height: "200px" },
};

export const DeepNesting: Story = {
  args: { spans: deepTrace, height: "300px" },
};

export const WideFanOut: Story = {
  args: { spans: wideTrace, height: "400px" },
};

/** 1 000-span trace — use this story to verify smooth virtualized scrolling. */
export const LargeTrace: Story = {
  args: { spans: largeTrace, height: "600px" },
};

export const Empty: Story = {
  args: { spans: [] },
};

export const Dark: Story = {
  args: { spans: errorTrace, height: "300px", theme: darkTheme },
  parameters: { backgrounds: { default: "dark" } },
};

export const ClickSpan: Story = {
  args: {
    onSelectSpan: () => {
      console.log("hi");
    },
    disableInspectPanel: true,
    spans: wideTrace,
    height: "400px",
  },
};

// ── Live / streaming trace ────────────────────────────────────────────────────
// Simulates spans arriving over time: first the root, then children one by one.
// Verifies that zoom stays stable (following mode), the viewport doesn't jump
// as rows are inserted, and keyboard focus stays on the correct span.

const LIVE_TRACE_ID = "live-trace-001";
const ROOT_START = 1_700_000_000_000_000_000;
const MS = 1_000_000; // 1 ms in nanoseconds

function buildLiveSpans(count: number): OtelSpan[] {
  const root: OtelSpan = {
    traceId: LIVE_TRACE_ID,
    spanId: "root",
    name: "POST /checkout",
    startTimeUnixNano: String(ROOT_START),
    endTimeUnixNano: String(ROOT_START + count * 80 * MS),
    kind: "SERVER",
    status: { code: count >= 10 ? "OK" : "UNSET" },
    resource: { "service.name": "checkout-service" },
  };

  const children: OtelSpan[] = Array.from({ length: count - 1 }, (_, i) => ({
    traceId: LIVE_TRACE_ID,
    spanId: `child-${i}`,
    parentSpanId: "root",
    name: [
      "validate cart",
      "reserve stock",
      "charge payment",
      "send receipt",
      "update loyalty",
      "notify warehouse",
      "log audit",
      "update search",
      "invalidate cache",
      "enqueue email",
    ][i % 10],
    startTimeUnixNano: String(ROOT_START + (i + 1) * 80 * MS),
    endTimeUnixNano: String(ROOT_START + (i + 1) * 80 * MS + 60 * MS),
    kind: "CLIENT",
    status: { code: "OK" },
    resource: {
      "service.name": [
        "payment-svc",
        "stock-svc",
        "notification-svc",
        "audit-svc",
      ][i % 4],
    },
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
      <p
        style={{
          fontFamily: "system-ui",
          fontSize: 13,
          marginBottom: 8,
          color: "#718096",
        }}
      >
        Spans arrive every 800 ms. The axis should extend automatically while
        you have not interacted with zoom/pan. Once you zoom, a "Reset zoom"
        button appears to resume following.
      </p>
      <TraceWaterfall spans={spans} height="300px" />
    </div>
  );
}

export const LiveStreaming: Story = {
  render: () => <LiveTraceStory />,
};

// ── Custom select callback (no inspect panel) ────────────────────────────────
// Demonstrates using onSelectSpan with disableInspectPanel.
// Click any span — the callback logs to the console and the selected span name
// is shown below the waterfall.

function SelectionCallbackStory() {
  const [selected, setSelected] = useState<SpanNode | null>(null);

  return (
    <div>
      <TraceWaterfall
        spans={simpleTrace}
        height="300px"
        disableInspectPanel
        onSelectSpan={(span) => {
          console.log('[onSelectSpan]', span);
          setSelected(span);
        }}
      />
      <p style={{ fontFamily: 'system-ui', fontSize: 13, marginTop: 8, color: '#718096' }}>
        {selected ? `Selected: ${selected.name} (${selected.spanId})` : 'Click a span to select it'}
      </p>
    </div>
  );
}

export const SelectionCallback: Story = {
  render: () => <SelectionCallbackStory />,
};

// ── Folded events ─────────────────────────────────────────────────────────────
// Demonstrates foldEventsIntoParent: EVENT-kind children render as inline
// diamond markers on their parent row instead of each getting a row of their own.

const FOLD_TRACE_ID = "fold-demo-trace";
const FOLD_START = 1_700_000_000_000_000_000;

const foldedEventTrace: OtelSpan[] = [
  {
    traceId: FOLD_TRACE_ID,
    spanId: "root",
    name: "POST /api/order",
    startTimeUnixNano: String(FOLD_START),
    endTimeUnixNano: String(FOLD_START + 400 * MS),
    kind: "SERVER",
    status: { code: "OK" },
    resource: { "service.name": "order-service" },
  },
  {
    traceId: FOLD_TRACE_ID,
    spanId: "db-query",
    parentSpanId: "root",
    name: "SELECT orders",
    startTimeUnixNano: String(FOLD_START + 20 * MS),
    endTimeUnixNano: String(FOLD_START + 80 * MS),
    kind: "CLIENT",
    status: { code: "OK" },
    resource: { "service.name": "postgres" },
  },
  {
    traceId: FOLD_TRACE_ID,
    spanId: "ev-validated",
    parentSpanId: "root",
    name: "order.validated",
    startTimeUnixNano: String(FOLD_START + 90 * MS),
    endTimeUnixNano: String(FOLD_START + 90 * MS),
    kind: "EVENT",
    resource: { "service.name": "order-service" },
  },
  {
    traceId: FOLD_TRACE_ID,
    spanId: "payment",
    parentSpanId: "root",
    name: "charge payment",
    startTimeUnixNano: String(FOLD_START + 100 * MS),
    endTimeUnixNano: String(FOLD_START + 220 * MS),
    kind: "CLIENT",
    status: { code: "OK" },
    resource: { "service.name": "payment-svc" },
  },
  {
    traceId: FOLD_TRACE_ID,
    spanId: "ev-charged",
    parentSpanId: "root",
    name: "payment.charged",
    startTimeUnixNano: String(FOLD_START + 225 * MS),
    endTimeUnixNano: String(FOLD_START + 225 * MS),
    kind: "EVENT",
    resource: { "service.name": "order-service" },
  },
  {
    traceId: FOLD_TRACE_ID,
    spanId: "ev-shipped",
    parentSpanId: "root",
    name: "order.shipped",
    startTimeUnixNano: String(FOLD_START + 380 * MS),
    endTimeUnixNano: String(FOLD_START + 380 * MS),
    kind: "EVENT",
    resource: { "service.name": "order-service" },
  },
];

export const FoldedEvents: Story = {
  args: {
    spans: foldedEventTrace,
    height: "200px",
    foldEventsIntoParent: true,
    initialState: "expanded",
  },
};
